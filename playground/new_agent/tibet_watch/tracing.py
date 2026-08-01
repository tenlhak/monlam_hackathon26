"""LangSmith tracing, switched on entirely by environment variables.

Set these in the repo-root .env and everything below activates:

    LANGSMITH_TRACING=true
    LANGSMITH_API_KEY=lsv2_pt_...
    LANGSMITH_PROJECT=tibet-watch

With them unset, every decorator here is a no-op and nothing is sent anywhere.

Two things this module adds beyond flipping the env flag:

  * melong's individual HTTP calls become spans, so the format-retry loop
    inside ChatMelong._generate is visible. Without it, a step that took three
    attempts to produce parseable JSON looks identical in the trace to one that
    worked first time — which is precisely the failure this project needs to be
    able to see.

  * the non-model pipeline stages (feed search, screening, extraction) become
    spans too, so a slow query can be attributed to one stalling feed rather
    than guessed at.

SECURITY: spans must never carry the Monlam API key. Anything decorated here
that touches credentials passes a process_inputs function that strips them, and
`redact_llm_inputs` is the shared one for that.
"""

import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from langsmith import traceable
from langsmith import utils as ls_utils

__all__ = ["traceable", "configure", "enabled", "status_line",
           "redact_llm_inputs", "current_parent", "child_of"]

DEFAULT_PROJECT = "tibet-watch"

TRUTHY = ("1", "true", "yes", "on")


def _clear_langsmith_env_cache() -> None:
    """Drop langsmith's memoised view of the environment.

    langsmith.utils.get_env_var is lru_cached, so it reads each variable once
    and never again. Because we load .env at call time — after langsmith has
    already been imported — settings applied here would otherwise be ignored
    and tracing would silently stay off. Found by testing configure(), not by
    reading the docs.
    """
    for name in ("get_env_var", "get_tracer_project"):
        fn = getattr(ls_utils, name, None)
        if fn is not None and hasattr(fn, "cache_clear"):
            fn.cache_clear()


def configure(project: Optional[str] = None) -> bool:
    """Load tracing settings from .env. Returns whether tracing is on.

    Safe to call repeatedly; the app and the check scripts both call it.
    """
    load_dotenv()
    # tibet_watch/ -> new_agent/ -> playground/ -> repo root
    root_env = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")
    load_dotenv(os.path.abspath(root_env))

    if _requested():
        # LangChain still reads the older LANGCHAIN_* names in some code paths;
        # setting both means tracing works whichever one gets checked.
        os.environ["LANGSMITH_TRACING"] = "true"
        os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
        os.environ.setdefault("LANGSMITH_PROJECT", project or DEFAULT_PROJECT)
        os.environ.setdefault("LANGCHAIN_PROJECT", os.environ["LANGSMITH_PROJECT"])
        if os.environ.get("LANGSMITH_API_KEY"):
            os.environ.setdefault("LANGCHAIN_API_KEY", os.environ["LANGSMITH_API_KEY"])

    _clear_langsmith_env_cache()
    return enabled()


def _requested() -> bool:
    flag = (os.environ.get("LANGSMITH_TRACING")
            or os.environ.get("LANGCHAIN_TRACING_V2") or "").strip().lower()
    return flag in TRUTHY


def _has_key() -> bool:
    return bool(os.environ.get("LANGSMITH_API_KEY") or os.environ.get("LANGCHAIN_API_KEY"))


def enabled() -> bool:
    """True when traces will actually be sent.

    Reads the environment directly rather than asking langsmith, whose own
    check is memoised and can be stale right after configure().
    """
    return _requested() and _has_key()


def status_line() -> str:
    """One line describing tracing state, for startup logs and check scripts."""
    if enabled():
        return f"LangSmith tracing ON -> project '{os.environ.get('LANGSMITH_PROJECT')}'"
    if _requested():
        return "LangSmith tracing requested but LANGSMITH_API_KEY is missing — traces will not be sent"
    return "LangSmith tracing OFF (set LANGSMITH_TRACING=true and LANGSMITH_API_KEY to enable)"


def current_parent():
    """The active run, so work handed to another thread stays attached to it.

    @traceable tracks the current run in a context variable, and a
    ThreadPoolExecutor worker starts with a fresh context. Without passing the
    parent across explicitly, every concurrently-fetched feed and article
    appears as a detached top-level run — which is exactly the part of the
    pipeline you most want to see nested and timed.

    Pair with: fn(..., langsmith_extra={"parent": current_parent()})
    """
    try:
        from langsmith import get_current_run_tree
        return get_current_run_tree()
    except Exception:  # noqa: BLE001 - tracing must never break the crawl
        return None


def child_of(parent) -> Dict[str, Any]:
    """langsmith_extra kwarg for a traceable called on a worker thread."""
    return {"parent": parent} if parent is not None else {}


def redact_llm_inputs(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """Strip credentials and bulk from a traced call's inputs.

    `self` carries the API key on the model instance, and the message list is
    already visible on the parent LLM run, so the span records shape only.
    """
    messages = inputs.get("api_messages") or []
    roles = [m.get("role") for m in messages if isinstance(m, dict)]
    return {
        "message_count": len(messages),
        "roles": roles,
        "max_tokens": inputs.get("max_tokens"),
    }


def redact_http_output(output: Any) -> Dict[str, Any]:
    """Record the reply and its billing metadata, not the raw response object."""
    try:
        text, meta = output
    except (TypeError, ValueError):
        return {"output": str(output)[:500]}
    return {
        "reply": (text or "")[:2000],
        "reply_chars": len(text or ""),
        **{k: v for k, v in (meta or {}).items()},
    }
