"""Is this article actually about the Tibetan cause?

Two stages, because they have very different costs. The prefilter is free and
resolves most items: anything from a curated Tibet outlet is in, anything
matching the veto list is out, anything with no Tibet signal at all is out.
Only genuinely borderline items reach the model.

The judge is batched — fifteen candidates in one call rather than fifteen calls
— which is affordable precisely because melong has a 32k context. A binary
judgement over a title and a snippet is also a much easier task for it than an
open-ended one, which is what makes a cheap filter trustworthy.
"""

from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

from langchain_core.messages import HumanMessage, SystemMessage

from .parsing import content_tokens, repair_json
from .tracing import traceable
from .sources.registry import (
    IN_SCOPE_TERMS,
    OUT_OF_SCOPE_TERMS,
    RELEVANCE_RUBRIC,
    TRUSTED_DOMAINS,
)

JUDGE_SYSTEM = f"""You screen news articles for a Tibet research service.

{RELEVANCE_RUBRIC}

You will be given a numbered list of articles. For each one, decide whether it
is about the Tibetan cause.

Reply with ONLY a JSON array, one object per article, in the same order:
[{{"n": 1, "relevant": true, "score": 0.9, "reason": "short reason"}}]

No other text. score is your confidence from 0 to 1."""


def _domain(url: str) -> str:
    host = (urlparse(url or "").netloc or "").lower()
    return host[4:] if host.startswith("www.") else host


def prefilter(url: str, title: str, snippet: str = "") -> Tuple[str, str]:
    """Free triage. Returns (verdict, reason) where verdict is pass/veto/unsure."""
    haystack = f"{title} {snippet}".lower()

    for term in OUT_OF_SCOPE_TERMS:
        if term in haystack:
            return "veto", f"matched out-of-scope term '{term}'"

    if _domain(url) in TRUSTED_DOMAINS:
        return "pass", "published by a curated Tibet source"

    for term in IN_SCOPE_TERMS:
        if term in haystack:
            return "unsure", f"mentions '{term}' but source is not curated"

    return "veto", "no Tibet-related signal in title or snippet"


def judge(model, items: List[Dict], batch_size: int = 15) -> Dict[str, Dict]:
    """Ask melong to rule on borderline items. Keyed by doc id.

    Anything the model fails to rule on is left out rather than defaulted, so
    the caller decides how to treat an unjudged item.
    """
    verdicts: Dict[str, Dict] = {}

    for start in range(0, len(items), batch_size):
        batch = items[start:start + batch_size]
        listing = "\n".join(
            f"{i + 1}. [{it['source']}] {it['title']}"
            + (f"\n   {it.get('snippet', '')[:220]}" if it.get("snippet") else "")
            for i, it in enumerate(batch)
        )
        reply = model.invoke(
            [SystemMessage(content=JUDGE_SYSTEM), HumanMessage(content=listing)],
            config={"run_name": f"relevance_judge[{len(batch)}]",
                    "tags": ["watch", "relevance"]},
        )
        parsed = repair_json(reply.content if hasattr(reply, "content") else str(reply))
        if not isinstance(parsed, list):
            continue

        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            try:
                index = int(entry.get("n", 0)) - 1
            except (TypeError, ValueError):
                continue
            if not 0 <= index < len(batch):
                continue
            verdicts[batch[index]["id"]] = {
                "relevant": bool(entry.get("relevant")),
                "score": _score(entry.get("score")),
                "reason": str(entry.get("reason") or "")[:200],
            }

    return verdicts


def _score(value) -> Optional[float]:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return None


@traceable(run_type="chain", name="screen",
           process_inputs=lambda i: {"candidates": len(i.get("docs") or [])},
           process_outputs=lambda o: {"kept": len(o or [])})
def screen(model, docs: List) -> List:
    """Apply both stages to Doc objects in place, returning the relevant ones.

    Ordered so curated sources sort above judged web results, which is what the
    agent should see first.
    """
    borderline = []
    for doc in docs:
        verdict, reason = prefilter(doc.url, doc.title, doc.snippet)
        if verdict == "pass":
            doc.relevant, doc.relevance_score, doc.why_relevant = True, 1.0, reason
        elif verdict == "veto":
            doc.relevant, doc.relevance_score, doc.why_relevant = False, 0.0, reason
        else:
            borderline.append({
                "id": doc.id, "title": doc.title,
                "snippet": doc.snippet, "source": doc.source,
            })

    if borderline:
        verdicts = judge(model, borderline)
        for doc in docs:
            ruling = verdicts.get(doc.id)
            if ruling is None:
                continue
            doc.relevant = ruling["relevant"]
            doc.relevance_score = ruling["score"]
            doc.why_relevant = ruling["reason"]

    # An unjudged borderline item stays out of the result set, but keeps its
    # None relevance so it is distinguishable from a confident rejection.
    keep = [d for d in docs if d.relevant]
    # Two passes, relying on sort stability: newest first, then confidence
    # first. Undated items fall to the back of their confidence band.
    keep.sort(key=lambda d: d.published_at or "", reverse=True)
    keep.sort(key=lambda d: d.relevance_score or 0.0, reverse=True)
    return keep


def query_score(doc, tokens: List[str]) -> float:
    """How well this article matches the user's actual question.

    Necessary because relevance_score answers a different question. Every
    curated source scores 1.0 on "is this about the Tibetan cause", so it cannot
    discriminate at all — rank by it alone and a question about boarding schools
    returns whatever the busiest feed published most recently.
    """
    title = (doc.title or "").lower()
    snippet = (doc.snippet or "").lower()

    score = 0.0
    for token in set(tokens):
        if token in title:
            score += 2.0
        elif token in snippet:
            score += 1.0

    # The outlet's own search engine already judged this a match; a recency-feed
    # hit only matched one loose token locally.
    if doc.found_via == "rss-search":
        score += 1.5
    return score


def rank(docs: List, query_en: str, query_bo: str = "", per_source: int = 2) -> List:
    """Order screened docs by fit to the question, then spread across outlets.

    The per-source cap matters for the result the user sees: without it a single
    high-volume feed fills every slot, and three articles from one outlet is a
    worse answer than three from three.
    """
    tokens = content_tokens(query_en) + content_tokens(query_bo)
    for doc in docs:
        doc.query_score = query_score(doc, tokens)

    ordered = sorted(
        docs,
        key=lambda d: (-(getattr(d, "query_score", 0.0)),
                       -(d.relevance_score or 0.0),
                       _date_desc(d)),
    )

    # Greedy pass that holds back extra articles from an over-represented
    # outlet, then appends them once every other source has had a turn.
    picked, held, seen = [], [], {}
    for doc in ordered:
        count = seen.get(doc.source, 0)
        if count < per_source:
            picked.append(doc)
            seen[doc.source] = count + 1
        else:
            held.append(doc)
    return picked + held


def _date_desc(doc) -> str:
    """Sort key placing newer dates first, undated last."""
    return "" if not doc.published_at else "".join(
        str(9 - int(c)) if c.isdigit() else c for c in doc.published_at
    )
