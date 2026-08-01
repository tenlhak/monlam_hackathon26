"""Tibet Watch — web front end for the newsletter and the archive.

Run:
    conda activate monlam
    python -m uvicorn app:app --reload --port 8090
then open http://127.0.0.1:8090

Two things are served from the same place:

  * the newsletter — issues built by compose.py, read straight out of SQLite,
    which involves no model calls and is therefore instant
  * ask the archive — the on-demand agent, which does call melong and streams
    its reasoning as Server-Sent Events

The split matters for the demo: browsing issues never waits on an API, so a
slow or rate-limited melong cannot make the newsletter look broken.
"""

import json
import os
import sys
from typing import Iterator

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tibet_watch import db, tracing  # noqa: E402
from tibet_watch.agent import stream as agent_stream  # noqa: E402
from tibet_watch.compose import SECTIONS  # noqa: E402
from tibet_watch.melong import MonlamError  # noqa: E402

app = FastAPI(
    title="Tibet Watch",
    description="A bilingual newsletter on the Tibetan cause, built on Monlam AI",
)

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Say plainly at startup whether traces are being sent. Silently-not-tracing is
# the classic way to lose an afternoon staring at an empty LangSmith project.
tracing.configure()
print(f"INFO:     {tracing.status_line()}")


def _db():
    """A fresh connection per request; SQLite objects are not thread-safe."""
    return db.connect()


# ---------------------------------------------------------------------------
# Newsletter — served straight from SQLite, no model calls
# ---------------------------------------------------------------------------

@app.get("/api/issues")
def get_issues():
    conn = _db()
    try:
        return {"issues": [dict(r) for r in db.list_issues(conn, limit=25)]}
    finally:
        conn.close()


@app.get("/api/issues/{issue_id}")
def get_issue(issue_id: str):
    conn = _db()
    try:
        issue = db.get_issue(conn, issue_id)
        if issue is None:
            raise HTTPException(status_code=404, detail=f"no issue {issue_id}")
        # Group into sections here rather than in the browser, so the ordering
        # stays defined in one place.
        grouped = []
        for name in SECTIONS:
            stories = [s for s in issue["stories"] if s["section"] == name]
            if stories:
                grouped.append({"section": name, "stories": stories})
        issue["sections"] = grouped
        return issue
    finally:
        conn.close()


@app.get("/api/stats")
def get_stats():
    """Corpus and feed health, for the status strip."""
    conn = _db()
    try:
        stats = db.stats(conn)
        feeds = conn.execute(
            "SELECT name, consecutive_failures, items_seen_total, last_success "
            "FROM feeds ORDER BY name"
        ).fetchall()
        latest = db.list_issues(conn, limit=1)
        return {
            "corpus": stats,
            "window_ready": len(db.window(conn, days=7)),
            "feeds": [dict(f) for f in feeds],
            "unhealthy": len(db.unhealthy_feeds(conn)),
            "latest_issue": dict(latest[0]) if latest else None,
        }
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Ask the archive — the on-demand agent
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    question: str
    use_gdelt: bool = False   # off by default: GDELT's throttle is felt live


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@app.post("/api/search")
def post_search(req: SearchRequest) -> StreamingResponse:
    """Stream the agent's steps, then the finished bilingual summaries."""

    def events() -> Iterator[str]:
        try:
            for event in agent_stream(req.question, use_gdelt=req.use_gdelt):
                kind = event["type"]
                if kind == "start":
                    yield _sse({"type": "start", "question": event["question"]})
                elif kind == "action":
                    yield _sse({"type": "action", "tool": event["tool"],
                                "input": event["input"]})
                elif kind == "observation":
                    yield _sse({"type": "observation", "tool": event.get("tool", ""),
                                "content": event["content"]})
                elif kind == "final":
                    yield _sse({"type": "overview", "content": event["content"]})
                elif kind == "done":
                    # The Session object is not serialisable; only the article
                    # records and the spend counters are sent.
                    yield _sse({"type": "done", "articles": event["results"],
                                "spend": event["spend"]})
        except MonlamError as exc:
            yield _sse({"type": "error", "message": str(exc)})
        except Exception as exc:  # noqa: BLE001 - surface anything to the UI
            yield _sse({"type": "error", "message": f"Unexpected error: {exc}"})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
