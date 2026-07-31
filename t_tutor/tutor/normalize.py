"""Comparing spoken Tibetan against a target.

Speech-to-text returns the right letters but adds terminal punctuation: saying
ཀ comes back as ཀ།, ང comes back as ང་།, and ཆུ་ comes back as ཆུ།. Comparing
raw strings would therefore mark every correct answer wrong, so punctuation and
whitespace are stripped from both sides before matching.
"""

import re

# tsheg (་), shad (།), nyis shad (༎), and the other separators STT tends to append.
PUNCTUATION = "་༌།༎༑༔"

_STRIP = re.compile(f"[{PUNCTUATION}\\s]+")


def strip_punct(text: str) -> str:
    """Remove Tibetan punctuation and whitespace so two spellings can be compared."""
    return _STRIP.sub("", text or "")


def matches(spoken: str, target: str) -> bool:
    """True when the transcript is the target once punctuation is discarded."""
    return bool(target) and strip_punct(spoken) == strip_punct(target)
