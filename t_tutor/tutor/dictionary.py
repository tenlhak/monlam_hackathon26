"""Client for the Monlam dictionary API.

Authoritative and free ($0 per request, no credit consumption), typically
answering in 200-300ms. It is the primary source for individual words.

Two measured limits shape how it is used:

  * `mode=fts` returns HTTP 502 after ~30s. Only `fast` is usable.
  * It is a word dictionary, not a phrasebook. "hello" and "how are you"
    return nothing at all, and common adjectives come back in literary
    register. `phrasebook.py` covers that gap.
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional

import requests
from dotenv import load_dotenv

BASE = "https://api-v1.monlamai.studio/api/v1/dictionary"
TIMEOUT = 20

PAIR_EN_BO = "en-bo"
PAIR_BO_EN = "bo-en"


class DictionaryError(RuntimeError):
    pass


def _key() -> str:
    load_dotenv()
    if not os.environ.get("MONLAMAI_STUDIO"):
        root = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        load_dotenv(os.path.abspath(root))
    key = (os.environ.get("MONLAMAI_STUDIO") or "").strip()
    if not key:
        raise DictionaryError("MONLAMAI_STUDIO is not set in the repo-root .env")
    return key


def _get(path: str, params: Dict) -> Dict:
    resp = requests.get(f"{BASE}/{path}", headers={"X-API-Key": _key()},
                        params=params, timeout=TIMEOUT)
    if resp.status_code != 200:
        raise DictionaryError(f"dictionary {path} returned HTTP {resp.status_code}: {resp.text[:200]}")
    return resp.json().get("data") or {}


def search(query: str, pair: str = PAIR_EN_BO) -> Optional[Dict]:
    """Look up one word. Returns None when the dictionary has no entry.

    `limit` is fixed at 1 server-side, so there is at most one result and no
    sense disambiguation.
    """
    query = (query or "").strip()
    if not query:
        return None

    # Only `fast` is used: `fts` 502s after 30 seconds.
    data = _get("search", {"pair": pair, "q": query[:200], "mode": "fast",
                           "include": "word_id,word,explanation"})
    results = data.get("results") or []
    if not results:
        return None

    entry = results[0].get("data") or {}
    return {
        "query": query,
        "pair": pair,
        "word": entry.get("word"),
        "word_id": entry.get("word_id"),
        "explanation": (entry.get("explanation") or "").strip(),
        "source": "monlam-dictionary",
    }


def suggestions(prefix: str, pair: str = PAIR_EN_BO, limit: int = 8) -> List[str]:
    """Near-matches for a prefix, used to recover from typos.

    Note this does not rescue genuinely absent entries — "hello" returns an
    empty list, because the word simply is not in the dictionary.
    """
    prefix = (prefix or "").strip()
    if not prefix:
        return []
    data = _get("suggestions", {"pair": pair, "q": prefix[:200]})
    return [s.get("word") for s in (data.get("suggestions") or [])[:limit] if s.get("word")]


def looks_literary(explanation: str) -> bool:
    """Whether an entry needs a register caveat before a beginner is shown it.

    Two cases warrant one: a register tag, or a definition given entirely in
    Tibetan, which a learner cannot read. Simply *containing* Tibetan is not
    enough — every entry opens with the Tibetan headword, and "ཐུགས་རྗེ་ཆེ།
    thanks ཡང་ཟེར།" is a perfectly good answer.
    """
    if not explanation:
        return False

    if any(tag in explanation for tag in ("(PH)", "xx.", "soc.", "interj.")):
        return True

    # Drop the leading Tibetan headword, then see whether any English remains.
    remainder = explanation
    for token in explanation.split():
        if all("ༀ" <= c <= "࿿" for c in token):
            remainder = remainder.replace(token, " ", 1)
        else:
            break
    return not any(c.isascii() and c.isalpha() for c in remainder)
