"""Build a newsletter issue from the crawled corpus.

    python compose.py                     compose this week's draft
    python compose.py --window 14         widen the window
    python compose.py --max-stories 8     shorter issue
    python compose.py --show 2026-W31     print an existing draft
    python compose.py --list              list issues

Composing is non-destructive: articles are only marked as published when an
issue is actually sent, so a draft you throw away costs nothing but tokens and
recomposing simply replaces it.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from tutor.watch import db, tracing  # noqa: E402
from tutor.watch.compose import compose_issue  # noqa: E402


def print_issue(issue: dict, show_tibetan: bool = True) -> None:
    print("=" * 76)
    print(f"TIBET WATCH — {issue['id']}    ({issue.get('status')})")
    print("=" * 76)
    if issue.get("intro"):
        print(f"\n{issue['intro']}\n")

    current = None
    for story in issue["stories"]:
        if story["section"] != current:
            current = story["section"]
            print(f"\n{'-' * 76}\n{current.upper()}\n{'-' * 76}")
        print(f"\n{story.get('headline_en') or story['headline']}")
        print(f"  {story['summary_en']}")
        if show_tibetan and story.get("summary_bo"):
            if story.get("headline_bo"):
                print(f"\n  {story['headline_bo']}")
            print(f"  {story['summary_bo']}")
        for src in story["sources"]:
            print(f"    - {src['source']}: {src['url']}")
        print(f"    [salience {story['salience']}, {story['source_count']} outlet(s)]")
    print()


def main() -> int:
    ap = argparse.ArgumentParser(description="Compose a Tibet Watch issue")
    ap.add_argument("--window", type=int, default=7, help="days of coverage (default 7)")
    ap.add_argument("--max-stories", type=int, default=12)
    ap.add_argument("--issue", help="issue id (default: current ISO week)")
    ap.add_argument("--show", metavar="ISSUE_ID", help="print an existing issue")
    ap.add_argument("--list", action="store_true", help="list issues")
    ap.add_argument("--no-tibetan", action="store_true", help="English only in the printout")
    ap.add_argument("--db", default=db.DEFAULT_PATH)
    args = ap.parse_args()

    tracing.configure()
    conn = db.connect(args.db)

    if args.list:
        rows = db.list_issues(conn)
        if not rows:
            print("no issues yet")
        for r in rows:
            print(f"  {r['id']:<12} {r['status']:<9} {r['story_count'] or 0:>2} stories  "
                  f"cost {r['cost'] or 0:.3f}  {r['created_at']}")
        return 0

    if args.show:
        issue = db.get_issue(conn, args.show)
        if issue is None:
            print(f"no issue {args.show!r}")
            return 1
        print_issue(issue, show_tibetan=not args.no_tibetan)
        return 0

    print(f"{tracing.status_line()}\n")
    result = compose_issue(conn, window_days=args.window,
                           max_stories=args.max_stories, issue_id=args.issue)

    if result.get("error"):
        print(f"\n{result['error']}")
        return 1

    spend = result.get("spend", {})
    print(f"\n{result['article_count']} articles -> {result['cluster_count']} stories -> "
          f"{len(result['stories'])} published")
    print(f"{spend.get('calls', 0)} model calls, cost {spend.get('cost', 0):.4f}\n")

    print_issue(db.get_issue(conn, result["issue_id"]), show_tibetan=not args.no_tibetan)
    print(f"draft saved as {result['issue_id']}. Review it, then send.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
