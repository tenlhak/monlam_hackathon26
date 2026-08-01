"""Article download and boilerplate removal.

trafilatura does the hard part. What this module adds is encoding care: when a
server omits a charset, requests falls back to ISO-8859-1 and Tibetan script
silently turns to mojibake — which then fails language detection and produces a
summary in the wrong language. Cheap to guard against, very confusing to debug.
"""

import json
from datetime import datetime, timezone
from typing import Dict

import trafilatura

from .net import get
from .parsing import detect_language
from .tracing import traceable

# Generous ceiling. melong takes ~32k tokens, but Tibetan tokenises less
# efficiently than Latin, so cap by characters well inside that.
MAX_CHARS = 40_000


def _decoded(resp) -> str:
    """Body as text, with a sane encoding guess when the server gives none."""
    declared = (resp.encoding or "").lower()
    if not declared or declared == "iso-8859-1":
        # requests' default guess for a missing charset; almost always wrong
        # for these sites, and destructive for Tibetan.
        resp.encoding = resp.apparent_encoding or "utf-8"
    return resp.text


@traceable(run_type="retriever", name="fetch_article",
           process_outputs=lambda o: {"chars": (o or {}).get("char_count"),
                                      "words": (o or {}).get("word_count"),
                                      "error": (o or {}).get("error")})
def fetch_article(url: str) -> Dict:
    """Download and extract one article.

    Always returns a dict; `error` is set rather than raised so a paywall or a
    404 costs the agent one observation instead of the whole run.
    """
    result = {
        "url": url, "text": "", "title": "", "published_at": None,
        "word_count": 0, "char_count": 0, "error": None,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }

    resp = get(url, timeout=40, retries=1)
    if resp is None:
        result["error"] = "could not be downloaded (blocked, offline or not found)"
        return result

    extracted = trafilatura.extract(
        _decoded(resp),
        output_format="json",
        with_metadata=True,
        include_comments=False,
        include_tables=False,
        favor_precision=True,
    )
    if not extracted:
        result["error"] = "no article text could be extracted from the page"
        return result

    try:
        data = json.loads(extracted)
    except json.JSONDecodeError:
        result["error"] = "extraction returned malformed output"
        return result

    text = (data.get("text") or "").strip()
    if len(text) < 200:
        result["error"] = f"extracted text too short to summarise ({len(text)} chars)"
        return result

    result["text"] = text[:MAX_CHARS]
    result["title"] = (data.get("title") or "").strip()
    result["published_at"] = data.get("date")
    result["char_count"] = len(result["text"])
    # Tibetan does not delimit words with spaces, so splitting on whitespace
    # undercounts it by an order of magnitude. Approximate from characters
    # instead, or a 1,500-word Tibetan article reads as "77 words".
    if detect_language(text) == "bo":
        result["word_count"] = max(1, len(result["text"]) // 6)
    else:
        result["word_count"] = len(result["text"].split())
    return result
