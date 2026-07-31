"""
Run Monlam AI's OCR model over a PDF or an image and dump the extracted
text to a file.

PDFs: each page is rendered to an image (via PyMuPDF) and OCR'd separately.
Images (.jpg/.jpeg/.png): sent to OCR directly as a single page.
Either way, results are POSTed to /api/v1/ocr/single-page and the combined
text is written to <input_stem>_extracted_text.txt next to the input file.

Usage:
    conda activate monlam
    python pdf_ocr.py
    (edit INPUT_PATH below to point at your .pdf/.jpg/.jpeg/.png file)

Requires MONLAMAI_STUDIO=<api-key> in a .env file at the repo root.
"""

import json
import os
import sys
import time
from pathlib import Path

import fitz  # PyMuPDF
import requests
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()

BASE_URL = "https://api-v1.monlamai.studio"
OCR_URL = f"{BASE_URL}/api/v1/ocr/single-page"
MODEL_NAME = "monlam-ocr"

API_KEY = os.environ.get("MONLAMAI_STUDIO")
if not API_KEY:
    raise SystemExit("MONLAMAI_STUDIO is not set in .env — add your Monlam API key first.")

HEADERS = {"X-API-Key": API_KEY}

# Field names to try, in order, when pulling extracted text out of the
# response — the API's response schema is not strictly typed
# (additionalProperties: true), so this is best-effort.
TEXT_KEYS = ("text", "extracted_text", "content", "ocr_text", "recognized_text")

PDF_EXTS = {".pdf"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}

# Edit these to point at the file you want to OCR.
INPUT_PATH = r"D:\monlam_hackthon\playground\ocr\test_img2.png"
LANG_HINT = "bo"
DPI = 200  # PDF rasterization DPI (ignored for image inputs)


def render_page_png(pdf_path: str, page_index: int, dpi: int) -> bytes:
    doc = fitz.open(pdf_path)
    try:
        page = doc[page_index]
        pix = page.get_pixmap(dpi=dpi)
        return pix.tobytes("png")
    finally:
        doc.close()


def load_pages(input_path: Path, dpi: int) -> list[bytes]:
    """Return a list of page images (PNG/JPEG bytes as stored) for the input file."""
    ext = input_path.suffix.lower()
    if ext in PDF_EXTS:
        doc = fitz.open(str(input_path))
        page_count = doc.page_count
        doc.close()
        return [render_page_png(str(input_path), i, dpi) for i in range(page_count)]
    if ext in IMAGE_EXTS:
        return [input_path.read_bytes()]
    raise SystemExit(f"Unsupported file type: {ext} (expected .pdf, .jpg, .jpeg, or .png)")


def extract_text(result: dict) -> str | None:
    for key in TEXT_KEYS:
        value = result.get(key)
        if isinstance(value, str) and value.strip():
            return value
    # Some OCR APIs nest the text under a "result" or "data" object.
    for wrapper in ("result", "data"):
        nested = result.get(wrapper)
        if isinstance(nested, dict):
            for key in TEXT_KEYS:
                value = nested.get(key)
                if isinstance(value, str) and value.strip():
                    return value
    return None


def ocr_page(image_bytes: bytes, lang_hint: str, page_num: int, mime: str = "image/png") -> dict:
    ext = "jpg" if mime == "image/jpeg" else "png"
    files = {"file": (f"page_{page_num}.{ext}", image_bytes, mime)}
    data = {"lang_hint": lang_hint, "model_name": MODEL_NAME}
    resp = requests.post(OCR_URL, headers=HEADERS, files=files, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def main():
    input_path = Path(INPUT_PATH)
    if not input_path.is_file():
        raise SystemExit(f"No such file: {input_path}")

    ext = input_path.suffix.lower()
    if ext not in PDF_EXTS | IMAGE_EXTS:
        raise SystemExit(f"Unsupported file type: {ext} (expected .pdf, .jpg, .jpeg, or .png)")

    mime = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png"
    pages = load_pages(input_path, DPI)
    page_count = len(pages)

    print(f"'{input_path.name}' — {page_count} page(s), lang_hint={LANG_HINT}" + (f", dpi={DPI}" if ext in PDF_EXTS else "") + "\n")

    page_texts = []
    total_cost = 0.0

    for i, image_bytes in enumerate(pages):
        print(f"[page {i + 1}/{page_count}] sending to OCR...", end=" ", flush=True)
        t0 = time.time()
        try:
            result = ocr_page(image_bytes, LANG_HINT, i + 1, mime=mime)
        except requests.HTTPError as exc:
            print(f"\n[error] HTTP {exc.response.status_code}: {exc.response.text[:300]}")
            page_texts.append(f"[page {i + 1}] OCR failed: HTTP {exc.response.status_code}")
            continue
        elapsed = time.time() - t0

        if i == 0:
            print(f"\n  raw response (page 1, for field-name reference):\n  {json.dumps(result, ensure_ascii=False)[:1000]}\n")

        text = extract_text(result)
        cost = result.get("cost")
        latency_ms = result.get("latency_ms")
        if cost is not None:
            try:
                total_cost += float(cost)
            except (TypeError, ValueError):
                pass

        print(f"done in {elapsed:.1f}s (cost={cost}, latency_ms={latency_ms})")

        if text is None:
            print(f"  [warn] couldn't find text under known keys {TEXT_KEYS} — dumping raw JSON instead")
            text = json.dumps(result, ensure_ascii=False, indent=2)

        page_texts.append(f"--- page {i + 1} ---\n{text}")

    out_path = input_path.with_name(f"{input_path.stem}_extracted_text.txt")
    out_path.write_text("\n\n".join(page_texts) + "\n", encoding="utf-8")

    print(f"\nTotal cost: {total_cost}")
    print(f"Extracted text written to: {out_path}")


if __name__ == "__main__":
    main()
