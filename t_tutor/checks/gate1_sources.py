"""Phase 1 gate — do the sources actually return usable, deduped candidates?

Also serves as the pre-demo health check: feed URLs rot, and it is better to
find that here than mid-presentation. Run it before showing the agent to
anyone.

Gate: a real query yields >= 10 deduped candidates, including at least one
Tibetan-language item.

Usage:
    conda activate monlam
    python checks/gate1_sources.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import feedparser  # noqa: E402

from tutor.watch.net import get  # noqa: E402
from tutor.watch.sources import gdelt, rss  # noqa: E402
from tutor.watch.sources.registry import FEEDS  # noqa: E402
from tutor.watch.store import DocStore  # noqa: E402

QUERY_EN = "Tibetan language rights and boarding schools"
QUERY_BO = "བོད་ཡིག་ཐོབ་ཐང་"


def check_feeds():
    """Report which configured feed URLs still resolve."""
    print("Feed health")
    healthy = 0
    for feed in FEEDS:
        for kind in ("latest", "search"):
            url = feed.get(kind)
            if not url:
                continue
            probe = url.format(q="tibet") if kind == "search" else url
            resp = get(probe, timeout=30)
            count = len(feedparser.parse(resp.content).entries) if resp else 0
            status = "ok  " if count else "DEAD"
            if count:
                healthy += 1
            print(f"  [{status}] {feed['name']:<34} {kind:<7} {count:>3} entries")
    print(f"  -> {healthy} working endpoints\n")
    return healthy


def main():
    healthy = check_feeds()

    print(f"RSS search: {QUERY_EN!r} / {QUERY_BO!r}")
    rss_hits = rss.search(QUERY_EN, QUERY_BO)
    print(f"  {len(rss_hits)} raw candidates")

    print("GDELT search (one call, 5s rate limit)")
    gdelt_hits = gdelt.search(QUERY_EN)
    print(f"  {len(gdelt_hits)} raw candidates")

    store = DocStore()
    dupes = 0
    for hit in rss_hits + gdelt_hits:
        if store.add(**hit) is None:
            dupes += 1

    docs = store.all()
    print(f"\nDeduped: {len(docs)} unique ({dupes} duplicates dropped)\n")

    by_lang = {}
    for doc in docs:
        by_lang[doc.language] = by_lang.get(doc.language, 0) + 1
    print(f"by language: {by_lang}")

    by_via = {}
    for doc in docs:
        by_via[doc.found_via] = by_via.get(doc.found_via, 0) + 1
    print(f"by source:   {by_via}\n")

    for doc in docs[:14]:
        print(f"  [{doc.id}] {doc.language}  {doc.source:<26} {doc.title[:62]}")

    tibetan = by_lang.get("bo", 0)
    passed = len(docs) >= 10 and tibetan >= 1 and healthy >= 6
    print("\nGATE 1:", "PASS" if passed else
          f"FAIL — need >=10 docs (got {len(docs)}), >=1 Tibetan (got {tibetan}), >=6 feeds (got {healthy})")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
