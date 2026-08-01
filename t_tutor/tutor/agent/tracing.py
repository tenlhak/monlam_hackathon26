"""LangSmith wiring.

LangChain traces itself, but the two most interesting parts of this system are
raw HTTP and would otherwise be holes in the trace: melong writes the actual
reply, and the Monlam dictionary decides what the reply is allowed to say.
`traced` covers those, so one chat turn is a single tree — orchestrator, each
lookup, then the generation.

The project is set here rather than through the global env var because
LANGSMITH_PROJECT in .env points at the tibet-watch agent; tutor runs would
otherwise land in the wrong project.
"""

from __future__ import annotations

import os
from typing import Callable

from . import config


def configure() -> bool:
    """Point LangSmith at the tutor's project. Returns whether tracing is on."""
    if not (os.environ.get("LANGSMITH_API_KEY") or "").strip():
        return False
    if (os.environ.get("LANGSMITH_TRACING") or "").lower() not in ("1", "true", "yes"):
        return False

    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_PROJECT"] = config.LANGSMITH_PROJECT
    os.environ["LANGSMITH_PROJECT"] = config.LANGSMITH_PROJECT
    return True


try:
    from langsmith import traceable as _traceable

    def traced(name: str, run_type: str = "chain") -> Callable:
        """Decorate a plain function so it appears in the trace tree."""
        return _traceable(name=name, run_type=run_type)

except ImportError:  # tracing is optional — never break the tutor over it
    def traced(name: str, run_type: str = "chain") -> Callable:
        def wrap(fn):
            return fn
        return wrap


TRACING_ENABLED = configure()
