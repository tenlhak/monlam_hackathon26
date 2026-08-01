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

import hmac
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

# Running the pipeline costs real money and takes minutes. On by default so the
# button works out of the box; set WATCH_ADMIN=0 before putting this in front of
# more than one person, since the tutor is multi-user — anyone who types a name
# is in — and every run spends credits.
ADMIN = os.environ.get("WATCH_ADMIN", "1") == "1"

# A second, independent gate on top of ADMIN: the app is public, so knowing the
# URL is enough to be "in". This is a shared password, not a per-user account —
# it stops a stranger from spending credits, nothing more. The default here is
# only for it to work before anyone configures anything; set WATCH_RUN_PASSWORD
# on the deployment so the real value is not sitting in a public repo.
RUN_PASSWORD = os.environ.get("WATCH_RUN_PASSWORD", "TamzTech")


def _password_ok(candidate: str) -> bool:
    # Constant-time compare: a naive == leaks how many leading characters
    # matched through response timing, which a shared password should not.
    return hmac.compare_digest((candidate or "").encode(), RUN_PASSWORD.encode())

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
    password: str = ""
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
    if not _password_ok(req.password):
        raise HTTPException(status_code=401, detail="Incorrect password.")

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
                from .sources.registry import FEEDS

                # Announced up front so the caller can show every outlet as
                # pending and fill them in, rather than growing a list from
                # nothing. Feeds are polled concurrently, so they arrive in
                # completion order and the UI must not assume this ordering.
                messages.put({
                    "type": "plan",
                    "phases": ([{"id": "poll", "label": "Reading sources"},
                                {"id": "ingest", "label": "Storing articles"},
                                {"id": "screen", "label": "Screening for relevance"},
                                {"id": "extract", "label": "Extracting full text"}]
                               if req.crawl else [])
                              + ([{"id": "compose", "label": "Writing the issue"}]
                                 if req.compose else []),
                    "sources": [f["name"] for f in FEEDS] if req.crawl else [],
                })

                if req.crawl:
                    report = run_once(
                        conn, use_gdelt=req.use_gdelt, verbose=False,
                        on_progress=lambda m: messages.put({"type": "log", "message": m}),
                        on_phase=lambda p: messages.put({"type": "phase", "phase": p}),
                        on_source=lambda n, s, i: messages.put(
                            {"type": "source", "name": n, "status": s, "items": i}),
                    )
                    result["crawl"] = report.get("stats")
                    # Counts worth showing as they land, rather than only in
                    # the log: these are what the run actually achieved.
                    messages.put({"type": "metrics", "metrics": {
                        "new articles": (report.get("ingest") or {}).get("new", 0),
                        "relevant": (report.get("screen") or {}).get("passed", 0),
                        "full text": (report.get("extract") or {}).get("extracted", 0),
                    }})

                if req.compose:
                    messages.put({"type": "phase", "phase": "compose"})
                    issue = compose_issue(
                        conn, window_days=req.window_days,
                        max_stories=req.max_stories, verbose=False,
                        on_progress=lambda m: messages.put({"type": "log", "message": m}),
                    )
                    result["issue_id"] = issue.get("issue_id")
                    result["spend"] = issue.get("spend")
                    result["error"] = issue.get("error")
            except Exception as exc:  # noqa: BLE001 - report, never crash the stream
                messages.put({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
            finally:
                conn.close()
                messages.put(DONE)

        threading.Thread(target=work, daemon=True).start()
        try:
            while True:
                payload = messages.get()
                if payload is DONE:
                    break
                yield _sse(payload)
            yield _sse({"type": "done", **result})
        finally:
            _run_lock.release()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
