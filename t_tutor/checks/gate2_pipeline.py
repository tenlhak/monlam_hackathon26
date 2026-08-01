"""Phase 2 gate — extraction, relevance screening and bilingual summaries.

The load-bearing check is the language one. Nothing so far has verified that
melong can produce a Tibetan summary of an English article, and summary_bo is
the most distinctive output this project has. So the gate asserts that each
summary is actually written in the script it claims: summary_bo must detect as
Tibetan, summary_en as English.

Summaries are printed in full, because faithfulness is not something an
assertion can check — read them.

Usage:
    conda activate monlam
    python checks/gate2_pipeline.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from tutor.watch.extract import fetch_article  # noqa: E402
from tutor.watch.melong import ChatMelong  # noqa: E402
from tutor.watch.parsing import detect_language  # noqa: E402
from tutor.watch.relevance import prefilter, screen  # noqa: E402
from tutor.watch.sources import gdelt, rss  # noqa: E402
from tutor.watch.store import DocStore  # noqa: E402
from tutor.watch.summarize import summarise_doc  # noqa: E402

# Synthetic near-misses: the free prefilter must reject these without spending
# a model call, or an open web search will drown the results.
NEAR_MISSES = [
    ("https://example.com/a", "Tibetan Mastiff puppies for sale in Delhi"),
    ("https://example.com/b", "Best Tibetan singing bowls for sound healing 2026"),
    ("https://example.com/c", "Luxury Lhasa tour package: 10-day trekking deal"),
    ("https://example.com/d", "How to make Tibetan butter tea, a simple recipe"),
]
TRUE_POSITIVES = [
    ("https://tchrd.org/x", "China shuts one of the few remaining Tibetan private schools"),
    ("https://phayul.com/y", "Tibetan political prisoner dies in custody in Lhasa"),
]


def check_prefilter():
    print("Prefilter (free stage)")
    ok = True
    for url, title in NEAR_MISSES:
        verdict, reason = prefilter(url, title)
        flag = "ok  " if verdict == "veto" else "MISS"
        if verdict != "veto":
            ok = False
        print(f"  [{flag}] veto?  {title[:52]:<54} -> {verdict} ({reason})")
    for url, title in TRUE_POSITIVES:
        verdict, reason = prefilter(url, title)
        flag = "ok  " if verdict == "pass" else "MISS"
        if verdict != "pass":
            ok = False
        print(f"  [{flag}] pass?  {title[:52]:<54} -> {verdict} ({reason})")
    print()
    return ok


# Non-curated domains, so the prefilter returns "unsure" and the judge has to
# actually rule. These are the real near-miss shapes from open web search:
# state-media soft coverage that mentions Tibet without engaging the cause, and
# genuine reporting from mainstream outlets that must be kept.
JUDGE_CASES = [
    ("https://news.cn/tibet-dance", "Tibet sees record tourism revenue as folk dance festival draws crowds",
     "Xinhua", False),
    ("https://chinadaily.com.cn/plateau", "Plateau railway boosts economic growth in Xizang, officials say",
     "China Daily", False),
    ("https://reuters.com/tibet-bill", "US lawmakers press China to resume dialogue with Dalai Lama's envoys",
     "Reuters", True),
    ("https://kathmandupost.com/refugees", "Nepal deports Tibetan refugees under pressure from Beijing",
     "Kathmandu Post", True),
    ("https://theguardian.com/boarding", "Inside China's boarding schools separating Tibetan children from families",
     "The Guardian", True),
]


def check_judge(model):
    """Exercise the model judge, which curated sources never reach.

    Feed items auto-pass on domain, so the judge only fires on open-web results.
    Driving it from GDELT made this check flaky — GDELT rate-limits and the
    first run skipped it entirely — so the cases are fixed and labelled, which
    also makes the result a number rather than an impression.
    """
    print("Model judge (borderline stage)")
    store = DocStore()
    expected = {}
    for url, title, source, want in JUDGE_CASES:
        doc = store.add(url=url, title=title, source=source, snippet="", language="en",
                        found_via="synthetic")
        expected[doc.id] = want

    docs = store.all()
    screen(model, docs)

    correct = 0
    for doc in docs:
        want = expected[doc.id]
        got = doc.relevant
        hit = got is want
        correct += hit
        score = f"{doc.relevance_score:.2f}" if doc.relevance_score is not None else " -- "
        print(f"  [{'ok  ' if hit else 'MISS'}] want={'keep' if want else 'drop'} "
              f"got={'keep' if got else 'drop'} {score}  {doc.title[:46]:<48} "
              f"{(doc.why_relevant or '')[:40]}")

    print(f"  -> {correct}/{len(docs)} correct\n")
    return correct, len(docs)


def pick_articles(model):
    """One English and one Tibetan article, screened for relevance."""
    hits = rss.search("Tibetan language rights", "བོད་ཡིག")
    store = DocStore()
    for hit in hits:
        store.add(**hit)

    relevant = screen(model, store.all())
    print(f"Screened {len(store.all())} candidates -> {len(relevant)} relevant\n")

    english = next((d for d in relevant if d.language == "en"), None)
    tibetan = next((d for d in relevant if d.language == "bo"), None)
    return [d for d in (english, tibetan) if d]


def main():
    prefilter_ok = check_prefilter()
    model = ChatMelong(temperature=0.0, max_tokens=1200)

    judge_correct, judge_total = check_judge(model)
    docs = pick_articles(model)
    if len(docs) < 2:
        print("GATE 2: FAIL — could not find both an English and a Tibetan article")
        return 1

    results = []
    for doc in docs:
        print("=" * 74)
        print(f"[{doc.id}] {doc.source} ({doc.language})  {doc.title[:60]}")
        print(f"        {doc.url}")

        fetched = fetch_article(doc.url)
        if fetched["error"]:
            print(f"  EXTRACT FAILED: {fetched['error']}\n")
            results.append(False)
            continue
        doc.text = fetched["text"]
        doc.word_count = fetched["word_count"]
        print(f"  extracted {doc.word_count} words, detected {detect_language(doc.text)}")

        summarise_doc(model, doc)

        lang_en = detect_language(doc.summary_en or "")
        lang_bo = detect_language(doc.summary_bo or "")
        print(f"\n  --- summary_en ({lang_en}) ---\n{doc.summary_en}\n")
        print(f"  --- summary_bo ({lang_bo}) ---\n{doc.summary_bo}\n")

        # Truncation was the defect the first run of this gate missed: a
        # Tibetan summary that ends mid-word still detects as Tibetan.
        complete_en = (doc.summary_en or "").rstrip().endswith((".", "!", "?", "\"", "”"))
        complete_bo = (doc.summary_bo or "").rstrip().endswith(("།", ".", "\"", "”"))
        good = (bool(doc.summary_en) and bool(doc.summary_bo)
                and lang_en == "en" and lang_bo == "bo"
                and complete_en and complete_bo)
        print(f"  language check:  {'ok' if lang_en == 'en' and lang_bo == 'bo' else 'FAIL — wrong script'}")
        print(f"  complete check:  en={'ok' if complete_en else 'TRUNCATED'}  "
              f"bo={'ok' if complete_bo else 'TRUNCATED'}")
        results.append(good)

    spend = model.spend()
    print("=" * 74)
    print(f"llm calls: {spend['calls']}   tokens in/out: "
          f"{spend['input_tokens']}/{spend['output_tokens']}   cost: {spend['cost']:.5f}")

    # 4/5 rather than 5/5: this is a judgement call on borderline items, and
    # demanding perfection from a screening filter would make the gate flaky
    # for no gain. Below 4 means the rubric needs work.
    judge_ok = judge_correct >= 4
    passed = prefilter_ok and judge_ok and all(results) and len(results) == 2
    print("\nGATE 2:", "PASS" if passed else "FAIL")
    print(f"  prefilter {'ok' if prefilter_ok else 'FAIL'} | "
          f"judge {judge_correct}/{judge_total} | "
          f"bilingual summaries {sum(results)}/{len(results)}")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
