"""Curated greetings, set phrases and colloquial words.

This exists because of a measured gap, not a hunch. The Monlam dictionary is a
word dictionary: "hello" and "how are you" return no result at all, and
`suggestions` for "hello" is empty too, because བཀྲ་ཤིས་བདེ་ལེགས། is a set
phrase rather than a headword. Separately, common adjectives come back in
literary register — "good" gives དགེ་བ་བྱ་བ ("virtuous deed"), "beautiful"
gives བཀྲ་བ ("shining, variegated").

Those are exactly the things a beginner asks for first, so this file covers
them and the dictionary covers everything else.
"""

from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from typing import Dict, List, Optional

DATA = os.path.join(os.path.dirname(__file__), "data", "phrases.json")


@lru_cache(maxsize=1)
def _load() -> Dict:
    with open(DATA, encoding="utf-8") as fh:
        return json.load(fh)


def _norm(text: str) -> str:
    """Fold to a comparable key: lowercase, no punctuation, collapsed spaces."""
    return re.sub(r"[^a-z ]+", "", (text or "").lower()).strip()


@lru_cache(maxsize=1)
def _index() -> Dict[str, Dict]:
    """Map every english form and alias onto its entry."""
    idx: Dict[str, Dict] = {}
    data = _load()

    for entry in data.get("phrases", []):
        record = {**entry, "kind": "phrase", "source": "phrasebook"}
        for key in [entry["english"]] + entry.get("aliases", []):
            idx.setdefault(_norm(key), record)
        # "goodbye (to someone leaving)" should also be findable as "goodbye".
        bare = _norm(re.sub(r"\(.*?\)", "", entry["english"]))
        idx.setdefault(bare, record)

    for entry in data.get("colloquial", []):
        idx.setdefault(_norm(entry["english"]),
                       {**entry, "kind": "colloquial", "source": "phrasebook"})

    return idx


def lookup(query: str) -> Optional[Dict]:
    """Exact or near-exact match for a phrase or colloquial word."""
    key = _norm(query)
    if not key:
        return None

    idx = _index()
    if key in idx:
        return idx[key]

    # "how do you say hello" should still find "hello".
    words = key.split()
    for n in range(len(words), 0, -1):
        for i in range(len(words) - n + 1):
            candidate = " ".join(words[i:i + n])
            if candidate in idx and len(candidate) > 2:
                return idx[candidate]
    return None


def all_phrases() -> List[Dict]:
    return list(_load().get("phrases", []))


def colloquial_for(english: str) -> Optional[Dict]:
    """The everyday form of a word the dictionary answers in literary register."""
    entry = _index().get(_norm(english))
    return entry if entry and entry.get("kind") == "colloquial" else None
