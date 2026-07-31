"""Thin client for the Monlam AI API.

Chat, text-to-speech and speech-to-text are wired up. OCR is documented in
../../monlain_ai_doc.md and would go here too — note it reads running text
reliably but not isolated letters, so it is not usable for grading a single
traced glyph.
"""

import json
import os
from typing import Dict, Iterator, List

import requests
from dotenv import load_dotenv

BASE_URL = "https://api-v1.monlamai.studio"
CHAT_URL = f"{BASE_URL}/api/v1/ai/chat"
CHAT_STREAM_URL = f"{BASE_URL}/api/v1/ai/chat/stream"
TTS_URL = f"{BASE_URL}/api/v1/text-to-speech/"
STT_URL = f"{BASE_URL}/api/v1/speech-to-text/live"

DEFAULT_VOICE = "lhasa_female"

# The only chat model exposed by the API. Probing melong-preview, melong-2,
# melong-pro and melong-v2 all return "No active 'chat' model found".
MODEL_NAME = "melong"


class MonlamError(RuntimeError):
    pass


def _api_key() -> str:
    load_dotenv()
    # The repo root .env sits one level above t_tutor/.
    if not os.environ.get("MONLAMAI_STUDIO"):
        root_env = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
        load_dotenv(os.path.abspath(root_env))

    key = (os.environ.get("MONLAMAI_STUDIO") or "").strip()
    if not key:
        raise MonlamError(
            "MONLAMAI_STUDIO is not set. Add your Monlam API key to the .env file at the repo root."
        )
    return key


def _headers() -> Dict[str, str]:
    return {"X-API-Key": _api_key()}


def stream_chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.6,
    max_tokens: int = 800,
) -> Iterator[str]:
    """Yield assistant text deltas from the streaming chat endpoint."""
    resp = requests.post(
        CHAT_STREAM_URL,
        headers=_headers(),
        json={
            "messages": messages,
            "model_name": MODEL_NAME,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        stream=True,
        timeout=120,
    )
    if resp.status_code != 200:
        raise MonlamError(f"Monlam API returned HTTP {resp.status_code}: {resp.text[:300]}")

    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data:"):
            continue
        payload = line[len("data:"):].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            continue

        # The final event carries billing metadata rather than content.
        if event.get("type") == "usage":
            continue

        choices = event.get("choices") or []
        if choices:
            content = (choices[0].get("delta") or {}).get("content")
            if content:
                yield content


def chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.6,
    max_tokens: int = 800,
) -> str:
    """Non-streaming completion, used for short internal calls."""
    resp = requests.post(
        CHAT_URL,
        headers=_headers(),
        json={
            "messages": messages,
            "model_name": MODEL_NAME,
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        timeout=90,
    )
    if resp.status_code != 200:
        raise MonlamError(f"Monlam API returned HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json().get("response", "")


def text_to_speech(text: str, voice: str = DEFAULT_VOICE) -> str:
    """Synthesize `text` and return a URL to the audio.

    Handles single letters as well as whole phrases, which is what makes the
    Listen drill possible at level 1.
    """
    resp = requests.post(
        TTS_URL,
        headers=_headers(),
        json={"text": text, "voice_name": voice},
        timeout=90,
    )
    if resp.status_code != 200:
        raise MonlamError(f"Text-to-speech returned HTTP {resp.status_code}: {resp.text[:300]}")

    url = resp.json().get("audio_url")
    if not url:
        raise MonlamError("Text-to-speech response contained no audio_url.")
    return url


def speech_to_text(audio: bytes, language: str = "bo") -> str:
    """Transcribe recorded audio. Expects WAV bytes.

    Uses the /live endpoint, which is the fast Tibetan path. The transcript
    comes back with terminal punctuation the speaker did not say, so callers
    should compare via tutor.normalize rather than matching raw strings.
    """
    resp = requests.post(
        STT_URL,
        headers=_headers(),
        files={"file": ("recording.wav", audio, "audio/wav")},
        data={"language": language},
        timeout=90,
    )
    if resp.status_code != 200:
        raise MonlamError(f"Speech-to-text returned HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json().get("text", "")
