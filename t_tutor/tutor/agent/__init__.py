"""The tutor agent: research with verified sources, then teach.

`app.py` imports `answer` and nothing else — no LangChain, no LangGraph, no
model names. Swapping the framework, or dropping back to plain melong, changes
this package and leaves the web layer untouched.
"""

from __future__ import annotations

from typing import Dict, Iterator, List

from . import loop, voice
from .tracing import TRACING_ENABLED, traced

__all__ = ["answer", "TRACING_ENABLED"]


@traced("tutor_turn", run_type="chain")
def answer(user_message: str, history: List[Dict], level: int = 1) -> Iterator[Dict]:
    """Answer one learner turn.

    Yields events rather than text so the caller can surface which sources were
    consulted before the reply streams:

        {"type": "sources", "sources": [...]}   once, before any text
        {"type": "delta",   "content": "..."}   repeatedly
    """
    facts = loop.gather_facts(user_message, history)

    yield {
        "type": "sources",
        "sources": [{"tool": f["tool"], "query": f["query"]} for f in facts],
    }

    for chunk in voice.stream(history, user_message, facts, level):
        yield {"type": "delta", "content": chunk}
