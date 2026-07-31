"""Probe the Monlam `melong` chat endpoint for the capabilities an agent needs.

Answers five questions, in the order they affect the design:

  1. Does the endpoint honour structured-output params (response_format /
     guided_json)? If it does, JSON reliability stops being our problem and
     the agent can just declare a schema.
  2. Does it accept an OpenAI-style `tools` array?
  3. How much input does it take before erroring? This sets the chunk size
     for article summarisation.
  4. How reliably does it emit a flat JSON action object?  (agent design B)
  5. How reliably does it emit the ReAct text format, and does it honour a
     stop sequence so it can't fabricate its own Observation?  (design C)

Probes 1 and 2 are deliberately *behavioural*: a 200 response proves nothing,
because servers routinely accept unknown fields and ignore them. We ask for
output the prompt alone would not produce, then check what came back.

Usage:
    conda activate monlam
    python probe_melong_agent.py

Requires MONLAMAI_STUDIO=<api-key> in a .env file at the repo root.
"""

import json
import os
import re
import sys

import requests
from dotenv import load_dotenv

# Windows consoles default to a codepage that can't print Tibetan; make stdout
# tolerant so a print() never masks an otherwise-successful call as a failure.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()

BASE_URL = "https://api-v1.monlamai.studio"
CHAT_URL = f"{BASE_URL}/api/v1/ai/chat"
MODEL_NAME = "melong"

API_KEY = os.environ.get("MONLAMAI_STUDIO")
if not API_KEY:
    raise SystemExit("MONLAMAI_STUDIO is not set in .env — add your Monlam API key first.")

HEADERS = {"X-API-Key": API_KEY}

# Findings are collected rather than printed inline, so the summary can state
# the design consequence of each one.
findings = []


def record(probe, answer, detail):
    findings.append((probe, answer, detail))
    print(f"  -> {answer}: {detail}\n")


def chat(messages, max_tokens=256, temperature=0.0, **extra):
    """POST to the sync chat endpoint. Returns (status, parsed_json_or_None, raw_text)."""
    body = {
        "messages": messages,
        "model_name": MODEL_NAME,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    body.update(extra)
    try:
        resp = requests.post(CHAT_URL, headers=HEADERS, json=body, timeout=120)
    except Exception as exc:
        return None, None, f"exception: {exc}"
    try:
        return resp.status_code, resp.json(), resp.text
    except json.JSONDecodeError:
        return resp.status_code, None, resp.text


def reply_of(parsed):
    """The sync endpoint puts the completion in `response`."""
    return (parsed or {}).get("response", "") or ""


def repair_json(text):
    """Deterministic fixes for the ways small models wrap otherwise-valid JSON.

    Handles markdown fences, leading/trailing chatter and trailing commas. The
    brace matching is naive about braces inside strings, which is fine for the
    flat two-field objects an agent step actually needs.
    """
    if not text:
        return None
    t = text.strip()

    fence = re.search(r"```(?:json)?\s*(.*?)```", t, re.S)
    if fence:
        t = fence.group(1).strip()

    start = t.find("{")
    if start == -1:
        return None
    depth = 0
    for i, ch in enumerate(t[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                t = t[start:i + 1]
                break
    else:
        return None

    t = re.sub(r",\s*([}\]])", r"\1", t)  # trailing commas
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# Probe 1 — structured output / constrained decoding
# ---------------------------------------------------------------------------

# The prompt asks for a plain prose sentence. Any JSON in the reply therefore
# came from the schema being enforced, not from the wording of the prompt.
PROSE_PROMPT = [
    {"role": "user", "content": "What is the capital of France? Answer in one plain English sentence."}
]

CAPITAL_SCHEMA = {
    "type": "object",
    "properties": {
        "capital": {"type": "string"},
        "population_millions": {"type": "number"},
    },
    "required": ["capital", "population_millions"],
    "additionalProperties": False,
}


def probe_structured_output():
    print("[1] Structured output — does any guided-decoding param take effect?")

    variants = [
        ("response_format=json_object", {"response_format": {"type": "json_object"}}),
        ("response_format=json_schema", {"response_format": {
            "type": "json_schema",
            "json_schema": {"name": "capital", "strict": True, "schema": CAPITAL_SCHEMA},
        }}),
        ("guided_json", {"guided_json": CAPITAL_SCHEMA}),
        ("extra_body.guided_json", {"extra_body": {"guided_json": CAPITAL_SCHEMA}}),
    ]

    working = []
    for label, extra in variants:
        status, parsed, raw = chat(PROSE_PROMPT, max_tokens=128, **extra)
        text = reply_of(parsed)
        obj = repair_json(text)
        enforced = bool(obj) and "capital" in obj and "population_millions" in obj

        if status != 200:
            outcome = f"HTTP {status} — rejected: {raw[:120]}"
        elif enforced:
            outcome = f"ENFORCED — got {json.dumps(obj, ensure_ascii=False)[:100]}"
            working.append(label)
        else:
            outcome = f"ignored — replied in prose: {text[:100]!r}"
        print(f"    {label:<32} {outcome}")

    if working:
        record("structured output", "SUPPORTED",
               f"{', '.join(working)} constrains the output — declare a schema and skip the parsing tiers")
    else:
        record("structured output", "NOT SUPPORTED",
               "no guided-decoding param takes effect; JSON must be prompted, repaired and retried")


# ---------------------------------------------------------------------------
# Probe 2 — native tool calling
# ---------------------------------------------------------------------------

TOOLS_PAYLOAD = [{
    "type": "function",
    "function": {
        "name": "get_weather",
        "description": "Get the current weather in a given city.",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    },
}]


def probe_tool_calling():
    print("[2] Tool calling — is an OpenAI-style `tools` array honoured?")

    messages = [{"role": "user", "content": "What is the weather in Lhasa right now?"}]
    status, parsed, raw = chat(messages, max_tokens=128, tools=TOOLS_PAYLOAD, tool_choice="auto")

    if status != 200:
        record("tool calling", "REJECTED",
               f"HTTP {status}: {raw[:200]} — wrapper must inject tool schemas into the prompt")
        return

    keys = sorted((parsed or {}).keys())
    blob = json.dumps(parsed, ensure_ascii=False)
    has_tool_calls = "tool_call" in blob or "function_call" in blob

    print(f"    response keys: {keys}")
    if has_tool_calls:
        record("tool calling", "SUPPORTED",
               f"response carries tool-call fields — LangGraph's prebuilt agent works via bind_tools")
    else:
        record("tool calling", "IGNORED",
               f"HTTP 200 but no tool-call field (keys={keys}); reply was {reply_of(parsed)[:100]!r}")


# ---------------------------------------------------------------------------
# Probe 3 — context ceiling
# ---------------------------------------------------------------------------

def probe_context_limit():
    print("[3] Context ceiling — how much input before it errors?")

    # ~4 chars per token for Latin script. The ladder stops at the first
    # failure, so a low ceiling costs little to discover.
    filler = "The quick brown fox jumps over the lazy dog. "
    last_ok = 0
    for approx_tokens in (1000, 2000, 4000, 8000, 16000, 32000):
        padding = filler * (approx_tokens * 4 // len(filler))
        messages = [
            {"role": "user", "content": f"{padding}\n\nIgnore the text above. Reply with exactly: OK"}
        ]
        status, parsed, raw = chat(messages, max_tokens=8)

        if status == 200 and reply_of(parsed):
            print(f"    ~{approx_tokens:>6} tokens  OK")
            last_ok = approx_tokens
        else:
            print(f"    ~{approx_tokens:>6} tokens  FAILED (HTTP {status}): {raw[:160]}")
            record("context ceiling", f"~{last_ok} tokens",
                   f"failed at ~{approx_tokens}; server said: {raw[:160]}")
            return

    record("context ceiling", ">=32000 tokens",
           "no failure up to ~32k — whole articles fit, map-reduce may be unnecessary")


# ---------------------------------------------------------------------------
# Probe 4 — flat JSON action compliance
# ---------------------------------------------------------------------------

JSON_AGENT_PROMPT = """You are an agent that selects one tool to call.

Available tools:
- search_news(query): search Tibetan news sources
- fetch_article(url): download the text of an article
- summarize_article(id): summarise a downloaded article

Reply with ONLY a JSON object and nothing else, in exactly this form:
{"action": "<tool name>", "action_input": "<the single argument>"}"""

JSON_TASKS = [
    "Find recent news about Tibetan language rights.",
    "Download the article at https://www.phayul.com/2026/01/15/example/",
    "Summarise the article with id a3f9.",
    "Find news about the Dalai Lama's succession.",
    "Get the text of https://tibet.net/press-release-2026/",
]


def probe_json_action_format():
    print("[4] Flat JSON action — how often is it parseable?")

    raw_ok = repaired_ok = 0
    for task in JSON_TASKS:
        messages = [
            {"role": "system", "content": JSON_AGENT_PROMPT},
            {"role": "user", "content": task},
        ]
        _, parsed, _ = chat(messages, max_tokens=128)
        text = reply_of(parsed)

        strict = None
        try:
            strict = json.loads(text.strip())
        except (json.JSONDecodeError, AttributeError):
            pass
        loose = repair_json(text)

        valid = lambda o: isinstance(o, dict) and "action" in o and "action_input" in o
        if valid(strict):
            raw_ok += 1
        if valid(loose):
            repaired_ok += 1

        mark = "raw" if valid(strict) else ("repaired" if valid(loose) else "FAIL")
        print(f"    [{mark:>8}] {text[:90]!r}")

    n = len(JSON_TASKS)
    record("flat JSON action", f"{raw_ok}/{n} raw, {repaired_ok}/{n} repaired",
           "repair step is worth its ~20 lines" if repaired_ok > raw_ok else "output is already clean")


# ---------------------------------------------------------------------------
# Probe 5 — ReAct text format and stop sequences
# ---------------------------------------------------------------------------

REACT_PROMPT = """Answer the question using the following tools:

search_news: search Tibetan news sources for a query
fetch_article: download the text of an article at a URL

Use exactly this format:

Question: the question you must answer
Thought: what to do next
Action: the tool to use, one of [search_news, fetch_article]
Action Input: the input to the tool
Observation: the result of the action

Begin!

Question: What is the latest news about Tibetan boarding schools?
Thought:"""


def probe_react_format():
    print("[5] ReAct text format — compliance, and does `stop` halt generation?")

    compliant = 0
    for _ in range(3):
        _, parsed, _ = chat([{"role": "user", "content": REACT_PROMPT}], max_tokens=200)
        text = reply_of(parsed)
        if re.search(r"Action:\s*\S", text) and re.search(r"Action Input:\s*\S", text):
            compliant += 1
        print(f"    {text[:110]!r}")
    print(f"    -> {compliant}/3 emitted both Action: and Action Input:")

    # A model that writes its own Observation: is hallucinating tool results.
    # A working stop sequence is what prevents that.
    _, no_stop, _ = chat([{"role": "user", "content": REACT_PROMPT}], max_tokens=200)
    _, with_stop, _ = chat([{"role": "user", "content": REACT_PROMPT}], max_tokens=200,
                           stop=["\nObservation:"])
    a, b = reply_of(no_stop), reply_of(with_stop)

    fabricates = "Observation:" in a
    honoured = fabricates and "Observation:" not in b
    print(f"    without stop: fabricates Observation? {fabricates}")
    print(f"    with stop:    fabricates Observation? {'Observation:' in b}")

    if not fabricates:
        note = "does not fabricate Observation: unprompted"
    elif honoured:
        note = "fabricates Observation: but `stop` suppresses it — pass stop sequences"
    else:
        note = "fabricates Observation: and `stop` is ignored — must truncate client-side"
    record("ReAct text format", f"{compliant}/3 compliant", note)


def main():
    print(f"Probing {MODEL_NAME} at {BASE_URL}\n")

    probe_structured_output()
    probe_tool_calling()
    probe_context_limit()
    probe_json_action_format()
    probe_react_format()

    print("=" * 72)
    print("FINDINGS")
    print("=" * 72)
    for probe, answer, detail in findings:
        print(f"{probe:<22} {answer}")
        print(f"{'':<22} {detail}")


if __name__ == "__main__":
    main()
