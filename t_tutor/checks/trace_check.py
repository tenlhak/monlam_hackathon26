"""Verify LangSmith wiring, and show what the trace tree will look like.

Run it with tracing off and it confirms the decorators are inert. Run it with
LANGSMITH_TRACING=true and LANGSMITH_API_KEY set and it sends a real run, then
prints where to find it.

Usage:
    conda activate monlam
    python checks/trace_check.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from tutor.watch import tracing  # noqa: E402
from tutor.watch.agent import stream  # noqa: E402

QUESTION = "Tibetan language in schools"

TREE = """Expected trace tree for one question:

  tibet_watch                              (agent run, metadata.question)
   +- ChatMelong                           step 1: which tool to call
   |   +- melong.http                        one span PER ATTEMPT
   +- search_tibet_news                    (tool)
   |   +- translate_query.to_bo            query -> Tibetan
   |   |   +- melong.http
   |   +- rss.search                       hits + by_source breakdown
   |   +- gdelt.search
   |   +- screen                           candidates -> kept
   |       +- relevance_judge[n]           only for non-curated domains
   |           +- melong.http
   +- ChatMelong                           step 2
   +- summarize_article                    (tool)
   |   +- fetch_article                    chars, words, error
   |   +- summarise_bilingual
   |       +- summarise.en                 summary in the source language
   |       |   +- melong.http
   |       +- translate.to_bo              then translated
   |           +- melong.http
   +- ...
"""


def main():
    tracing.configure()
    print(tracing.status_line())
    print(f"  LANGSMITH_TRACING = {os.environ.get('LANGSMITH_TRACING') or '(unset)'}")
    print(f"  LANGSMITH_API_KEY = {'set' if os.environ.get('LANGSMITH_API_KEY') else '(unset)'}")
    print(f"  LANGSMITH_PROJECT = {os.environ.get('LANGSMITH_PROJECT') or '(unset)'}\n")
    print(TREE)

    if not tracing.enabled():
        print("Tracing is off, so this run only proves the decorators are inert.")
        print("To enable, add to the repo-root .env:\n")
        print("    LANGSMITH_TRACING=true")
        print("    LANGSMITH_API_KEY=lsv2_pt_...    # smith.langchain.com -> Settings -> API Keys")
        print("    LANGSMITH_PROJECT=munsel\n")

    print(f"Running one question to confirm nothing raises: {QUESTION!r}")
    steps = 0
    articles = []
    for event in stream(QUESTION, use_gdelt=False):
        if event["type"] == "action":
            steps += 1
            print(f"  [{steps}] {event['tool']}({event['input'][:50]!r})")
        elif event["type"] == "done":
            articles = event["results"]

    print(f"\ncompleted: {steps} tool calls, {len(articles)} articles")
    if tracing.enabled():
        project = os.environ.get("LANGSMITH_PROJECT")
        print(f"\nTrace sent. Open https://smith.langchain.com and select project '{project}'.")
        print("Filter by name 'tibet_watch', or search metadata.question.")
    else:
        print("\nNo trace sent (tracing off). Pipeline itself is unaffected.")
    return 0 if steps > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
