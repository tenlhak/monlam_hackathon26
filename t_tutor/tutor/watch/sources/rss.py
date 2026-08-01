"""The precision layer: curated Tibet outlets, searched concurrently.

English outlets are queried through their WordPress search feed, so we get
archive search rather than only recent items. The Tibetan-language outlets
ignore ?s=, so those are pulled as recency feeds and keyword-matched locally
against the Tibetan form of the query.
"""

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Dict, List, Optional
from urllib.parse import quote_plus

import feedparser

from ..net import get
from ..parsing import content_tokens
from ..tracing import traceable
from .registry import FEEDS

TAGS = re.compile(r"<[^>]+>")
WS = re.compile(r"\s+")


def _clean(html: str, limit: int = 400) -> str:
    return WS.sub(" ", TAGS.sub(" ", html or "")).strip()[:limit]


def _published(entry) -> Optional[str]:
    for key in ("published_parsed", "updated_parsed"):
        parsed = entry.get(key)
        if parsed:
            return f"{parsed[0]:04d}-{parsed[1]:02d}-{parsed[2]:02d}"
    return None


def _published_iso(entry) -> Optional[str]:
    """Full ISO8601 UTC timestamp, for storage and date comparisons.

    The date-only form above is fine for display but breaks string comparison
    against an ISO datetime cutoff: "2026-07-25" sorts before
    "2026-07-25T10:00:00+00:00", so a same-day article would fall out of a
    window it belongs in. feedparser already normalises to UTC.
    """
    for key in ("published_parsed", "updated_parsed"):
        parsed = entry.get(key)
        if parsed:
            try:
                return datetime(*parsed[:6], tzinfo=timezone.utc).isoformat(timespec="seconds")
            except (TypeError, ValueError):
                continue
    return None


def _entries(url: str) -> List:
    resp = get(url, timeout=30)
    if resp is None:
        return []
    # Parse from bytes so feedparser honours the declared encoding — these
    # feeds carry Tibetan script and mis-decoding silently mangles it.
    return feedparser.parse(resp.content).entries or []


def _matches(entry_text: str, tokens: List[str]) -> bool:
    """Loose OR match. Recall matters more than precision here — the relevance
    filter downstream is what enforces topicality."""
    if not tokens:
        return True
    haystack = entry_text.lower()
    return any(t in haystack for t in tokens)


def _count_by(rows, key: str) -> Dict[str, int]:
    """Small summary for a trace span; the full hit list would be noise."""
    counts: Dict[str, int] = {}
    for row in rows or []:
        counts[row.get(key, "?")] = counts.get(row.get(key, "?"), 0) + 1
    return counts


def _harvest(feed: Dict, query_en: str, query_bo: str) -> List[Dict]:
    """Pull candidates from one outlet."""
    query = query_bo if feed["lang"] == "bo" else query_en
    out: List[Dict] = []

    if feed.get("search") and query.strip():
        url = feed["search"].format(q=quote_plus(query.strip()))
        entries, mode = _entries(url), "rss-search"
        tokens: List[str] = []  # the site already did the matching
    else:
        entries, mode = _entries(feed.get("latest") or ""), "rss-latest"
        tokens = content_tokens(query)

    for entry in entries:
        link = entry.get("link")
        title = entry.get("title") or ""
        snippet = _clean(entry.get("summary") or entry.get("description") or "")
        if not link:
            continue
        if tokens and not _matches(f"{title} {snippet}", tokens):
            continue
        out.append({
            "url": link,
            "title": title,
            "snippet": snippet,
            "published_at": _published(entry),
            "source": feed["name"],
            "language": feed["lang"],
            "found_via": mode,
        })
    return out


def parse_entries(content: bytes, feed: Dict) -> List[Dict]:
    """Normalise every entry in a feed body. No query, no filtering.

    This is the crawler's entry point: it takes whatever the outlet is
    currently publishing. Deciding what is on-topic happens later, and
    deciding what is recent enough happens later still.
    """
    out: List[Dict] = []
    for entry in (feedparser.parse(content).entries or []):
        link = entry.get("link")
        if not link:
            continue
        out.append({
            "url": link,
            "title": (entry.get("title") or "").strip(),
            "snippet": _clean(entry.get("summary") or entry.get("description") or ""),
            "published_at": _published_iso(entry),
            "source": feed["name"],
            "language": feed["lang"],
            "found_via": "rss-latest",
        })
    return out


@traceable(run_type="retriever", name="rss.search",
           process_outputs=lambda o: {"hits": len(o or []),
                                      "by_source": _count_by(o, "source")})
def search(query_en: str, query_bo: str = "", per_feed: int = 6) -> List[Dict]:
    """Search every curated outlet concurrently.

    query_bo is the Tibetan rendering of the same question; it is what lets the
    Tibetan-language outlets contribute. Passing "" simply skips matching there
    and returns their recent items.
    """
    results: List[Dict] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_harvest, f, query_en, query_bo): f for f in FEEDS}
        for future in as_completed(futures):
            try:
                results.extend(future.result()[:per_feed])
            except Exception:
                # A single broken outlet must not fail the whole search.
                continue
    return results
