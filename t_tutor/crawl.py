"""Tibet Watch crawler — keeps the corpus complete so compose.py never has to search.

    python crawl.py --once                  single pass; what a scheduler calls
    python crawl.py --loop --every 4h       long-running, for a demo box
    python crawl.py --backfill              one-off seeding via the search feeds
    python crawl.py --dry-run               poll and report, write nothing
    python crawl.py --feed Phayul --dry-run debug one outlet
    python crawl.py --status                what is in the database

Poll interval is not a preference. CTA turns its entire RSS feed over in about
2.2 days, so anything slower than daily loses stories permanently. Four hours
gives roughly 13x margin.

Exit codes: 0 fine, 1 every feed failed, 2 bad arguments.
"""

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from tutor.watch import db, tracing  # noqa: E402
from tutor.watch.crawler import backfill, run_once  # noqa: E402
from tutor.watch.sources.registry import FEEDS  # noqa: E402


def parse_interval(text: str) -> int:
    """'4h', '30m', '90s' -> seconds."""
    text = (text or "").strip().lower()
    units = {"s": 1, "m": 60, "h": 3600, "d": 86400}
    if text and text[-1] in units:
        try:
            return max(60, int(float(text[:-1]) * units[text[-1]]))
        except ValueError:
            pass
    try:
        return max(60, int(text))
    except ValueError:
        raise argparse.ArgumentTypeError(f"bad interval {text!r} — try 4h, 30m or 900")


def show_status(conn) -> None:
    s = db.stats(conn)
    print("corpus")
    for key in ("articles", "relevant", "screened_out", "unscreened",
                "with_text", "extract_failed", "never_published"):
        print(f"  {key:<16} {s[key]:>6}")

    print("\nfeeds")
    rows = conn.execute(
        "SELECT name, last_success, consecutive_failures, items_seen_total FROM feeds ORDER BY name"
    ).fetchall()
    if not rows:
        print("  (never polled)")
    for r in rows:
        flag = "  OK " if not r["consecutive_failures"] else f"FAIL{r['consecutive_failures']:>2}"
        print(f"  [{flag}] {r['name']:<34} seen={r['items_seen_total']:<6} "
              f"last ok {r['last_success'] or 'never'}")

    unhealthy = db.unhealthy_feeds(conn)
    if unhealthy:
        print(f"\n  {len(unhealthy)} feed(s) failing repeatedly — check registry.py")

    print("\nrecent runs")
    for r in db.recent_runs(conn):
        print(f"  #{r['id']:<4} {r['started_at']}  new={r['new_items'] or 0:<4} "
              f"extracted={r['extracted'] or 0:<4} 304s={r['not_modified'] or 0:<3} "
              f"{'GAPS' if r['gap_warnings'] else ''}")

    print("\nwindow (last 7 days, unpublished, with text)")
    print(f"  {len(db.window(conn, days=7))} article(s) ready for compose")


def main() -> int:
    ap = argparse.ArgumentParser(description="Tibet Watch crawler")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--once", action="store_true", help="single crawl pass (default)")
    mode.add_argument("--loop", action="store_true", help="crawl repeatedly")
    mode.add_argument("--backfill", action="store_true",
                      help="seed history via the WordPress search feeds")
    mode.add_argument("--status", action="store_true", help="show corpus and feed health")

    ap.add_argument("--every", default="4h", help="loop interval (default 4h)")
    ap.add_argument("--dry-run", action="store_true", help="poll and report, write nothing")
    ap.add_argument("--no-gdelt", action="store_true", help="curated feeds only, zero model calls")
    ap.add_argument("--feed", help="restrict to one outlet by name")
    ap.add_argument("--pages", type=int, default=3, help="backfill depth per outlet")
    ap.add_argument("--db", default=db.DEFAULT_PATH, help="database path")
    args = ap.parse_args()

    tracing.configure()
    conn = db.connect(args.db)
    print(f"db: {args.db}")
    print(f"{tracing.status_line()}\n")

    if args.status:
        show_status(conn)
        return 0

    feeds = None
    if args.feed:
        feeds = [f for f in FEEDS if f["name"].lower() == args.feed.lower()]
        if not feeds:
            print(f"no feed named {args.feed!r}. Known: {', '.join(f['name'] for f in FEEDS)}")
            return 2

    if args.backfill:
        print(f"backfilling {args.pages} page(s) per outlet via search feeds...")
        report = backfill(conn, pages=args.pages, dry_run=args.dry_run)
        print(f"  {report['outlets']} outlets, {report['items']} entries, "
              f"{report['ingest']['new']} new")
        print("\nnow run --once to screen and extract them.")
        return 0

    interval = parse_interval(args.every)
    passes = 0
    while True:
        started = time.time()
        passes += 1
        print(f"--- crawl pass {passes} ---")
        report = run_once(conn, use_gdelt=not args.no_gdelt,
                          dry_run=args.dry_run, feeds=feeds)

        s = report["stats"]
        print(f"corpus: {s['articles']} articles, {s['relevant']} relevant, "
              f"{s['with_text']} with text, {s['never_published']} awaiting an issue")
        print(f"took {time.time() - started:.0f}s")

        if report["feeds"]["polled"] and \
           len(report["feeds"]["errors"]) == report["feeds"]["polled"]:
            print("\nevery feed failed — check the network")
            return 1

        if not args.loop:
            return 0

        print(f"\nsleeping {interval}s until the next pass (Ctrl+C to stop)\n")
        try:
            time.sleep(interval)
        except KeyboardInterrupt:
            print("stopped.")
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
