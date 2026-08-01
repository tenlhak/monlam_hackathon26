"""Bilingual summarisation: every article ends up summarised in both languages.

The order matters. We summarise in the article's *own* language first, then
translate that summary — rather than translating the article and summarising the
translation. Two reasons: compression loss and translation loss stack if you do
it the other way round, and translating a 200-word summary is a far easier task
than translating a 4,000-word article.

Instructions are written in English even when the output must be Tibetan.
melong follows English instructions reliably (5/5 in the format probe), and an
English instruction with an explicit output-language requirement is more
dependable than an instruction written in imperfect Tibetan.
"""

from typing import Dict, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from .parsing import detect_language
from .tracing import traceable

SUMMARY_SYSTEM = """You summarise news reporting about Tibet for a research archive.

Write a factual summary in AT MOST TWO paragraphs and NEVER more than 200 words.
Cover: what happened, who is involved, where and when, and why it matters for
Tibetans. Being brief matters as much as being accurate.

Rules:
- Use ONLY information present in the article. Never add background knowledge.
- Do not invent names, dates, numbers or place names. If the article does not
  say, leave it out.
- If the article is short, the summary must be shorter still. Never pad.
- No preamble, no "This article discusses". Start with the substance.
- Write the summary in {language}.

Reply with the summary text only."""

TRANSLATE_SYSTEM = """You are a translator working between Tibetan and English.

Translate the text the user gives you into {language}. Preserve every name,
date, number and place name exactly. Do not summarise further, do not add
commentary, do not omit anything.

Reply with the translation only."""

LANGUAGE_NAMES = {"bo": "Tibetan (བོད་ཡིག)", "en": "English"}

# Tibetan tokenises far less efficiently than Latin script: the same summary
# costs roughly three times as many tokens. Budgeting one number for both
# languages silently truncated every Tibetan summary mid-word.
MAX_TOKENS = {"en": 1200, "bo": 3000}

# Sentence terminators. Tibetan ends clauses with shad (།).
TERMINATORS = ("།", ".", "!", "?", "\"", "”", "'", ")", "…")


def _looks_truncated(text: str) -> bool:
    """Did generation stop mid-sentence rather than finishing?"""
    stripped = (text or "").rstrip()
    return bool(stripped) and not stripped.endswith(TERMINATORS)


def _ask(model, system: str, content: str, language: str, label: str = "summarise") -> str:
    """One generation, retried once with a bigger budget if it was cut off.

    `label` names the span in LangSmith. Without it every internal call shows up
    as an anonymous ChatMelong run and the trace is unreadable.
    """
    budget = MAX_TOKENS.get(language, 1200)
    for _ in range(2):
        reply = model.invoke(
            [SystemMessage(content=system), HumanMessage(content=content)],
            config={"run_name": label, "tags": ["watch", label.split(".")[0]]},
            max_tokens=budget,
        )
        text = reply.content if hasattr(reply, "content") else str(reply)
        text = (text or "").strip()
        if not _looks_truncated(text):
            return text
        budget *= 2
    # Still truncated: trim back to the last complete sentence rather than
    # handing on a half-word.
    return _trim_to_sentence(text)


def _trim_to_sentence(text: str) -> str:
    cut = max((text.rfind(t) for t in TERMINATORS), default=-1)
    return text[:cut + 1].strip() if cut > 0 else text


def summarise_text(model, text: str, language: str) -> str:
    """Summarise `text` in `language` ("bo" or "en")."""
    system = SUMMARY_SYSTEM.format(language=LANGUAGE_NAMES.get(language, "English"))
    return _ask(model, system, text, language, label=f"summarise.{language}")


def translate(model, text: str, target: str) -> str:
    """Translate `text` into `target` ("bo" or "en")."""
    system = TRANSLATE_SYSTEM.format(language=LANGUAGE_NAMES.get(target, "English"))
    return _ask(model, system, text, target, label=f"translate.to_{target}")


@traceable(run_type="chain", name="summarise_bilingual",
           process_inputs=lambda i: {"chars": len(i.get("text") or ""), "hint": i.get("hint")})
def summarise_bilingual(model, text: str, hint: Optional[str] = None) -> Dict[str, str]:
    """Produce both summaries from one article body.

    `hint` is the language the source outlet publishes in; the article's own
    script wins if the two disagree, since a Tibetan outlet occasionally runs an
    English piece and vice versa.
    """
    detected = detect_language(text)
    source_language = detected if detected in ("bo", "en") else (hint or "en")

    native = summarise_text(model, text, source_language)
    other = "en" if source_language == "bo" else "bo"
    translated = translate(model, native, other) if native else ""

    summaries = {
        "source_language": source_language,
        "summary_bo": native if source_language == "bo" else translated,
        "summary_en": native if source_language == "en" else translated,
    }
    return summaries


QUERY_SYSTEM = """Translate the user's search query into Tibetan (བོད་ཡིག).

It is a short search phrase, not a sentence. Keep it short: give only the
Tibetan keywords a Tibetan news site would use. Reply with the Tibetan only,
no explanation, no transliteration, no English."""


def translate_query(model, query: str) -> str:
    """Tibetan rendering of a search query, for the Tibetan-language feeds.

    Kept separate from translate() because a query has no sentence terminator,
    so the truncation guard there would burn a retry on every call.
    """
    if not (query or "").strip():
        return ""
    reply = model.invoke(
        [SystemMessage(content=QUERY_SYSTEM), HumanMessage(content=query.strip())],
        config={"run_name": "translate_query.to_bo", "tags": ["watch", "query"]},
        max_tokens=120,
    )
    text = reply.content if hasattr(reply, "content") else str(reply)
    text = (text or "").strip()
    # If it came back in Latin script the translation failed; better to search
    # the Tibetan feeds by recency than by nonsense.
    return text if detect_language(text) == "bo" else ""


def summarise_doc(model, doc) -> Dict[str, str]:
    """Fill summary_en / summary_bo on a Doc that already has text."""
    if not doc.text:
        doc.error = doc.error or "no text to summarise"
        return {}

    result = summarise_bilingual(model, doc.text, hint=doc.language)
    doc.summary_en = result.get("summary_en") or None
    doc.summary_bo = result.get("summary_bo") or None
    doc.language = result.get("source_language") or doc.language
    return result
