"""Tools the orchestrator may call.

Each wraps a source in `tutor/` and adds the one thing a source has no business
knowing: how to describe itself to a model. The descriptions encode measured
behaviour — which source to reach for first, and what each is bad at — because
that routing is the difference between a tutor that teaches ཐུགས་རྗེ་ཆེ། and one
that invents སྣང་བ་འདྲེན་ཞིག.
"""

from __future__ import annotations

from typing import Dict, List

from langchain_core.tools import tool

from .. import dictionary, goldstein, phrasebook
from .tracing import traced


@tool
@traced("phrasebook_lookup", run_type="retriever")
def phrasebook_lookup(query: str) -> str:
    """Look up a greeting, set phrase, or everyday colloquial word.

    ALWAYS TRY THIS FIRST for greetings and common expressions — "hello",
    "goodbye", "how are you", "thank you", "sorry", "yes", "no", "I don't
    understand" — and for everyday words like mother, father, good, beautiful,
    big, small. The dictionary has no entry for "hello" or "how are you" at
    all, and gives literary forms for common adjectives.

    Returns the Tibetan script, spoken pronunciation, literal meaning and a
    teaching note, or "NOT FOUND".
    """
    hit = phrasebook.lookup(query)
    if not hit:
        return "NOT FOUND in phrasebook — try dictionary_lookup."
    parts = [
        f"tibetan: {hit['tibetan']}",
        f"pronunciation: {hit['phonetic']}",
    ]
    if hit.get("literal"):
        parts.append(f"literal: {hit['literal']}")
    if hit.get("note"):
        parts.append(f"note: {hit['note']}")
    parts.append("source: curated phrasebook (verified)")
    return "\n".join(parts)


@tool
@traced("dictionary_lookup", run_type="retriever")
def dictionary_lookup(query: str, direction: str = "en-bo") -> str:
    """Look up a single word in Monlam's authoritative Tibetan dictionary.

    Use for ordinary vocabulary — nouns, verbs, adjectives — that is not a
    greeting or set phrase. `direction` is "en-bo" for English to Tibetan, or
    "bo-en" to translate Tibetan the learner has written.

    This is the authoritative source: prefer it over your own memory for any
    word. It does NOT provide pronunciation, and it sometimes answers in
    literary register, which is flagged in the result when detected.
    """
    pair = dictionary.PAIR_BO_EN if direction == "bo-en" else dictionary.PAIR_EN_BO
    try:
        hit = dictionary.search(query, pair=pair)
    except dictionary.DictionaryError as exc:
        return f"DICTIONARY UNAVAILABLE: {exc}"

    if not hit:
        near = []
        try:
            near = dictionary.suggestions(query, pair=pair)
        except dictionary.DictionaryError:
            pass
        hint = f" Similar entries: {', '.join(near)}." if near else ""
        return (f"NOT FOUND in the dictionary.{hint} "
                "If this is a greeting or set phrase, use phrasebook_lookup instead.")

    out = [f"entry: {hit['explanation']}", "source: Monlam dictionary (authoritative)"]

    # The dictionary carries no pronunciation, and melong fills an empty
    # pronunciation slot with Wylie whatever the prompt says — it rendered
    # སྟོན་པ། as "stonpa", which read aloud is wrong ("tönpa"). Supplying a real
    # pronunciation when another source has one removes the vacuum rather than
    # arguing with the model about it.
    phonetic = None
    known = phrasebook.lookup(query)
    if known:
        phonetic = known.get("phonetic")
    if not phonetic:
        alt = goldstein.lookup(query)
        if alt:
            phonetic = alt.get("phonetic")

    if phonetic:
        out.append(f"pronunciation: {phonetic}")
    else:
        out.append("pronunciation: UNKNOWN — say nothing at all about how it sounds. "
                   "Do not romanise the Tibetan yourself.")
    if dictionary.looks_literary(hit["explanation"]):
        out.append("WARNING: this looks like a literary or classical sense rather than "
                   "everyday speech. Check phrasebook_lookup for a colloquial form, and "
                   "tell the learner if the form you give is bookish.")
    return "\n".join(out)


@tool
@traced("goldstein_lookup", run_type="retriever")
def goldstein_lookup(query: str) -> str:
    """Last-resort lookup in an OCR'd modern-Tibetan dictionary.

    Only use this when both phrasebook_lookup and dictionary_lookup have
    failed. The text came from a scan and is noisy: treat anything it returns
    as uncertain, and say so to the learner rather than asserting it.
    """
    hit = goldstein.lookup(query)
    if not hit:
        return "NOT FOUND in the Goldstein extraction."
    return (f"tibetan: {hit['tibetan']}\n"
            f"pronunciation: {hit['phonetic']}\n"
            "source: Goldstein OCR extraction (UNRELIABLE — hedge this, do not assert it)")


TOOLS = [phrasebook_lookup, dictionary_lookup, goldstein_lookup]


def verified_tibetan(tool_outputs: List[str]) -> List[str]:
    """Tibetan strings that came from a source rather than a model's memory.

    Used to check the finished reply: anything Tibetan that is not in here was
    invented somewhere in the chain.
    """
    found: List[str] = []
    for text in tool_outputs:
        for line in (text or "").splitlines():
            if line.startswith("tibetan:") or line.startswith("entry:"):
                run = "".join(c for c in line if "ༀ" <= c <= "࿿" or c == " ")
                for token in run.split():
                    if token:
                        found.append(token)
    return found
