"""
Interactive CLI chat with Monlam AI's "melong" chat model.

Usage:
    conda activate monlam
    python menlong_chat.py

Type your message and press Enter. Type /exit (or Ctrl+C) to quit,
/reset to clear conversation history, /system <text> to set a system prompt.

Requires MONLAMAI_STUDIO=<api-key> in a .env file at the repo root.
"""

import json
import os
import sys

import requests
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()

BASE_URL = "https://api-v1.monlamai.studio"
CHAT_STREAM_URL = f"{BASE_URL}/api/v1/ai/chat/stream"
MODEL_NAME = "melong"

API_KEY = os.environ.get("MONLAMAI_STUDIO")
if not API_KEY:
    raise SystemExit("MONLAMAI_STUDIO is not set in .env — add your Monlam API key first.")

HEADERS = {"X-API-Key": API_KEY}


def stream_reply(messages):
    """POST the conversation and stream the assistant's reply as it arrives."""
    resp = requests.post(
        CHAT_STREAM_URL,
        headers=HEADERS,
        json={
            "messages": messages,
            "model_name": MODEL_NAME,
            "temperature": 0.7,
            "max_tokens": 1024,
        },
        stream=True,
        timeout=120,
    )
    resp.raise_for_status()

    reply = ""
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

        if event.get("type") == "usage":
            continue  # billing metadata event, no content

        choices = event.get("choices") or []
        if choices:
            delta = choices[0].get("delta", {})
            content = delta.get("content")
            if content:
                print(content, end="", flush=True)
                reply += content

    print()
    return reply


def main():
    print(f"Monlam AI Chat — model: {MODEL_NAME}")
    print("Commands: /exit to quit, /reset to clear history, /system <text> to set a system prompt.\n")

    messages = []

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break

        if not user_input:
            continue

        if user_input in ("/exit", "/quit"):
            print("Bye.")
            break

        if user_input == "/reset":
            messages = []
            print("(conversation history cleared)\n")
            continue

        if user_input.startswith("/system "):
            system_text = user_input[len("/system "):].strip()
            messages = [m for m in messages if m["role"] != "system"]
            messages.insert(0, {"role": "system", "content": system_text})
            print(f"(system prompt set: {system_text})\n")
            continue

        messages.append({"role": "user", "content": user_input})

        print("Melong: ", end="", flush=True)
        try:
            reply = stream_reply(messages)
        except requests.HTTPError as exc:
            print(f"\n[error] HTTP {exc.response.status_code}: {exc.response.text[:300]}")
            messages.pop()  # drop the failed user turn so history stays clean
            continue
        except Exception as exc:
            print(f"\n[error] {exc}")
            messages.pop()
            continue

        messages.append({"role": "assistant", "content": reply})
        print()


if __name__ == "__main__":
    main()
