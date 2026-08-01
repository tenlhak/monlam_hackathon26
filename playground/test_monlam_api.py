"""
Smoke-test script for the Monlam AI API (https://api-v1.monlamai.studio).

Exercises every product/endpoint in the API spec (../monlam_openapi.json):
  - Chat            (sync + streaming)
  - OCR             (single-page + multi-page)
  - Speech-to-Text  (sync, streaming, live, async job)
  - Text-to-Speech  (sync, streaming, async job)

Usage:
    conda activate monlam
    python test_monlam_api.py

Note (Windows): use `conda activate monlam` rather than `conda run -n monlam`
— conda run's stdout capture uses the cp1252 codepage and crashes on the
Tibetan text in the responses. If you must use `conda run`, set
PYTHONUTF8=1 first.

Requires MONLAMAI_STUDIO=<api-key> in a .env file at the repo root.
"""

import io
import json
import os
import sys
import time
import uuid

import requests

# Windows consoles often default to a codepage (e.g. cp1252) that can't
# print Tibetan script; make stdout tolerant so a print() never masks an
# otherwise-successful API call as a failure.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from dotenv import load_dotenv
from PIL import Image, ImageDraw

load_dotenv()

BASE_URL = "https://api-v1.monlamai.studio"
API_KEY = os.environ.get("MONLAMAI_STUDIO")

if not API_KEY:
    raise SystemExit("MONLAMAI_STUDIO is not set in .env — add your Monlam API key first.")

HEADERS = {"X-API-Key": API_KEY}

results = []  # (product, endpoint, ok, detail)


def record(product, endpoint, ok, detail):
    results.append((product, endpoint, ok, detail))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {product:<16} {endpoint:<40} {detail}")


def make_test_image() -> bytes:
    """Render a simple synthetic image with text, for OCR smoke testing."""
    img = Image.new("RGB", (600, 200), color="white")
    draw = ImageDraw.Draw(img)
    draw.text((20, 80), "Hello Monlam OCR Test", fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def poll_job(get_url: str, timeout_s: int = 60, interval_s: int = 3):
    deadline = time.time() + timeout_s
    last = None
    while time.time() < deadline:
        resp = requests.get(get_url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        last = resp.json()
        if last.get("status") in ("COMPLETED", "FAILED", "SUCCESS", "FAILURE"):
            return last
        time.sleep(interval_s)
    return last


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

def test_chat_sync():
    endpoint = "POST /api/v1/ai/chat"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/ai/chat",
            headers=HEADERS,
            json={
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Say 'pong' and nothing else."},
                ],
                "model_name": "melong",
                "temperature": 0.0,
                "max_tokens": 32,
            },
            timeout=60,
        )
        ok = resp.status_code == 200
        record("Chat", endpoint, ok, f"HTTP {resp.status_code} — {resp.text[:200]}")
    except Exception as exc:
        record("Chat", endpoint, False, f"exception: {exc}")


def test_chat_stream():
    endpoint = "POST /api/v1/ai/chat/stream"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/ai/chat/stream",
            headers=HEADERS,
            json={
                "messages": [{"role": "user", "content": "Count from 1 to 3."}],
                "model_name": "melong",
                "max_tokens": 32,
            },
            stream=True,
            timeout=60,
        )
        chunks = 0
        if resp.status_code == 200:
            for line in resp.iter_lines(decode_unicode=True):
                if line:
                    chunks += 1
                if chunks > 200:
                    break
        ok = resp.status_code == 200 and chunks > 0
        record("Chat", endpoint, ok, f"HTTP {resp.status_code} — {chunks} SSE lines received")
    except Exception as exc:
        record("Chat", endpoint, False, f"exception: {exc}")


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------

def test_ocr_single_page(image_bytes: bytes):
    endpoint = "POST /api/v1/ocr/single-page"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/ocr/single-page",
            headers=HEADERS,
            files={"file": ("test.png", image_bytes, "image/png")},
            data={"lang_hint": "bo"},
            timeout=60,
        )
        ok = resp.status_code == 200
        record("OCR", endpoint, ok, f"HTTP {resp.status_code} — {resp.text[:200]}")
    except Exception as exc:
        record("OCR", endpoint, False, f"exception: {exc}")


def test_ocr_multi_page(image_bytes: bytes):
    endpoint = "POST /api/v1/ocr/multi-page"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/ocr/multi-page",
            headers=HEADERS,
            files={
                "page_1": ("page1.png", image_bytes, "image/png"),
                "page_2": ("page2.png", image_bytes, "image/png"),
            },
            data={"lang_hint": "bo"},
            timeout=60,
        )
        ok = resp.status_code == 200
        record("OCR", endpoint, ok, f"HTTP {resp.status_code} — {resp.text[:200]}")
    except Exception as exc:
        record("OCR", endpoint, False, f"exception: {exc}")


# ---------------------------------------------------------------------------
# Text-to-Speech (run first so its audio output can feed Speech-to-Text)
# ---------------------------------------------------------------------------

def test_tts_sync():
    endpoint = "POST /api/v1/text-to-speech/"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/text-to-speech/",
            headers=HEADERS,
            json={"text": "བཀྲ་ཤིས་བདེ་ལེགས།", "voice_name": "lhasa_female"},
            timeout=60,
        )
        ok = resp.status_code == 200
        record("Text-to-Speech", endpoint, ok, f"HTTP {resp.status_code} — {resp.text[:200]}")
        return resp.json() if ok else None
    except Exception as exc:
        record("Text-to-Speech", endpoint, False, f"exception: {exc}")
        return None


def test_tts_stream() -> bytes | None:
    endpoint = "POST /api/v1/text-to-speech/stream"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/text-to-speech/stream",
            headers=HEADERS,
            json={"text": "བགྱིས་བདེ་ལེགས།", "voice_name": "lhasa_female"},
            timeout=60,
        )
        ok = resp.status_code == 200 and resp.headers.get("content-type", "").startswith("audio")
        record("Text-to-Speech", endpoint, ok, f"HTTP {resp.status_code} — {len(resp.content)} bytes audio/wav")
        return resp.content if ok else None
    except Exception as exc:
        record("Text-to-Speech", endpoint, False, f"exception: {exc}")
        return None


def test_tts_jobs():
    endpoint = "POST /api/v1/text-to-speech/jobs"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/text-to-speech/jobs",
            headers=HEADERS,
            json={"text": "བགྱིས་བདེ་ལེགས།", "voice_name": "lhasa_female"},
            timeout=30,
        )
        if resp.status_code != 200:
            record("Text-to-Speech", endpoint, False, f"HTTP {resp.status_code} — {resp.text[:200]}")
            return
        job_id = resp.json().get("job_id")
        status = poll_job(f"{BASE_URL}/api/v1/text-to-speech/jobs/{job_id}")
        ok = bool(status) and status.get("status") in ("COMPLETED", "SUCCESS")
        record("Text-to-Speech", endpoint, ok, f"job_id={job_id} final_status={status.get('status') if status else 'timeout'}")
        record("Text-to-Speech", "GET /api/v1/text-to-speech/jobs/{job_id}", ok, f"result={json.dumps(status.get('result'))[:150] if status else 'n/a'}")
    except Exception as exc:
        record("Text-to-Speech", endpoint, False, f"exception: {exc}")


# ---------------------------------------------------------------------------
# Speech-to-Text
# ---------------------------------------------------------------------------

def test_stt_sync(audio_bytes: bytes):
    endpoint = "POST /api/v1/speech-to-text/"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/speech-to-text/",
            headers=HEADERS,
            files={"file": ("test.wav", audio_bytes, "audio/wav")},
            data={"language": "bo"},
            timeout=60,
        )
        ok = resp.status_code == 200
        record("Speech-to-Text", endpoint, ok, f"HTTP {resp.status_code} — {resp.text[:200]}")
    except Exception as exc:
        record("Speech-to-Text", endpoint, False, f"exception: {exc}")


def test_stt_stream(audio_bytes: bytes):
    endpoint = "POST /api/v1/speech-to-text/stream"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/speech-to-text/stream",
            headers=HEADERS,
            files={"file": ("test.wav", audio_bytes, "audio/wav")},
            data={"language": "bo"},
            stream=True,
            timeout=60,
        )
        lines = 0
        if resp.status_code == 200:
            for line in resp.iter_lines(decode_unicode=True):
                if line:
                    lines += 1
        ok = resp.status_code == 200 and lines > 0
        record("Speech-to-Text", endpoint, ok, f"HTTP {resp.status_code} — {lines} NDJSON lines")
    except Exception as exc:
        record("Speech-to-Text", endpoint, False, f"exception: {exc}")


def test_stt_live(audio_bytes: bytes):
    endpoint = "POST /api/v1/speech-to-text/live"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/speech-to-text/live",
            headers=HEADERS,
            files={"file": ("test.wav", audio_bytes, "audio/wav")},
            data={"language": "bo"},
            timeout=60,
        )
        ok = resp.status_code == 200
        record("Speech-to-Text", endpoint, ok, f"HTTP {resp.status_code} — {resp.text[:200]}")
    except Exception as exc:
        record("Speech-to-Text", endpoint, False, f"exception: {exc}")


def test_stt_jobs(audio_bytes: bytes):
    endpoint = "POST /api/v1/speech-to-text/jobs"
    try:
        resp = requests.post(
            f"{BASE_URL}/api/v1/speech-to-text/jobs",
            headers=HEADERS,
            files={"file": ("test.wav", audio_bytes, "audio/wav")},
            data={"language": "bo"},
            timeout=30,
        )
        if resp.status_code != 200:
            record("Speech-to-Text", endpoint, False, f"HTTP {resp.status_code} — {resp.text[:200]}")
            return
        job_id = resp.json().get("job_id")
        status = poll_job(f"{BASE_URL}/api/v1/speech-to-text/jobs/{job_id}")
        ok = bool(status) and status.get("status") in ("COMPLETED", "SUCCESS")
        record("Speech-to-Text", endpoint, ok, f"job_id={job_id} final_status={status.get('status') if status else 'timeout'}")
        record("Speech-to-Text", "GET /api/v1/speech-to-text/jobs/{job_id}", ok, f"result={json.dumps(status.get('result'))[:150] if status else 'n/a'}")
    except Exception as exc:
        record("Speech-to-Text", endpoint, False, f"exception: {exc}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Testing Monlam AI API at {BASE_URL}\n")

    # Chat
    test_chat_sync()
    test_chat_stream()

    # OCR
    image_bytes = make_test_image()
    test_ocr_single_page(image_bytes)
    test_ocr_multi_page(image_bytes)

    # Text-to-Speech first, to get real Tibetan audio for Speech-to-Text tests
    test_tts_sync()
    audio_bytes = test_tts_stream()
    test_tts_jobs()

    # Speech-to-Text (reuse TTS-generated audio if available)
    if audio_bytes:
        test_stt_sync(audio_bytes)
        test_stt_stream(audio_bytes)
        test_stt_live(audio_bytes)
        test_stt_jobs(audio_bytes)
    else:
        print("\n[SKIP] Speech-to-Text tests — no audio available (TTS stream test failed)")

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    by_product = {}
    for product, endpoint, ok, _ in results:
        by_product.setdefault(product, []).append(ok)
    for product, oks in by_product.items():
        print(f"{product:<18} {sum(oks)}/{len(oks)} passed")
    total_pass = sum(ok for _, _, ok, _ in results)
    print(f"\nTOTAL: {total_pass}/{len(results)} endpoints passed")


if __name__ == "__main__":
    main()
