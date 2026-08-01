"""Lookup over the Goldstein dictionary extraction.

Built from a 511-page scan of Goldstein's *English-Tibetan Dictionary of Modern
Tibetan* via OCR. Two facts govern how it is used:

  * Only 24% of the 7,694 extracted entries carry Tibetan script, because the
    OCR read more Tibetan as Bengali (38,214 characters) than as Tibetan
    (28,171). Entries whose Tibetan was misread come through empty.
  * The phonetic field is present on 99% of entries but is unreliable on its
    own — the extractor takes anything between two slashes, which on a
    scrambled page catches leaked English like "/He boiled the water, 2. get/".

So only entries carrying BOTH Tibetan and a phonetic are loaded — roughly
1,788 records that corroborate each other. This is a supplementary source: the
Monlam dictionary is authoritative, this one adds coverage where it is silent.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from typing import Dict, List, Optional

DATA = os.path.join(os.path.dirname(__file__), "..", "..",
                    "playground", "ocr", "goldstein_dict.jsonl")

# A phonetic containing sentence punctuation, digits or a run of capitals is
# leaked prose or a misread, not a pronunciation: "/He boiled the water, 2.
# get/" and "/so8luun/" both come through otherwise.
BAD_PHONETIC = re.compile(r"[.,;:]|\d|[A-Z]{3,}")

TSHEG = "་"


def _norm(text: str) -> str:
    return re.sub(r"[^a-z ]+", "", (text or "").lower()).strip()


def _clean_tibetan(parts: List[str]) -> str:
    """Rejoin syllables the OCR reflow split with spaces.

    Tibetan separates syllables with a tsheg, never a space, so any space in an
    extracted string is an artefact of word-level bounding boxes.
    """
    joined = "".join(parts)
    return re.sub(r"\s+", "", joined)


def _usable(rec: Dict) -> bool:
    if not rec.get("tibetan") or not rec.get("phonetic"):
        return False

    tibetan = _clean_tibetan(rec["tibetan"])
    # Must be Tibetan script and nothing else.
    if not tibetan or not all("ༀ" <= c <= "࿿" for c in tibetan):
        return False
    # Fragments like "་ན་" survive the script test but carry no meaning; require
    # at least two real syllables and no leading tsheg.
    if tibetan.startswith(TSHEG) or len([s for s in tibetan.split(TSHEG) if s]) < 2:
        return False

    phonetic = rec["phonetic"][0].strip()
    if not phonetic or BAD_PHONETIC.search(phonetic):
        return False
    # Goldstein's phonetics are Latin with diacritics; anything from another
    # script is an OCR misread, e.g. "/nets นั น/" for "account".
    return all(c.isascii() or "À" <= c <= "ɏ" for c in phonetic)


@lru_cache(maxsize=1)
def _index() -> Dict[str, Dict]:
    path = os.path.abspath(DATA)
    if not os.path.exists(path):
        return {}

    idx: Dict[str, Dict] = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if not _usable(rec):
                continue
            key = _norm(rec["english"])
            if key and key not in idx:
                idx[key] = {
                    "english": rec["english"],
                    "tibetan": _clean_tibetan(rec["tibetan"]),
                    "phonetic": rec["phonetic"][0].strip(),
                    "page": rec.get("page"),
                    "source": "goldstein",
                }
    return idx


def lookup(query: str) -> Optional[Dict]:
    return _index().get(_norm(query))


def size() -> int:
    return len(_index())


def examples(limit: int = 5) -> List[Dict]:
    return list(_index().values())[:limit]
