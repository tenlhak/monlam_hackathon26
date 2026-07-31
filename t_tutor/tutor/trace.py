"""Grading a traced Tibetan letter.

OCR is tried first, but it only reads about 18 of the 30 consonants back
correctly and fails the same ones every time — ཆ, ཉ, ཏ, བ, ཙ, ཚ and འ come back
empty or as another script entirely, under every font tested. Relying on it
alone would leave those letters permanently unpassable no matter how well they
were drawn.

So when OCR cannot read the drawing, the shape is compared against the target
glyph instead. Both are reduced to a normalised ink mask and scored by overlap,
which is deterministic, instant, and works for every letter.
"""

import io
import os
from typing import Optional, Tuple

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

# Fonts that ship with Windows and cover Tibetan, best first.
FONT_CANDIDATES = [
    "C:/Windows/Fonts/Monlam Uni OuChan1.ttf",
    "C:/Windows/Fonts/himalaya.ttf",
    "C:/Windows/Fonts/Monlam Uni Sans Serif.ttf",
]

# Masks are compared at this resolution after being cropped and rescaled, so
# the score does not depend on where or how large the letter was drawn.
MASK_SIZE = 64

# Handwriting never lands exactly on the glyph outline, so both masks are
# thickened before comparison to allow some slack.
DILATE = 5

# Overlap above this counts as a recognisable attempt.
#
# Since the ghost is now rendered from this same font, a simulated trace of it
# scores 0.91 to 1.00 across all thirty letters even when offset by ten pixels
# and rescaled. Confusable pairs peak at 0.84 (བ against ཕ), so on those numbers
# alone 0.85 would separate perfectly.
#
# It is deliberately lower than that. Those figures come from filled glyphs,
# while a learner draws a thin twelve-pixel stroke along the glyph's centre,
# which necessarily overlaps a solid reference less. Pitching at the simulated
# optimum would reject real tracing — the failure this fallback exists to avoid.
# 0.70 keeps that margin while still rejecting the weaker confusions. Worth
# re-tuning against genuine handwriting once there is some to measure.
THRESHOLD = 0.70


def _font_path() -> Optional[str]:
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def _to_mask(img: Image.Image) -> Optional[Image.Image]:
    """Reduce an image to a normalised binary ink mask, or None if it is blank."""
    # Drawings arrive with a transparent background; flatten onto white first.
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        flat = Image.new("RGB", img.size, "white")
        flat.paste(img, mask=img.split()[-1])
        img = flat

    grey = img.convert("L")
    ink = grey.point(lambda p: 255 if p < 128 else 0, mode="L")

    box = ink.getbbox()
    if not box:
        return None

    ink = ink.crop(box).resize((MASK_SIZE, MASK_SIZE), Image.LANCZOS)
    ink = ink.point(lambda p: 255 if p > 60 else 0, mode="L")
    return ink.filter(ImageFilter.MaxFilter(DILATE))


def _count(mask: Image.Image) -> int:
    return sum(1 for p in mask.getdata() if p > 0)


def _render_target(text: str, size: int = 320) -> Optional[Image.Image]:
    """Render the target letter the way a learner would have drawn it."""
    path = _font_path()
    if not path:
        return None

    canvas = (size, size)
    img = Image.new("RGB", canvas, "white")
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(path, int(size * 0.55))

    box = draw.textbbox((0, 0), text, font=font)
    draw.text(
        ((canvas[0] - (box[2] - box[0])) / 2 - box[0],
         (canvas[1] - (box[3] - box[1])) / 2 - box[1]),
        text,
        fill="black",
        font=font,
    )
    return img


def ghost_png(text: str, size: int = 320) -> Optional[bytes]:
    """The faint letter the learner traces over, drawn exactly as it is graded.

    The browser would otherwise render the ghost in whichever Tibetan font it
    has — Noto Serif Tibetan from Google Fonts, most likely — while grading
    compares against the font installed here. Tracing one shape and being
    scored against another costs about half the overlap: ཛ scores 1.00 against
    its own glyph and 0.50 against a different font's. Serving the reference
    itself removes the mismatch, and works on machines with no Tibetan font.
    """
    path = _font_path()
    if not path:
        return None

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(path, int(size * 0.55))

    box = draw.textbbox((0, 0), text, font=font)
    draw.text(
        ((size - (box[2] - box[0])) / 2 - box[0],
         (size - (box[3] - box[1])) / 2 - box[1]),
        text,
        fill=(128, 128, 128, 90),
        font=font,
    )

    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def shape_score(drawing: bytes, target: str) -> float:
    """How closely the drawing matches the target glyph, from 0 to 1.

    Intersection over union of the two normalised masks. Returns 0 when the
    canvas is blank or the target cannot be rendered.
    """
    try:
        drawn = _to_mask(Image.open(io.BytesIO(drawing)))
    except Exception:
        return 0.0

    reference = _render_target(target)
    if drawn is None or reference is None:
        return 0.0

    wanted = _to_mask(reference)
    if wanted is None:
        return 0.0

    intersection = _count(ImageChops.darker(drawn, wanted))
    union = _count(ImageChops.lighter(drawn, wanted))
    return intersection / union if union else 0.0


def flatten_to_white(drawing: bytes) -> bytes:
    """Composite a drawing onto a white background.

    The browser canvas exports a PNG with a transparent background. Sent as-is,
    OCR has no readable image and returns nothing for every letter, which
    silently disables it and leaves the shape comparison doing all the work.
    """
    try:
        img = Image.open(io.BytesIO(drawing))
    except Exception:
        return drawing

    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        flat = Image.new("RGB", img.size, "white")
        flat.paste(img, mask=img.split()[-1])
        img = flat
    else:
        img = img.convert("RGB")

    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def is_blank(drawing: bytes) -> bool:
    try:
        return _to_mask(Image.open(io.BytesIO(drawing))) is None
    except Exception:
        return True


def grade(drawing: bytes, target: str, ocr_matched: bool) -> Tuple[bool, str, float]:
    """Decide whether a traced letter passes.

    When OCR recognised the letter that settles it; otherwise the shape is
    compared, so the twelve letters OCR cannot read are still passable.

    Returns (correct, how_it_was_judged, shape_score).
    """
    if ocr_matched:
        return True, "ocr", 1.0

    score = shape_score(drawing, target)
    return score >= THRESHOLD, "shape", score
