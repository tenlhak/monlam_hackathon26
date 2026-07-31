"""Follow-up to probe_melong_agent.py — does melong actually *attend* to long input?

The first probe only showed that the server accepts ~32k tokens without
erroring. That is not the same as the model reading them: a server can
silently truncate an over-long prompt and answer from what is left. Since
"whole articles fit in one call" decides whether we need a map-reduce
summarisation chain, it is worth confirming properly.

Method: hide a distinctive fact in the padding at a known depth, ask for it
back, and compare the reported prompt_tokens against what we sent. A needle
recalled at depth 0.1 and 0.5 of a 32k prompt means the context is real.

Usage:
    conda activate monlam
    python probe_melong_longcontext.py
"""

import os
import sys

import requests
from dotenv import load_dotenv

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()

CHAT_URL = "https://api-v1.monlamai.studio/api/v1/ai/chat"
MODEL_NAME = "melong"

API_KEY = os.environ.get("MONLAMAI_STUDIO")
if not API_KEY:
    raise SystemExit("MONLAMAI_STUDIO is not set in .env — add your Monlam API key first.")

HEADERS = {"X-API-Key": API_KEY}

NEEDLE = "The Losar festival committee in Dharamsala allocated exactly 47,300 rupees for butter lamps."
QUESTION = "How many rupees did the Losar festival committee in Dharamsala allocate for butter lamps?"
FILLER = "The quick brown fox jumps over the lazy dog. "

total_cost = 0.0


def build_haystack(approx_tokens, depth):
    """Padding of roughly `approx_tokens`, with the needle buried at `depth`."""
    padding = FILLER * (approx_tokens * 4 // len(FILLER))
    cut = int(len(padding) * depth)
    return padding[:cut] + "\n\n" + NEEDLE + "\n\n" + padding[cut:]


def run(approx_tokens, depth):
    global total_cost
    haystack = build_haystack(approx_tokens, depth)
    messages = [{
        "role": "user",
        "content": f"{haystack}\n\nOne fact is hidden in the text above. {QUESTION} Answer with the number only.",
    }]

    resp = requests.post(
        CHAT_URL,
        headers=HEADERS,
        json={"messages": messages, "model_name": MODEL_NAME, "temperature": 0.0, "max_tokens": 32},
        timeout=180,
    )
    if resp.status_code != 200:
        print(f"  ~{approx_tokens:>6} tok  depth {depth}  HTTP {resp.status_code}: {resp.text[:120]}")
        return

    data = resp.json()
    answer = (data.get("response") or "").strip()
    prompt_tokens = data.get("prompt_tokens")
    cost = data.get("cost") or 0
    total_cost += cost

    found = "47,300" in answer or "47300" in answer
    # A prompt_tokens far below what we sent is the signature of silent truncation.
    sent_estimate = len(haystack) // 4
    truncated = prompt_tokens is not None and prompt_tokens < sent_estimate * 0.6

    flag = "RECALLED" if found else "MISSED  "
    warn = "  <-- server truncated the prompt" if truncated else ""
    print(f"  ~{approx_tokens:>6} tok  depth {depth}  {flag}  "
          f"prompt_tokens={prompt_tokens} (sent ~{sent_estimate})  cost={cost}{warn}")
    if not found:
        print(f"                          replied: {answer[:80]!r}")


def main():
    print(f"Needle-in-haystack against {MODEL_NAME}\n")
    for approx_tokens in (8000, 16000, 32000):
        for depth in (0.1, 0.5):
            run(approx_tokens, depth)
    print(f"\ntotal cost for this probe: {total_cost}")


if __name__ == "__main__":
    main()
