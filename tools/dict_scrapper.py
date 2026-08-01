"""Turn a scanned Tibetan dictionary PDF into a JSONL knowledge base.

Built for Goldstein's *English-Tibetan Dictionary of Modern Tibetan*, which is a
511-page scan: its embedded text layer holds the English and the Wylie example
sentences but contains zero Tibetan Unicode, so the Tibetan script can only come
from OCR.

The work is split into two stages on purpose:

  ocr    render each page and send it to Monlam OCR, caching the full JSON
         response to disk. Billed per page, so it is done once and never
         repeated.
  parse  read the cache and emit entries as JSONL. Free and instant, so the
         parser can be re-run as often as it takes to get right.

Keeping them apart matters: a full OCR pass over 511 pages costs real money and
several minutes, while the parser will need many attempts.

The response's `text` field is unusable for a two-column dictionary — the model
interleaves the columns, so a single entry arrives shredded across the page and
its Tibetan ends up next to some other headword. The response also carries a
pixel bounding box per word under `coordinates.textAnnotations`, and that is
authoritative. Sorting those boxes into columns, then lines, then left to right
reconstructs the page as printed, which is what makes entry parsing possible at
all. See `reflow`.

Usage:
    conda activate monlam

    # OCR a range of pages into the cache (resumable — reruns skip cached pages)
    python dict_scrapper.py ocr --pdf ../../t_tutor/dokumen.pub_...pdf --pages 55-70

    # Parse whatever is cached into JSONL
    python dict_scrapper.py parse --pdf ../../t_tutor/dokumen.pub_...pdf --out goldstein.jsonl

    # Both, for a quick sample
    python dict_scrapper.py all --pdf ... --pages 55-70 --out sample.jsonl

    # What is cached and what it cost
    python dict_scrapper.py stats --pdf ...

Requires MONLAMAI_STUDIO=<api-key> in the .env at the repo root.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, Iterator, List, Optional

import fitz  # PyMuPDF
import requests
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent.parent / ".env")

OCR_URL = "https://api-v1.monlamai.studio/api/v1/ocr/single-page"
CACHE_ROOT = HERE / ".cache"

# The response schema is loosely typed (additionalProperties: true), so the text
# field is looked up by trying the names the API has been seen to use.
TEXT_KEYS = ("text", "extracted_text", "content", "ocr_text", "recognized_text")

TIBETAN = re.compile(r"[ༀ-࿿]+(?:[ༀ-࿿\s]*[ༀ-࿿])?")
PHONETIC = re.compile(r"/([^/\n]{1,60})/")

# Goldstein's part-of-speech abbreviations. va/vi are voluntary and involuntary
# verbs, h./vo. are honorific and ordinary registers.
POS_TAGS = ("va.", "vi.", "n.", "adj.", "adv.", "iso.", "h.", "vo.", "p.n.", "neg.")

# A headword sits at the start of an entry: lowercase English, possibly
# multi-word, hyphenated or slash-separated ("cuff link", "skill/quality").
#
# What follows it is the signal that it really is a headword rather than an
# ordinary word beginning a wrapped line. Requiring a comma or part-of-speech
# tag alone was too strict and missed roughly a third of entries — many run
# straight into the Tibetan or the phonetics, as in "crumbs /phaqche/" and
# "crude behavior སྤྱོད་པ་". Requiring nothing at all would swallow continuation
# lines like "painting ri mo theb chag". These are the discriminating cases.
HEADWORD = re.compile(
    r"^(?P<word>[a-z][a-z'’\-]*(?:[ /][a-z][a-z'’\-]*){0,3})"
    r"(?=\s*[ༀ-࿿]"                                       # runs into Tibetan
    r"|\s*/"                                              # runs into /phonetics/
    r"|,"                                                 # "crush, 1. va."
    r"|\s+(?:\d\.|see:|see\b|va\.|vi\.|n\.|adj\.|adv\.|iso\.|h\.|vo\.|p\.n\.)"
    r")",
)


class OcrError(RuntimeError):
    pass


# --------------------------------------------------------------------- helpers


def api_key() -> str:
    key = (os.environ.get("MONLAMAI_STUDIO") or "").strip()
    if not key:
        raise SystemExit("MONLAMAI_STUDIO is not set. Add it to the .env at the repo root.")
    return key


def cache_dir(pdf: Path) -> Path:
    d = CACHE_ROOT / pdf.stem[:60]
    d.mkdir(parents=True, exist_ok=True)
    return d


def page_file(pdf: Path, index: int) -> Path:
    """Cache path for one page's full OCR response, coordinates included."""
    return cache_dir(pdf) / f"page_{index:04d}.json"


def parse_pages_arg(spec: Optional[str], page_count: int) -> List[int]:
    """Turn '55-70', '3', '1,5,9-12' or None into a list of 0-based indices."""
    if not spec:
        return list(range(page_count))

    out: List[int] = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            lo, hi = part.split("-", 1)
            out.extend(range(int(lo), int(hi) + 1))
        elif part:
            out.append(int(part))
    return [p for p in out if 0 <= p < page_count]


def extract_text(payload: Dict) -> Optional[str]:
    for key in TEXT_KEYS:
        val = payload.get(key)
        if isinstance(val, str) and val.strip():
            return val
    for wrapper in ("result", "data"):
        nested = payload.get(wrapper)
        if isinstance(nested, dict):
            for key in TEXT_KEYS:
                val = nested.get(key)
                if isinstance(val, str) and val.strip():
                    return val
    return None


# ------------------------------------------------------------------ stage: ocr


def ocr_bytes(png: bytes, key: str, attempts: int = 3) -> Dict:
    """POST one page image, retrying with backoff on transient failures."""
    last = None
    for attempt in range(attempts):
        try:
            resp = requests.post(
                OCR_URL,
                headers={"X-API-Key": key},
                files={"file": ("page.png", png, "image/png")},
                data={"lang_hint": "bo"},
                timeout=180,
            )
            if resp.status_code == 200:
                return resp.json()
            last = f"HTTP {resp.status_code}: {resp.text[:200]}"
        except requests.RequestException as exc:
            last = str(exc)

        if attempt < attempts - 1:
            time.sleep(2 * (attempt + 1))

    raise OcrError(last or "unknown OCR failure")


def run_ocr(pdf: Path, pages: List[int], dpi: int, workers: int, force: bool) -> None:
    key = api_key()
    doc = fitz.open(str(pdf))

    todo = [p for p in pages if force or not page_file(pdf, p).exists()]
    skipped = len(pages) - len(todo)

    print(f"{pdf.name}: {len(pages)} page(s) requested, {skipped} already cached, {len(todo)} to OCR")
    if not todo:
        print("Nothing to do. Cache is already complete for that range.")
        return

    # Rendering uses PyMuPDF, which is not thread-safe on a shared document, so
    # pages are rasterised up front and only the HTTP calls run concurrently.
    print(f"Rendering {len(todo)} page(s) at {dpi} dpi...")
    images = {p: doc[p].get_pixmap(dpi=dpi).tobytes("png") for p in todo}
    doc.close()

    done = failed = 0
    cost = 0.0
    started = time.time()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(ocr_bytes, images[p], key): p for p in todo}
        for fut in as_completed(futures):
            page = futures[fut]
            try:
                payload = fut.result()
            except OcrError as exc:
                failed += 1
                print(f"  page {page}: FAILED — {exc}")
                continue

            # The whole payload is kept, not just `text`, because the word
            # bounding boxes are what the parser actually relies on.
            page_file(pdf, page).write_text(
                json.dumps(payload, ensure_ascii=False), encoding="utf-8"
            )

            try:
                cost += float(payload.get("cost") or 0)
            except (TypeError, ValueError):
                pass

            done += 1
            if done % 5 == 0 or done == len(todo):
                rate = done / max(time.time() - started, 1e-6)
                print(f"  {done}/{len(todo)} pages  ({rate:.1f}/s, cost so far {cost:.1f})")

    print(f"\nOCR complete: {done} succeeded, {failed} failed, cost {cost:.1f}")
    print(f"Cached in {cache_dir(pdf)}")


# ---------------------------------------------------------------- stage: parse


def cached_pages(pdf: Path) -> List[int]:
    return sorted(int(f.stem.split("_")[1]) for f in cache_dir(pdf).glob("page_*.json"))


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip(" .,;:")


NO_SPACE_BEFORE = set(",.;:)]}!?")
NO_SPACE_AFTER = set("([{")


def join_words(words: List[str]) -> str:
    """Reassemble word tokens into a line without spaces around punctuation."""
    out = ""
    for w in words:
        if out and w[:1] not in NO_SPACE_BEFORE and out[-1] not in NO_SPACE_AFTER:
            out += " "
        out += w
    return out


def reflow(payload: Dict, columns: int = 2) -> List[str]:
    """Rebuild a page's reading order from the OCR word boxes.

    The model's own `text` output interleaves the two columns, which shreds
    entries and attaches Tibetan to the wrong headword. Each word also comes
    with a pixel box, so the page can be reassembled geometrically instead:
    split into columns on the x midpoint, group into lines by y, then order
    left to right within each line.
    """
    annotations = (payload.get("coordinates") or {}).get("textAnnotations") or []
    if len(annotations) < 2:
        # No coordinates (older cache entry) — fall back to the flat text.
        return (extract_text(payload) or "").splitlines()

    width = payload.get("image_width") or 1000
    words = []
    # Index 0 is the whole-page annotation; the rest are individual words.
    for a in annotations[1:]:
        verts = (a.get("boundingPoly") or {}).get("vertices") or []
        if not verts:
            continue
        xs = [v.get("x", 0) for v in verts]
        ys = [v.get("y", 0) for v in verts]
        words.append(
            {
                "t": a.get("description", ""),
                "x": min(xs),
                "cy": sum(ys) / len(ys),
                "h": max(ys) - min(ys),
            }
        )

    if not words:
        return []

    heights = sorted(w["h"] for w in words if w["h"] > 0)
    line_gap = (heights[len(heights) // 2] if heights else 12) * 0.6

    lines: List[str] = []
    for col in range(columns):
        lo = width * col / columns
        hi = width * (col + 1) / columns
        in_col = [w for w in words if lo <= w["x"] < hi] if columns > 1 else words
        in_col.sort(key=lambda w: (w["cy"], w["x"]))

        current: List[Dict] = []
        for w in in_col:
            if current and abs(w["cy"] - current[-1]["cy"]) > line_gap:
                current.sort(key=lambda x: x["x"])
                lines.append(join_words([x["t"] for x in current]))
                current = []
            current.append(w)
        if current:
            current.sort(key=lambda x: x["x"])
            lines.append(join_words([x["t"] for x in current]))

    return lines


def _longest_nondecreasing(items: List[tuple]) -> List[tuple]:
    """Longest subsequence of (line_no, word) whose words are non-decreasing."""
    n = len(items)
    if n == 0:
        return []

    length = [1] * n
    prev = [-1] * n
    for i in range(n):
        for j in range(i):
            if items[j][1] <= items[i][1] and length[j] + 1 > length[i]:
                length[i] = length[j] + 1
                prev[i] = j

    k = max(range(n), key=lambda i: length[i])
    out = []
    while k != -1:
        out.append(items[k])
        k = prev[k]
    return out[::-1]


def split_entries(lines: List[str]) -> Iterator[tuple]:
    """Yield (headword, body) pairs from one page's reflowed lines.

    Entries are found by locating English headwords at line starts. Dictionary
    pages are alphabetical, which is used below as a sanity filter — an
    out-of-order "headword" is almost always OCR noise rather than a real entry.
    """
    lines = [ln.strip() for ln in lines]
    hits = []
    for i, line in enumerate(lines):
        m = HEADWORD.match(line)
        if m:
            hits.append((i, m.group("word").strip()))

    # Dictionary pages run alphabetically, so genuine headwords form a
    # non-decreasing sequence and OCR noise usually breaks it. Take the longest
    # such subsequence rather than scanning greedily from each start: a single
    # garbled headword mid-page truncates a greedy run and throws away
    # everything after it, which was costing two thirds of some pages.
    best = _longest_nondecreasing(hits)

    for n, (line_no, word) in enumerate(best):
        end = best[n + 1][0] if n + 1 < len(best) else len(lines)
        body = " ".join(lines[line_no:end])
        body = body[len(word):].lstrip(" ,")
        yield word, body


def parse_entry(word: str, body: str, page: int) -> Optional[Dict]:
    tibetan = [clean(t) for t in TIBETAN.findall(body)]
    tibetan = [t for t in tibetan if t]
    phonetics = [clean(p) for p in PHONETIC.findall(body)]
    pos = [t.rstrip(".") for t in POS_TAGS if re.search(rf"(?<![a-z]){re.escape(t)}", body)]

    if not tibetan and not phonetics:
        return None

    return {
        "english": word,
        "tibetan": tibetan,
        "phonetic": phonetics,
        "pos": pos,
        # Kept verbatim so the parser can be improved later without re-running OCR.
        "raw": body[:600],
        "page": page,
    }


def script_counts(text: str) -> Dict[str, int]:
    """Count characters by script, to separate OCR failures from parser failures."""
    out = {"tibetan": 0, "bengali": 0, "devanagari": 0, "other_indic": 0}
    for ch in text:
        o = ord(ch)
        if 0x0F00 <= o <= 0x0FFF:
            out["tibetan"] += 1
        elif 0x0980 <= o <= 0x09FF:
            out["bengali"] += 1
        elif 0x0900 <= o <= 0x097F:
            out["devanagari"] += 1
        elif 0x0E00 <= o <= 0x0E7F or 0x1780 <= o <= 0x17FF or 0xAC00 <= o <= 0xD7AF:
            out["other_indic"] += 1
    return out


def run_parse(
    pdf: Path,
    out: Path,
    columns: int = 2,
    min_pages: int = 1,
    raw_out: Optional[Path] = None,
) -> None:
    pages = cached_pages(pdf)
    if len(pages) < min_pages:
        raise SystemExit(f"Only {len(pages)} page(s) cached. Run the 'ocr' stage first.")

    records = []
    no_tibetan = 0
    totals = {"tibetan": 0, "bengali": 0, "devanagari": 0, "other_indic": 0}
    raw_fh = raw_out.open("w", encoding="utf-8") if raw_out else None

    for page in pages:
        payload = json.loads(page_file(pdf, page).read_text(encoding="utf-8"))
        raw_text = extract_text(payload) or ""
        lines = reflow(payload, columns)

        for k, v in script_counts(raw_text).items():
            totals[k] += v

        if raw_fh:
            # Both views are written so an entry with missing Tibetan can be
            # traced: absent in RAW means OCR never saw it, present in RAW but
            # absent in the JSONL means the parser dropped it.
            raw_fh.write(f"\n{'='*70}\nPAGE {page}\n{'='*70}\n")
            raw_fh.write("--- RAW OCR TEXT (model's own line order) ---\n")
            raw_fh.write(raw_text + "\n")
            raw_fh.write("--- REFLOWED BY COORDINATES (what the parser reads) ---\n")
            raw_fh.write("\n".join(lines) + "\n")

        for word, body in split_entries(lines):
            rec = parse_entry(word, body, page)
            if rec is None:
                no_tibetan += 1
                continue
            records.append(rec)

    if raw_fh:
        raw_fh.close()

    with out.open("w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    with_tib = sum(1 for r in records if r["tibetan"])
    print(f"pages parsed:        {len(pages)}")
    print(f"entries written:     {len(records)}")
    print(f"  with Tibetan:      {with_tib} ({100*with_tib/max(len(records),1):.0f}%)")
    print(f"  phonetic only:     {len(records)-with_tib}")
    print(f"skipped (no script): {no_tibetan}")

    # Tibetan glyphs the OCR read as some other script are lost before the
    # parser ever runs, so this ratio says whether to fix OCR or the parser.
    misread = totals["bengali"] + totals["devanagari"] + totals["other_indic"]
    seen = totals["tibetan"] + misread
    print("\nOCR script recognition (across all cached pages):")
    print(f"  read as Tibetan:   {totals['tibetan']:,}")
    print(f"  read as Bengali:   {totals['bengali']:,}")
    print(f"  read as Devanagari:{totals['devanagari']:,}")
    print(f"  other scripts:     {totals['other_indic']:,}")
    if seen:
        print(f"  => {100*totals['tibetan']/seen:.0f}% of non-Latin script was recognised as Tibetan")

    print(f"\nWritten to {out}")
    if raw_out:
        print(f"Raw + reflowed OCR text written to {raw_out}")


def run_stats(pdf: Path) -> None:
    pages = cached_pages(pdf)
    doc = fitz.open(str(pdf))
    total = doc.page_count
    doc.close()

    chars = sum(len(page_file(pdf, p).read_text(encoding="utf-8")) for p in pages)
    print(f"{pdf.name}")
    print(f"  pages in pdf:   {total}")
    print(f"  pages cached:   {len(pages)} ({100*len(pages)/total:.0f}%)")
    print(f"  cached text:    {chars:,} chars")
    print(f"  cache dir:      {cache_dir(pdf)}")
    if len(pages) < total:
        print(f"  remaining OCR:  ~{(total-len(pages))*0.5:.0f} cost units")


# ------------------------------------------------------------------------ main


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    stages = ["ocr", "parse", "all", "stats"]
    # Accepted either positionally ("dict_scrapper.py all") or as a flag
    # ("--stage all"), since both read naturally and guessing wrong is annoying.
    ap.add_argument("stage", nargs="?", choices=stages, help="which stage to run")
    ap.add_argument("--stage", dest="stage_flag", choices=stages, help=argparse.SUPPRESS)
    ap.add_argument("--pdf", required=True, help="path to the dictionary PDF")
    ap.add_argument("--pages", help="page range, e.g. 55-70 or 1,5,9-12 (default: all)")
    ap.add_argument("--out", default="dictionary.jsonl", help="JSONL output path")
    ap.add_argument("--dpi", type=int, default=200, help="render resolution (default 200)")
    ap.add_argument("--workers", type=int, default=4, help="concurrent OCR requests (default 4)")
    ap.add_argument("--force", action="store_true", help="re-OCR pages already cached")
    ap.add_argument("--columns", type=int, default=2, help="page columns, for reflow (default 2)")
    ap.add_argument("--raw-out", default="raw_ocr_extracted_text.txt",
                    help="dump raw and reflowed OCR text here (default: raw_ocr_extracted_text.txt)")
    ap.add_argument("--no-raw", action="store_true", help="skip the raw text dump")
    args = ap.parse_args()

    stage = args.stage or args.stage_flag
    if not stage:
        ap.error(f"a stage is required: {', '.join(stages)} "
                 f"(e.g. 'dict_scrapper.py all --pdf ...')")
    args.stage = stage

    pdf = Path(args.pdf).expanduser().resolve()
    if not pdf.is_file():
        raise SystemExit(f"No such file: {pdf}")

    if args.stage == "stats":
        run_stats(pdf)
        return

    if args.stage in ("ocr", "all"):
        doc = fitz.open(str(pdf))
        count = doc.page_count
        doc.close()
        run_ocr(pdf, parse_pages_arg(args.pages, count), args.dpi, args.workers, args.force)

    if args.stage in ("parse", "all"):
        raw_out = None if args.no_raw else Path(args.raw_out).expanduser().resolve()
        run_parse(pdf, Path(args.out).expanduser().resolve(), args.columns, raw_out=raw_out)


if __name__ == "__main__":
    main()
