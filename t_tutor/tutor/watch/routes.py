"""HTTP surface for the news feature, mounted by the tutor's app.

Reading an issue never touches a model — the crawler and composer have already
done that work and left it in SQLite. So the News tab loads instantly and stays
up even when melong is rate-limited or the OpenAI key is missing, which is the
opposite of how the chat behaves and exactly what you want from a reading view.

The heavy imports live inside the endpoints that need them. `feedparser` and
`trafilatura` are only required to *fetch* news, not to read what was already
fetched, so a tutor installed without them still serves the archive.
"""

from __future__ import annotations

import json
import os
import queue
import threading
from typing import Iterator, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import db
from .compose import SECTIONS

router = APIRouter(prefix="/api/watch", tags=["watch"])

# Running the pipeline costs real money and takes minutes. The tutor is
# multi-user — anyone who types a name is in — so the trigger is off unless the
# operator turns it on for their own machine.
ADMIN = os.environ.get("WATCH_ADMIN", "0") == "1"

_run_lock = threading.Lock()


def _conn():
    """A fresh connection per request; SQLite objects are not thread-safe."""
    return db.connect()


@router.get("/issues")
def list_issues():
    conn = _conn()
    try:
        return {"issues": [dict(r) for r in db.list_issues(conn, limit=25)]}
    finally:
        conn.close()


@router.get("/issues/{issue_id}")
def get_issue(issue_id: str):
    conn = _conn()
    try:
        issue = db.get_issue(conn, issue_id)
        if issue is None:
            raise HTTPException(status_code=404, detail=f"No issue {issue_id}.")
        # Grouped here rather than in the browser so section order is defined
        # once, next to the taxonomy it comes from.
        issue["sections"] = [
            {"section": name,
             "stories": [s for s in issue["stories"] if s["section"] == name]}
            for name in SECTIONS
            if any(s["section"] == name for s in issue["stories"])
        ]
        return issue
    finally:
        conn.close()


@router.get("/stats")
def get_stats():
    """Corpus and feed health — what the crawler has, and whether it is keeping up."""
    conn = _conn()
    try:
        feeds = conn.execute(
            "SELECT name, consecutive_failures, items_seen_total, last_success "
            "FROM feeds ORDER BY name"
        ).fetchall()
        latest = db.list_issues(conn, limit=1)
        return {
            "corpus": db.stats(conn),
            "window_ready": len(db.window(conn, days=7)),
            "feeds": [dict(f) for f in feeds],
            "unhealthy": len(db.unhealthy_feeds(conn)),
            "latest_issue": dict(latest[0]) if latest else None,
            "admin": ADMIN,
        }
    finally:
        conn.close()


class RunRequest(BaseModel):
    crawl: bool = True
    compose: bool = True
    # Off by default: GDELT's throttle adds about five minutes of pure waiting,
    # which suits a scheduled crawl and not a button.
    use_gdelt: bool = False
    window_days: int = 7
    max_stories: int = 10


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/run")
def post_run(req: RunRequest) -> StreamingResponse:
    """Crawl and compose, streaming progress. Operator-only.

    The work runs on a worker thread reporting through a queue, because the
    pipeline is synchronous and takes minutes; draining that queue is what lets
    the caller distinguish progress from a hang.
    """
    if not ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Refreshing the news is operator-only. Set WATCH_ADMIN=1 to enable it.",
        )

    def events() -> Iterator[str]:
        # Belt and braces with the caller's disabled button: two runs would
        # contend for the same SQLite writer and each spend real money.
        if not _run_lock.acquire(blocking=False):
            yield _sse({"type": "error", "message": "A run is already in progress."})
            return

        messages: "queue.Queue" = queue.Queue()
        DONE = object()
        result: dict = {}

        def work() -> None:
            conn = _conn()
            try:
                # Imported here so the read-only endpoints above keep working
                # on an install without feedparser or trafilatura.
                from .compose import compose_issue
                from .crawler import run_once

                if req.crawl:
                    messages.put(("stage", "Crawling sources"))
                    report = run_once(conn, use_gdelt=req.use_gdelt, verbose=False,
                                      on_progress=lambda m: messages.put(("log", m)))
                    result["crawl"] = report.get("stats")
                if req.compose:
                    messages.put(("stage", "Composing the issue"))
                    issue = compose_issue(conn, window_days=req.window_days,
                                          max_stories=req.max_stories, verbose=False,
                                          on_progress=lambda m: messages.put(("log", m)))
                    result["issue_id"] = issue.get("issue_id")
                    result["spend"] = issue.get("spend")
                    result["error"] = issue.get("error")
            except Exception as exc:  # noqa: BLE001 - report, never crash the stream
                messages.put(("error", f"{type(exc).__name__}: {exc}"))
            finally:
                conn.close()
                messages.put((DONE, None))

        threading.Thread(target=work, daemon=True).start()
        try:
            while True:
                kind, payload = messages.get()
                if kind is DONE:
                    break
                yield _sse({"type": kind, "message": payload})
            yield _sse({"type": "done", **result})
        finally:
            _run_lock.release()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
