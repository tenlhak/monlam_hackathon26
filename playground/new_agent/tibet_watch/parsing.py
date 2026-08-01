"""Text-level plumbing between melong's plain prose and LangChain objects.

melong has neither tool calling nor constrained decoding — see
../../probe_melong_agent.py for the evidence — so every structured value has to
be recovered from free text and validated. Everything here is deterministic and
free, which is the point: it runs before we spend another API call on a retry.
"""

import json
import re
from typing import Any, Dict, List, Optional

# The Tibetan Unicode block. Script detection needs nothing more than this.
TIBETAN_BLOCK = (0x0F00, 0x0FFF)

# Pseudo-tool the model uses to end the loop. LangGraph finishes when an
# AIMessage carries no tool calls, so we unwrap this into plain content.
FINAL_ACTION = "final_answer"


def detect_language(text: str, threshold: float = 0.15) -> str:
    """Return "bo" or "en" based on how much of `text` is Tibetan script.

    Tibetan articles routinely carry English names, numbers and URLs, so this
    is a ratio over letters rather than an all-or-nothing test.
    """
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return "en"
    tibetan = sum(1 for c in letters if TIBETAN_BLOCK[0] <= ord(c) <= TIBETAN_BLOCK[1])
    return "bo" if tibetan / len(letters) >= threshold else "en"


# Word separators across both scripts. Tibetan does not delimit words with
# spaces: syllables are separated by tsheg (U+0F0B) and clauses by shad
# (U+0F0D). Splitting on whitespace alone turns a whole Tibetan phrase into one
# token that then matches nothing.
_SPLIT = re.compile(r"[\s,.;:!?()\[\]\"'‘’“”/–—"
                    r"་༌།༎༑༔]+")

_STOP = {
    "the", "a", "an", "of", "in", "on", "at", "for", "and", "or", "to", "is",
    "are", "was", "were", "be", "by", "as", "it", "its", "with", "from",
    "what", "any", "about", "latest", "recent", "news", "me", "find", "show",
    "tell", "give", "please", "there", "that", "this", "has", "have",
}


def content_tokens(query: str, min_len: int = 2) -> List[str]:
    """Content words from a query, in either script.

    min_len is 2 rather than 3 because a single Tibetan syllable is often a
    whole word — བོད (Tibet) is two codepoints plus a vowel sign.
    """
    words = [w for w in _SPLIT.split((query or "").lower()) if w]
    return [w for w in words if len(w) >= min_len and w not in _STOP]


def latin_tokens(query: str) -> List[str]:
    """Only the Latin-script content words, for backends with no Tibetan index."""
    return [t for t in content_tokens(query) if re.match(r"^[a-z0-9]", t)]


def repair_json(text: str) -> Optional[Any]:
    """Recover a JSON value from a reply that may be wrapped in chatter.

    Handles markdown fences, prose before and after the object, and trailing
    commas. The brace matching ignores the possibility of braces inside string
    values, which is fine for the flat objects an agent step actually needs.

    Doubles as our stop-sequence implementation: because it stops at the first
    balanced object, anything the model hallucinated afterwards is discarded.
    """
    if not text:
        return None
    t = text.strip()

    fence = re.search(r"```(?:json)?\s*(.*?)```", t, re.S)
    if fence:
        t = fence.group(1).strip()

    opener = min(
        (i for i in (t.find("{"), t.find("[")) if i != -1),
        default=-1,
    )
    if opener == -1:
        return None
    close = {"{": "}", "[": "]"}[t[opener]]

    depth = 0
    end = -1
    for i, ch in enumerate(t[opener:], opener):
        if ch == t[opener]:
            depth += 1
        elif ch == close:
            depth -= 1
            if depth == 0:
                end = i
                break
    if end == -1:
        return None

    candidate = re.sub(r",\s*([}\]])", r"\1", t[opener:end + 1])
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


def truncate_at(text: str, stop: Optional[List[str]]) -> str:
    """Apply stop sequences client-side; the Monlam API ignores `stop`."""
    if not text or not stop:
        return text
    cut = len(text)
    for s in stop:
        found = text.find(s)
        if found != -1:
            cut = min(cut, found)
    return text[:cut].rstrip()


def sole_param(tool: Dict[str, Any]) -> str:
    """Name of a tool's single parameter.

    Every tool in this project takes exactly one string. That constraint is
    what lets the model emit a flat {"action", "action_input"} object — the
    shape it handled 5/5 in the probe — while LangChain still receives the
    keyword dict it expects.
    """
    props = ((tool.get("function") or {}).get("parameters") or {}).get("properties") or {}
    return next(iter(props), "input")


def render_tool_contract(tools: List[Dict[str, Any]]) -> str:
    """The system-prompt block that stands in for a tools API."""
    lines = ["You have access to exactly these tools:", ""]
    for t in tools:
        fn = t.get("function") or {}
        lines.append(f"- {fn.get('name')}({sole_param(t)}): {fn.get('description', '').strip()}")

    lines += [
        "",
        "To use a tool, reply with ONLY a JSON object and no other text:",
        '{"action": "<tool name>", "action_input": "<the single argument as a string>"}',
        "",
        "When you have gathered everything you need, stop calling tools and reply with ONLY:",
        f'{{"action": "{FINAL_ACTION}", "action_input": "<your complete answer>"}}',
        "",
        "Rules:",
        "- Output the JSON object alone. No explanation, no markdown fences, no Observation line.",
        "- action_input is always a single plain string, never an object or a list.",
        "- Never invent an Observation; the real result is given back to you as the next message.",
    ]
    return "\n".join(lines)


def parse_action(text: str, tools: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Interpret a reply as a tool call or a final answer.

    Returns {"kind": "tool", "name", "args"} or {"kind": "final", "text"},
    or None when the reply is unusable and the caller should retry.
    """
    obj = repair_json(text)
    if not isinstance(obj, dict):
        return None

    action = obj.get("action")
    payload = obj.get("action_input")
    if not isinstance(action, str):
        return None

    if action == FINAL_ACTION:
        return {"kind": "final", "text": _stringify(payload) or text.strip()}

    by_name = {(t.get("function") or {}).get("name"): t for t in tools}
    tool = by_name.get(action)
    if tool is None:
        return None

    return {
        "kind": "tool",
        "name": action,
        "args": {sole_param(tool): _stringify(payload)},
    }


def _stringify(value: Any) -> str:
    """Coerce action_input to a string; models occasionally wrap it."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    # A dict or list where a string was asked for: take the single value if
    # unambiguous, else fall back to compact JSON.
    if isinstance(value, dict) and len(value) == 1:
        return _stringify(next(iter(value.values())))
    if isinstance(value, list) and len(value) == 1:
        return _stringify(value[0])
    return json.dumps(value, ensure_ascii=False)


def format_error(text: str, tools: List[Dict[str, Any]]) -> str:
    """The corrective nudge sent back after an unparseable reply."""
    names = ", ".join((t.get("function") or {}).get("name", "?") for t in tools)
    return (
        "That reply could not be parsed. Reply with ONLY a JSON object of the form "
        '{"action": "...", "action_input": "..."} and nothing else. '
        f"action must be one of: {names}, {FINAL_ACTION}."
    )
