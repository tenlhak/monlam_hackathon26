"""Phase 3 gate — does the whole agent complete an on-demand query?

Gate: the agent searches, summarises at least two articles in both languages,
finishes on its own rather than hitting the recursion limit, and every article
it reports carries a real URL.

Usage:
    conda activate monlam
    python checks/gate3_agent.py ["your question"]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from tutor.watch.agent import stream  # noqa: E402
from tutor.watch.parsing import content_tokens, detect_language  # noqa: E402

DEFAULT_QUESTION = "What is the latest on Tibetan language rights and boarding schools?"


def main():
    question = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_QUESTION
    print(f"Q: {question}\n")

    actions = 0
    final_text = ""
    result = {}

    for event in stream(question):
        kind = event["type"]
        if kind == "action":
            actions += 1
            print(f"  [action {actions}]  {event['tool']}({event['input'][:70]!r})")
        elif kind == "observation":
            first = (event["content"] or "").splitlines()[:1]
            print(f"  [observation] {(first[0] if first else '')[:100]}")
        elif kind == "final":
            final_text = event["content"]
        elif kind == "done":
            result = event

    articles = result.get("results", [])
    spend = result.get("spend", {})

    print(f"\n--- overview ---\n{final_text[:700]}\n")
    print(f"--- {len(articles)} article(s) summarised ---")

    # Topical fit, not just bilingual plumbing. The first run of this gate
    # passed while returning three articles that had nothing to do with the
    # question — all correctly about Tibet, none about what was asked.
    tokens = [t for t in content_tokens(question) if t.isascii()]

    both_languages = 0
    have_urls = 0
    on_topic = 0
    for art in articles:
        lang_en = detect_language(art.get("summary_en") or "")
        lang_bo = detect_language(art.get("summary_bo") or "")
        ok_langs = bool(art.get("summary_en")) and lang_bo == "bo" and lang_en == "en"
        both_languages += ok_langs
        have_urls += bool((art.get("url") or "").startswith("http"))

        haystack = f"{art.get('title') or ''} {art.get('summary_en') or ''}".lower()
        fits = any(t in haystack for t in tokens)
        on_topic += fits

        print(f"  [{art['id']}] q={art.get('query_score', 0):.1f} {art['source']:<22} "
              f"{(art.get('title') or '')[:40]:<42} "
              f"en={len(art.get('summary_en') or '')}c bo={len(art.get('summary_bo') or '')}c "
              f"{'ok' if ok_langs else 'LANG FAIL'} {'on-topic' if fits else 'OFF-TOPIC'}")

    sources = {art["source"] for art in articles}
    print(f"\ndistinct sources: {len(sources)}  {sorted(sources)}")
    print(f"tool calls: {actions}   llm calls: {spend.get('calls')}   "
          f"tokens in/out: {spend.get('input_tokens')}/{spend.get('output_tokens')}   "
          f"cost: {spend.get('cost', 0):.4f}")

    passed = (len(articles) >= 2 and both_languages >= 2
              and have_urls == len(articles) and bool(final_text)
              and on_topic >= 2)
    print("\nGATE 3:", "PASS" if passed else "FAIL")
    print(f"  articles {len(articles)} | bilingual {both_languages} | urls {have_urls} "
          f"| on-topic {on_topic} | final answer {'yes' if final_text else 'no'}")
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
