"""Phase 5 gate — the crawler's rules, tested without touching the network.

Live crawling is verified by running crawl.py. What this covers is the logic
that is easy to get subtly wrong and hard to notice: idempotency, the date
guard rails, domain policy, and the window query that compose will depend on.

Every case here corresponds to a real hazard:
  * a crawler that re-inserts on every pass
  * a stale feed (TCHRD spans 183 days) flooding an issue
  * an outlet that omits dates being silently dropped
  * a server with a wrong clock pinning an article to the top forever
  * open search fetching from a domain nobody vetted

Usage:
    conda activate monlam
    python checks/gate4_crawler.py
"""

import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from tutor.watch import db  # noqa: E402
from tutor.watch.crawler import domain_allowed, domain_of, ingest  # noqa: E402

results = []


def check(name: str, got, want) -> None:
    ok = got == want
    results.append(ok)
    print(f"  [{'ok  ' if ok else 'FAIL'}] {name:<52} got={got!r} want={want!r}")


def iso(days_ago: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat(timespec="seconds")


def item(url: str, **kw) -> dict:
    return {"url": url, "title": kw.get("title", "Tibet story"), "snippet": "",
            "source": kw.get("source", "Test"), "language": "en",
            "published_at": kw.get("published_at"), "found_via": "rss-latest",
            "is_state_media": kw.get("is_state_media", False)}


def main():
    path = os.path.join(tempfile.mkdtemp(), "gate4.db")
    conn = db.connect(path)

    print("Idempotency — the same item must never be inserted twice")
    first = ingest(conn, [item("https://phayul.com/a"), item("https://phayul.com/b")])
    check("first ingest, 2 items", first["new"], 2)
    second = ingest(conn, [item("https://phayul.com/a"), item("https://phayul.com/b")])
    check("re-ingesting the same items", second["new"], 0)
    check("...counted as duplicates", second["duplicate"], 2)
    # Tracking params must not create a second copy of one article.
    third = ingest(conn, [item("https://www.phayul.com/a?utm_source=twitter")])
    check("same URL with utm_ params and www", third["new"], 0)
    print()

    print("Date guard rails")
    old = ingest(conn, [item("https://phayul.com/old", published_at=iso(200))])
    check("200 days old is rejected at ingest", old["too_old"], 1)
    recent = ingest(conn, [item("https://phayul.com/recent", published_at=iso(30))])
    check("30 days old is kept (survives an outage)", recent["new"], 1)
    undated = ingest(conn, [item("https://phayul.com/undated", published_at=None)])
    check("undated is kept, not dropped", undated["new"], 1)

    future = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(timespec="seconds")
    ingest(conn, [item("https://phayul.com/future", published_at=future)])
    row = conn.execute("SELECT published_at FROM articles WHERE url LIKE '%future'").fetchone()
    check("a wrong-clock future date is nulled", row["published_at"], None)
    print()

    print("Domain policy for open search")
    check("curated outlet", domain_allowed("phayul.com"), (True, False))
    check("reputable mainstream", domain_allowed("thehindu.com"), (True, False))
    check("mainstream subdomain", domain_allowed("edition.cnn.com"), (True, False))
    check("state media (off by default)", domain_allowed("globaltimes.cn"), (False, True))
    check("unvetted domain", domain_allowed("random-blog.example"), (False, False))
    check("www is stripped", domain_of("https://www.bbc.co.uk/news"), "bbc.co.uk")
    print()

    print("Compose window")
    conn.execute("UPDATE articles SET relevant=1, text='body' WHERE 1=1")
    conn.execute("UPDATE articles SET published_at=? WHERE url LIKE '%/a'", (iso(2),))
    conn.execute("UPDATE articles SET published_at=? WHERE url LIKE '%/b'", (iso(20),))
    conn.commit()
    in_window = {r["url"] for r in db.window(conn, days=7)}
    check("2 days old is in the 7-day window", "https://phayul.com/a" in in_window, True)
    check("20 days old is not", "https://phayul.com/b" in in_window, False)

    conn.execute("UPDATE articles SET published_in_issue='2026-W31' WHERE url LIKE '%/a'")
    conn.commit()
    still = {r["url"] for r in db.window(conn, days=7)}
    check("an already-published article drops out", "https://phayul.com/a" in still, False)
    print()

    print("Extraction targeting")
    pending = {r["url"] for r in db.needing_extraction(conn, window_days=14)}
    check("stale backlog is not queued for download", "https://phayul.com/b" in pending, False)
    print()

    conn.close()
    passed = all(results)
    print("GATE 4:", "PASS" if passed else "FAIL")
    print(f"  {sum(results)}/{len(results)} checks")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
