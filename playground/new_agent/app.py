"""Tibet Watch — FastAPI backend, streaming the agent's reasoning to the browser.

Run:
    conda activate monlam
    python -m uvicorn app:app --reload --port 8090
then open http://127.0.0.1:8090

The SSE shape follows t_tutor/app.py in this repo, so the two demos behave the
same way. What is streamed here is the agent loop itself — action, observation,
action — because watching it work is most of the point.
"""

import json
import os
import sys
from typing import Iterator

from fastapi import FastAPI
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tibet_watch import tracing  # noqa: E402
from tibet_watch.agent import stream as agent_stream  # noqa: E402
from tibet_watch.melong import MonlamError  # noqa: E402

app = FastAPI(title="Tibet Watch",
              description="Finds and summarises reporting on the Tibetan cause, in Tibetan and English")

# Say plainly at startup whether traces are being sent. Silently-not-tracing is
# the classic way to lose an afternoon staring at an empty LangSmith project.
tracing.configure()
print(f"INFO:     {tracing.status_line()}")

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")


class SearchRequest(BaseModel):
    question: str
    use_gdelt: bool = True


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
                    # The Session object itself is not serialisable; only the
                    # article records and the spend counters are sent.
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
