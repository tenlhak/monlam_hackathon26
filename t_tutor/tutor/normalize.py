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


# Saying a consonant aloud in isolation sounds like "ka-a", and the transcript
# comes back with a trailing a-chung: ཀ is heard as ཀའ. That is correct
# pronunciation, so it must not be marked wrong. Only an appended a-chung is
# forgiven — stripping འ outright would erase the letter འ itself, which is the
# twenty-third consonant and a practice item in its own right.
A_CHUNG = "འ"


def matches(spoken: str, target: str) -> bool:
    """True when the transcript is the target, allowing for how letters sound alone."""
    if not target:
        return False

    heard = strip_punct(spoken)
    want = strip_punct(target)
    return heard == want or heard == want + A_CHUNG
