"""The crawler: keep the corpus complete, and nothing else.

Its single responsibility is that no story about Tibet published in the last
week is missing from the database. It does not cluster, summarise, rank, or
decide what matters — those need the whole window in view, and the crawler
only ever sees a trickle.

Three things drive the design, all of them measured rather than assumed:

  * RSS is a sliding window, not an archive. CTA turns its entire feed over in
    2.2 days, so a daily poll would lose stories permanently. Every few hours
    is not caution, it is the requirement.

  * Feeds go stale without breaking. TCHRD's feed is perfectly healthy and
    spans 183 days with nothing in the last week. So ingest must not filter on
    recency — record it all, and let compose window the issue. Filtering at
    ingest would also mean a crawler that was down for three days throws away
    exactly what the outage cost it.

  * Dates are unreliable. Some feeds omit them, some servers emit future
    timestamps. Anything undated is kept and treated as current, because
    dropping an outlet silently is worse than fetching a few extra pages.
"""

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from . import db
from .extract import fetch_article
from .net import conditional_get
from .relevance import judge, prefilter
from .sources import gdelt, rss
from .sources.registry import (
    FEEDS,
    INCLUDE_STATE_MEDIA,
    MAINSTREAM_DOMAINS,
    STANDING_QUERIES,
    STATE_MEDIA_DOMAINS,
    TRUSTED_DOMAINS,
)
from .store import canonical_url, doc_id
from .tracing import traceable

# Ingest guard rail only — wide enough to survive an outage, narrow enough that
# a misconfigured feed cannot flood the corpus with 2019 content.
MAX_AGE_DAYS = 60

# Full text is only worth downloading for articles that could still make an
# issue. Wider than the 7-day compose window, so a late-arriving story is
# still covered.
EXTRACT_WINDOW_DAYS = 14

POLL_WORKERS = 8
EXTRACT_WORKERS = 4


# ---------------------------------------------------------------------------
# Domain policy
# ---------------------------------------------------------------------------

def domain_of(url: str) -> str:
    host = (urlparse(url or "").netloc or "").lower()
    return host[4:] if host.startswith("www.") else host


def _matches(domain: str, allowed: set) -> bool:
    """Exact match or subdomain of an allowed domain (edition.cnn.com)."""
    return any(domain == a or domain.endswith("." + a) for a in allowed)


def domain_allowed(domain: str) -> Tuple[bool, bool]:
    """(allowed, is_state_media) for an open-search result.

    Open search hands back arbitrary domains. Rather than let the crawler fetch
    from anywhere, results are kept only from outlets that are curated,
    reputable mainstream, or explicitly-enabled state media.
    """
    if _matches(domain, STATE_MEDIA_DOMAINS):
        return INCLUDE_STATE_MEDIA, True
    if _matches(domain, TRUSTED_DOMAINS) or _matches(domain, MAINSTREAM_DOMAINS):
        return True, False
    return False, False


# ---------------------------------------------------------------------------
# Polling
# ---------------------------------------------------------------------------

def _poll_one(feed: Dict, state: Dict) -> Dict[str, Any]:
    """Poll one feed with conditional GET. Never raises."""
    url = feed.get("latest")
    result = {"feed": feed, "url": url, "status": 0, "items": [],
              "etag": None, "last_modified": None, "error": None}
    if not url:
        result["error"] = "no recency feed configured"
        return result

    try:
        status, resp = conditional_get(url, state.get("etag"), state.get("last_modified"))
    except Exception as exc:  # noqa: BLE001 - one bad feed must not kill a run
        result["error"] = f"{type(exc).__name__}: {exc}"
        return result

    result["status"] = status
    if status == 304 or resp is None:
        if status not in (200, 304):
            result["error"] = f"HTTP {status}"
        return result

    result["etag"] = resp.headers.get("ETag")
    result["last_modified"] = resp.headers.get("Last-Modified")
    try:
        result["items"] = rss.parse_entries(resp.content, feed)
    except Exception as exc:  # noqa: BLE001
        result["error"] = f"parse failed: {type(exc).__name__}"
    return result


@traceable(run_type="retriever", name="crawler.poll_feeds",
           process_outputs=lambda o: {"items": len(o[0]), "stats": o[1]})
def poll_feeds(conn, feeds: Optional[List[Dict]] = None,
               dry_run: bool = False) -> Tuple[List[Dict], Dict[str, Any]]:
    """Poll every configured feed concurrently.

    Also detects coverage gaps: if none of the items a feed returns were in the
    previous poll, the feed turned over completely and we may have missed
    something. That is the only warning that catches a poll interval which has
    quietly become too slow for an outlet's publishing rate.
    """
    feeds = feeds or FEEDS
    items: List[Dict] = []
    stats = {"polled": 0, "not_modified": 0, "errors": [], "gaps": []}

    states = {f["name"]: db.feed_state(conn, f["name"]) for f in feeds}

    with ThreadPoolExecutor(max_workers=POLL_WORKERS) as pool:
        futures = [pool.submit(_poll_one, f, states[f["name"]]) for f in feeds]
        results = [fut.result() for fut in as_completed(futures)]

    for res in results:
        feed, name = res["feed"], res["feed"]["name"]
        stats["polled"] += 1

        if res["error"]:
            stats["errors"].append(f"{name}: {res['error']}")
            if not dry_run:
                db.save_feed_state(conn, name, res["url"] or "", ok=False)
            continue

        if res["status"] == 304:
            stats["not_modified"] += 1
            if not dry_run:
                db.save_feed_state(conn, name, res["url"], ok=True)
            continue

        ids = [doc_id(i["url"]) for i in res["items"]]
        previous = set(states[name].get("last_item_ids") or [])
        if previous and ids and not (previous & set(ids)):
            stats["gaps"].append(
                f"{name}: no overlap with previous poll ({len(ids)} items) — "
                f"poll interval may be too slow"
            )

        items.extend(res["items"])
        if not dry_run:
            db.save_feed_state(conn, name, res["url"], etag=res["etag"],
                               last_modified=res["last_modified"], ok=True,
                               item_ids=ids, seen=len(ids))

    return items, stats


@traceable(run_type="retriever", name="crawler.poll_gdelt",
           process_outputs=lambda o: {"kept": len(o[0]), "stats": o[1]})
def poll_gdelt(queries: Optional[List[str]] = None) -> Tuple[List[Dict], Dict[str, Any]]:
    """Run the standing queries and keep only allowed domains.

    GDELT rate-limits hard — measurably harder than its documented 5 seconds —
    but this runs unattended, so waiting costs nothing. That is why open search
    belongs here and not in an interactive request.
    """
    queries = queries or STANDING_QUERIES
    kept: List[Dict] = []
    stats = {"queries": 0, "raw": 0, "rejected_domain": 0}

    for query in queries:
        stats["queries"] += 1
        try:
            hits = gdelt.search(query)
        except Exception:  # noqa: BLE001
            continue
        stats["raw"] += len(hits)

        for hit in hits:
            domain = domain_of(hit["url"])
            allowed, is_state = domain_allowed(domain)
            if not allowed:
                stats["rejected_domain"] += 1
                continue
            kept.append({**hit, "source": domain, "is_state_media": is_state,
                         "standing_query": query})

    return kept, stats


# ---------------------------------------------------------------------------
# Ingest
# ---------------------------------------------------------------------------

def ingest(conn, items: List[Dict], dry_run: bool = False) -> Dict[str, int]:
    """Insert unseen items. Idempotent — the id is derived from the URL."""
    # `duplicate` stays 0 on a dry run, because nothing is looked up — better
    # an honest zero than a number that silently means something else.
    counts = {"seen": len(items), "new": 0, "duplicate": 0, "too_old": 0, "no_url": 0}
    cutoff = (datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)).isoformat(timespec="seconds")
    horizon = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(timespec="seconds")

    for item in items:
        url = item.get("url")
        if not url:
            counts["no_url"] += 1
            continue

        published = item.get("published_at")
        # Undated items are kept: dropping a whole outlet because its feed
        # omits dates is a far worse failure than storing a few stale rows.
        if published and published < cutoff:
            counts["too_old"] += 1
            continue
        # Some servers run wrong clocks; a far-future date would otherwise sit
        # at the top of every issue forever.
        if published and published > horizon:
            published = None

        row = {
            "id": doc_id(url),
            "canonical_url": canonical_url(url),
            "url": url,
            "title": item.get("title") or "",
            "source": item.get("source") or domain_of(url),
            "source_domain": domain_of(url),
            "lang": item.get("language") or "en",
            "published_at": published,
            "snippet": item.get("snippet") or "",
            "found_via": item.get("found_via") or "rss-latest",
            "is_state_media": 1 if item.get("is_state_media") else 0,
        }
        if dry_run:
            counts["new"] += 1
            continue
        if db.insert_article(conn, row):
            counts["new"] += 1
        else:
            counts["duplicate"] += 1

    if not dry_run:
        conn.commit()
    return counts


# ---------------------------------------------------------------------------
# Screening
# ---------------------------------------------------------------------------

@traceable(run_type="chain", name="crawler.screen",
           process_outputs=lambda o: o)
def screen(conn, model=None, dry_run: bool = False) -> Dict[str, int]:
    """Prefilter everything unscreened; ask the model only about borderlines.

    With curated feeds alone this makes zero model calls — every domain is
    trusted, so the free rules resolve everything. The judge exists for open
    search results, which is the only place unvetted domains appear.
    """
    rows = db.unscreened(conn)
    counts = {"screened": len(rows), "passed": 0, "vetoed": 0, "judged": 0, "llm_calls": 0}
    borderline = []

    for row in rows:
        verdict, reason = prefilter(row["url"], row["title"] or "", row["snippet"] or "")
        if verdict == "pass":
            counts["passed"] += 1
            if not dry_run:
                db.set_screening(conn, row["id"], True, 1.0, reason)
        elif verdict == "veto":
            counts["vetoed"] += 1
            if not dry_run:
                db.set_screening(conn, row["id"], False, 0.0, reason)
        else:
            borderline.append({"id": row["id"], "title": row["title"] or "",
                               "snippet": row["snippet"] or "",
                               "source": row["source"] or ""})

    if borderline and not dry_run:
        if model is None:
            from .melong import ChatMelong
            model = ChatMelong(temperature=0.0, max_tokens=1200)
        verdicts = judge(model, borderline)
        counts["llm_calls"] = (len(borderline) + 14) // 15
        for item in borderline:
            ruling = verdicts.get(item["id"])
            if ruling is None:
                # Unjudged stays NULL so the next run retries it, rather than
                # being silently recorded as irrelevant.
                continue
            counts["judged"] += 1
            if ruling["relevant"]:
                counts["passed"] += 1
            else:
                counts["vetoed"] += 1
            db.set_screening(conn, item["id"], ruling["relevant"],
                             ruling["score"], ruling["reason"])
    elif borderline:
        counts["judged"] = len(borderline)

    if not dry_run:
        conn.commit()
    return counts


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

def _extract_one(row) -> Tuple[str, Dict]:
    return row["id"], fetch_article(row["url"])


@traceable(run_type="chain", name="crawler.extract",
           process_outputs=lambda o: o)
def extract(conn, window_days: int = EXTRACT_WINDOW_DAYS,
            limit: int = 120, dry_run: bool = False) -> Dict[str, int]:
    """Download full text for relevant, in-window articles without it.

    Doing this at crawl time rather than compose time spreads the network load,
    surfaces dead links days before they matter, and — the reason that actually
    decides it for this subject — captures the text before it can be taken
    down. Tibet coverage disappears.
    """
    rows = db.needing_extraction(conn, window_days, limit=limit)
    counts = {"attempted": len(rows), "extracted": 0, "failed": 0}
    if dry_run or not rows:
        return counts

    with ThreadPoolExecutor(max_workers=EXTRACT_WORKERS) as pool:
        futures = [pool.submit(_extract_one, row) for row in rows]
        for fut in as_completed(futures):
            try:
                article_id, got = fut.result()
            except Exception as exc:  # noqa: BLE001
                counts["failed"] += 1
                continue
            if got.get("error"):
                counts["failed"] += 1
                db.set_extract_error(conn, article_id, got["error"])
            else:
                counts["extracted"] += 1
                db.set_text(conn, article_id, got["text"], got.get("title") or "",
                            got.get("published_at"), got.get("word_count") or 0,
                            got.get("char_count") or 0)

    conn.commit()
    return counts


# ---------------------------------------------------------------------------
# One pass
# ---------------------------------------------------------------------------

@traceable(run_type="chain", name="crawler.run_once")
def run_once(conn, use_gdelt: bool = True, dry_run: bool = False,
             feeds: Optional[List[Dict]] = None, verbose: bool = True) -> Dict[str, Any]:
    """A full crawl: poll, ingest, screen, extract. Safe to run at any time."""
    run_id = None if dry_run else db.start_run(conn)
    report: Dict[str, Any] = {"dry_run": dry_run}

    def say(msg: str) -> None:
        if verbose:
            print(msg)

    say("polling feeds...")
    items, feed_stats = poll_feeds(conn, feeds=feeds, dry_run=dry_run)
    report["feeds"] = feed_stats
    say(f"  {feed_stats['polled']} polled, {feed_stats['not_modified']} unchanged (304), "
        f"{len(items)} items, {len(feed_stats['errors'])} errors")
    for gap in feed_stats["gaps"]:
        say(f"  GAP  {gap}")
    for err in feed_stats["errors"]:
        say(f"  FAIL {err}")

    gdelt_stats = {"queries": 0, "raw": 0, "rejected_domain": 0}
    if use_gdelt:
        say(f"querying GDELT ({len(STANDING_QUERIES)} standing queries, throttled)...")
        gdelt_items, gdelt_stats = poll_gdelt()
        say(f"  {gdelt_stats['raw']} raw, {gdelt_stats['rejected_domain']} rejected on domain, "
            f"{len(gdelt_items)} kept")
        items.extend(gdelt_items)
    report["gdelt"] = gdelt_stats

    say("ingesting...")
    ingest_counts = ingest(conn, items, dry_run=dry_run)
    report["ingest"] = ingest_counts
    say(f"  {ingest_counts['seen']} seen: {ingest_counts['new']} new, "
        f"{ingest_counts['duplicate']} already known, "
        f"{ingest_counts['too_old']} beyond {MAX_AGE_DAYS}d")

    say("screening...")
    screen_counts = screen(conn, dry_run=dry_run)
    report["screen"] = screen_counts
    say(f"  {screen_counts['screened']} screened: {screen_counts['passed']} relevant, "
        f"{screen_counts['vetoed']} rejected, {screen_counts['llm_calls']} model calls")

    say(f"extracting text (window {EXTRACT_WINDOW_DAYS}d)...")
    extract_counts = extract(conn, dry_run=dry_run)
    report["extract"] = extract_counts
    say(f"  {extract_counts['extracted']} extracted, {extract_counts['failed']} failed")

    if not dry_run:
        db.finish_run(
            conn, run_id,
            feeds_polled=feed_stats["polled"], not_modified=feed_stats["not_modified"],
            new_items=ingest_counts["new"], screened_out=screen_counts["vetoed"],
            extracted=extract_counts["extracted"], extract_failures=extract_counts["failed"],
            gdelt_items=gdelt_stats.get("raw", 0),
            gap_warnings=json.dumps(feed_stats["gaps"]) if feed_stats["gaps"] else None,
            errors=json.dumps(feed_stats["errors"]) if feed_stats["errors"] else None,
        )

    report["stats"] = db.stats(conn)
    return report


@traceable(run_type="chain", name="crawler.backfill")
def backfill(conn, queries: Optional[List[str]] = None, pages: int = 3,
             dry_run: bool = False) -> Dict[str, Any]:
    """One-off seeding, so issue #1 is not built from four days of history.

    Reuses the WordPress search feeds the steady-state crawler never touches:
    /?s=<query>&feed=rss2&paged=N walks back through an outlet's archive.
    """
    from urllib.parse import quote_plus

    queries = queries or ["tibet"]
    items: List[Dict] = []

    for feed in (feeds_with_search := [f for f in FEEDS if f.get("search")]):
        for query in queries:
            for page in range(1, pages + 1):
                url = feed["search"].format(q=quote_plus(query))
                if page > 1:
                    url += f"&paged={page}"
                status, resp = conditional_get(url)
                if status != 200 or resp is None:
                    break
                found = rss.parse_entries(resp.content, feed)
                if not found:
                    break
                for entry in found:
                    entry["found_via"] = "rss-backfill"
                items.extend(found)

    counts = ingest(conn, items, dry_run=dry_run)
    return {"outlets": len(feeds_with_search), "items": len(items), "ingest": counts}
