"""Phase 6 gate — the composer's logic, tested without the model.

Quality of the writing needs reading. What this covers is the arithmetic and
set logic underneath it, where the bugs are silent:

  * salience must rank a four-outlet disaster above six posts an institution
    wrote about its own itinerary
  * overlapping clusters must merge, not split, or one story becomes three
  * batch windows must overlap, or a story is lost at a boundary

Usage:
    conda activate monlam
    python checks/gate5_compose.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from datetime import datetime, timedelta, timezone  # noqa: E402

from tutor.watch.compose import _batches, salience  # noqa: E402

results = []


def check(name, got, want):
    ok = got == want
    results.append(ok)
    print(f"  [{'ok  ' if ok else 'FAIL'}] {name:<54} got={got!r} want={want!r}")


def gt(name, got, floor):
    ok = got > floor
    results.append(ok)
    print(f"  [{'ok  ' if ok else 'FAIL'}] {name:<54} {got} > {floor}")


def article(source, lang="en", days=1, via="rss-latest"):
    when = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
    return {"source": source, "lang": lang, "published_at": when,
            "first_seen_at": when, "found_via": via}


def merge(raw_groups):
    """The merge-on-overlap step from cluster(), isolated."""
    groups, owner = [], {}
    for members in raw_groups:
        existing = next((owner[i] for i in members if i in owner), None)
        if existing is None:
            for i in members:
                owner[i] = len(groups)
            groups.append(list(members))
        else:
            for i in members:
                if i not in owner:
                    owner[i] = existing
                    groups[existing].append(i)
    return groups


def main():
    print("Salience — outlets must outweigh volume")
    # The real week: 4 outlets on the earthquakes vs 6 CTA posts on its own tour.
    quake = salience([article("Phayul"), article("RFA", "bo"),
                      article("Tibet Times", "bo"), article("Tibetan Review")])
    tour = salience([article("CTA") for _ in range(6)])
    print(f"    4-outlet bilingual story: {quake['salience']}")
    print(f"    6-article single-outlet : {tour['salience']}")
    gt("four outlets beat six single-source articles", quake["salience"], tour["salience"])
    check("source_count counts outlets, not articles", tour["source_count"], 1)

    bilingual = salience([article("A"), article("B", "bo")])
    monolingual = salience([article("A"), article("B")])
    gt("bilingual coverage scores higher", bilingual["salience"], monolingual["salience"])

    fresh = salience([article("A", days=0)])
    stale = salience([article("A", days=6)])
    gt("fresher story scores higher", fresh["salience"], stale["salience"])

    outside = salience([article("Reuters", via="gdelt")])
    inside = salience([article("Phayul")])
    gt("escaping the exile press scores higher", outside["salience"], inside["salience"])
    print()

    print("Cluster merging — a shared article joins two groups")
    # The observed model error: the Nepal story came back twice, sharing one
    # article. First-wins would have split a 3-article story.
    check("overlapping groups merge", merge([[10, 32], [29, 32]]), [[10, 32, 29]])
    check("disjoint groups stay apart", merge([[1, 2], [3, 4]]), [[1, 2], [3, 4]])
    check("chained overlap collapses to one", merge([[1, 2], [2, 3], [3, 4]]), [[1, 2, 3, 4]])
    print()

    print("Batch windows — no story lost at a boundary")
    small = _batches(10, size=16)
    check("a short window is one batch", small, [list(range(10))])

    windows = _batches(49, size=16)
    covered = {i for w in windows for i in w}
    check("every article appears in some batch", covered, set(range(49)))

    # Any two adjacent articles must co-occur somewhere, or a two-article story
    # split across a boundary can never be found.
    def together(a, b):
        return any(a in w and b in w for w in windows)
    check("adjacent pair at a boundary co-occurs", together(15, 16), True)
    check("adjacent pair mid-batch co-occurs", together(20, 21), True)
    check("last two articles co-occur", together(47, 48), True)
    print(f"    {len(windows)} windows for 49 articles")
    print()

    passed = all(results)
    print("GATE 5:", "PASS" if passed else "FAIL")
    print(f"  {sum(results)}/{len(results)} checks")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
