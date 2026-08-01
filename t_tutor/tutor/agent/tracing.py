"""LangSmith wiring.

LangChain traces itself, but the two most interesting parts of this system are
raw HTTP and would otherwise be holes in the trace: melong writes the actual
reply, and the Monlam dictionary decides what the reply is allowed to say.
`traced` covers those, so one chat turn is a single tree — orchestrator, each
lookup, then the generation.

Tutor and news traffic share one project and are told apart by tags. They used
to use separate projects, which does not survive both living in one process:
each module set LANGSMITH_PROJECT as a global environment variable at import
time, so whichever imported first captured the other's traces. Tags carry no
ordering and cannot collide.
"""

from __future__ import annotations

import os
from typing import Callable, List, Optional

from . import config


def configure() -> bool:
    """Enable tracing and settle on the shared project. Returns whether it is on.

    setdefault rather than assignment: any project already chosen by the
    environment wins, so importing this module can no longer redirect another
    subsystem's traces.
    """
    if not (os.environ.get("LANGSMITH_API_KEY") or "").strip():
        return False
    if (os.environ.get("LANGSMITH_TRACING") or "").lower() not in ("1", "true", "yes"):
        return False

    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ.setdefault("LANGSMITH_PROJECT", config.LANGSMITH_PROJECT)
    os.environ.setdefault("LANGCHAIN_PROJECT", os.environ["LANGSMITH_PROJECT"])
    return True


try:
    from langsmith import traceable as _traceable

    def traced(name: str, run_type: str = "chain", tags: Optional[List[str]] = None) -> Callable:
        """Decorate a plain function so it appears in the trace tree, tagged."""
        return _traceable(name=name, run_type=run_type,
                          tags=config.LANGSMITH_TAGS + list(tags or []))

except ImportError:  # tracing is optional — never break the tutor over it
    def traced(name: str, run_type: str = "chain", tags: Optional[List[str]] = None) -> Callable:
        def wrap(fn):
            return fn
        return wrap


TRACING_ENABLED = configure()
