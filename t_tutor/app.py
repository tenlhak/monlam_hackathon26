"""T-Tutor — FastAPI backend for the Tibetan tutor.

Run:
    conda activate monlam
    python -m uvicorn app:app --reload --port 8080
then open http://127.0.0.1:8080
"""

import json
import os
import sys
from typing import Optional

from fastapi import FastAPI, Form, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tutor import client, content, db, normalize, prompts, trace  # noqa: E402

# The agent needs OpenAI and LangGraph; if either is missing or unconfigured the
# tutor still runs on plain melong rather than failing to start.
try:
    from tutor import agent as tutor_agent
    AGENT_AVAILABLE = True
except Exception as _agent_import_error:  # noqa: BLE001
    tutor_agent = None
    AGENT_AVAILABLE = False
    print(f"[t-tutor] agent unavailable, falling back to direct melong: {_agent_import_error}")

# Grounded agent on by default; set TUTOR_AGENT=0 to compare against the old path.
AGENT_ENABLED = AGENT_AVAILABLE and os.environ.get("TUTOR_AGENT", "1") != "0"

# The news feature is optional in the same way. A language app must not fail to
# start because a news crawler's dependency is missing, so the router is only
# mounted if it imports; the frontend hides the tab when /api/watch is absent.
try:
    from tutor.watch.routes import router as watch_router
    WATCH_AVAILABLE = True
except Exception as _watch_import_error:  # noqa: BLE001
    watch_router = None
    WATCH_AVAILABLE = False
    print(f"[t-tutor] news unavailable: {_watch_import_error}")

app = FastAPI(title="T-Tutor", description="A Tibetan tutor built on Monlam AI")

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Chat is billed per token, so only the tail of a long conversation is sent.
HISTORY_LIMIT = 20


if WATCH_AVAILABLE:
    app.include_router(watch_router)


@app.on_event("startup")
def _startup() -> None:
    db.init()


@app.get("/api/features")
def get_features():
    """What this deployment can actually do, so the frontend can adapt.

    Both the grounded agent and the news feature degrade to absent rather than
    breaking, and the UI should not offer a tab that would 404.
    """
    return {"agent": AGENT_ENABLED, "watch": WATCH_AVAILABLE}


# ----------------------------------------------------------------- users


class UserRequest(BaseModel):
    name: str


@app.post("/api/user")
def post_user(req: UserRequest):
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="A name is required.")
    return db.get_or_create_user(name)


@app.get("/api/user/{user_id}")
def get_user(user_id: int):
    user = db.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="No such user.")
    return {**user, "stats": db.attempt_stats(user_id)}


class LevelRequest(BaseModel):
    level: int


@app.post("/api/user/{user_id}/level")
def post_level(user_id: int, req: LevelRequest):
    db.set_level(user_id, content.clamp(req.level))
    return db.get_user(user_id)


class PlacementRequest(BaseModel):
    level: int


@app.post("/api/user/{user_id}/placement")
def post_placement(user_id: int, req: PlacementRequest):
    """Record a placement-quiz result and unlock levels up to it."""
    if not db.get_user(user_id):
        raise HTTPException(status_code=404, detail="No such user.")

    user = db.record_placement(user_id, content.clamp(req.level))
    return {**user, "stats": db.attempt_stats(user_id)}


# --------------------------------------------------------- conversations


@app.get("/api/conversations")
def get_conversations(user_id: int):
    return {"conversations": db.list_conversations(user_id)}


class NewConversation(BaseModel):
    user_id: int


@app.post("/api/conversations")
def post_conversation(req: NewConversation):
    return db.create_conversation(req.user_id)


@app.get("/api/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: int):
    return {"messages": db.get_messages(conversation_id)}


@app.delete("/api/conversations/{conversation_id}")
def delete_conversation(conversation_id: int):
    db.delete_conversation(conversation_id)
    return {"ok": True}


# ------------------------------------------------------------------ chat


class ChatRequest(BaseModel):
    user_id: int
    conversation_id: int
    message: str


@app.post("/api/chat")
def post_chat(req: ChatRequest) -> StreamingResponse:
    """Persist the learner's turn, then stream the reply and persist that too."""
    user = db.get_user(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="No such user.")

    db.add_message(req.conversation_id, "user", req.message)

    # First message becomes the conversation's title in the history sidebar.
    history = db.get_messages(req.conversation_id)
    if len(history) == 1:
        db.rename_conversation(req.conversation_id, req.message.strip())

    history = db.get_messages(req.conversation_id, limit=HISTORY_LIMIT)

    def event_stream():
        reply = ""
        try:
            if AGENT_ENABLED:
                # Research with verified sources, then melong teaches from them.
                for event in tutor_agent.answer(req.message, history, user["level"]):
                    if event["type"] == "delta":
                        reply += event["content"]
                        yield f"data: {json.dumps(event)}\n\n"
                    else:
                        # `sources` is additive; both frontends ignore unknown types.
                        yield f"data: {json.dumps(event)}\n\n"
            else:
                for delta in client.stream_chat(prompts.build_messages(history, user["level"])):
                    reply += delta
                    yield f"data: {json.dumps({'type': 'delta', 'content': delta})}\n\n"

            if reply.strip():
                db.add_message(req.conversation_id, "assistant", reply)

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except client.MonlamError as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        except Exception as exc:  # noqa: BLE001 - surface anything to the UI
            yield f"data: {json.dumps({'type': 'error', 'message': f'Unexpected error: {exc}'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# -------------------------------------------------------------- practice


@app.get("/api/practice/items")
def get_practice_items(level: int = 1):
    info = content.for_level(level)
    return {
        "level": content.clamp(level),
        "title": info["title"],
        "focus": info["focus"],
        "items": info["items"],
    }


class ListenRequest(BaseModel):
    text: str
    voice: Optional[str] = None


@app.post("/api/practice/listen")
def post_listen(req: ListenRequest):
    try:
        url = client.text_to_speech(req.text, req.voice or client.DEFAULT_VOICE)
    except client.MonlamError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"audio_url": url}


@app.post("/api/practice/speak")
async def post_speak(
    user_id: int = Form(...),
    target: str = Form(...),
    audio: UploadFile = File(...),
):
    """Transcribe the learner's recording and judge it against the target."""
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="The recording was empty.")

    try:
        transcript = client.speech_to_text(data)
    except client.MonlamError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Speech-to-text appends punctuation the speaker never said, so compare
    # with that stripped or every correct answer reads as wrong.
    correct = normalize.matches(transcript, target)
    db.record_attempt(user_id, "speak", target, transcript, correct)

    return {"transcript": transcript, "correct": correct, "target": target}


@app.get("/api/practice/ghost")
def get_ghost(text: str):
    """The faint letter to trace over, rendered with the same font used to grade."""
    png = trace.ghost_png(text)
    if not png:
        raise HTTPException(status_code=404, detail="No Tibetan font available to render.")
    return Response(content=png, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"})


@app.post("/api/practice/trace")
async def post_trace(
    user_id: int = Form(...),
    target: str = Form(...),
    image: UploadFile = File(...),
):
    """Grade a traced letter: OCR first, falling back to shape comparison.

    OCR reads only about eighteen of the thirty consonants and fails the same
    ones every time, so it cannot be the only judge — those letters would be
    impossible to pass however well they were drawn.
    """
    data = await image.read()
    if not data or trace.is_blank(data):
        raise HTTPException(status_code=400, detail="Nothing was drawn yet.")

    transcript = ""
    try:
        # The canvas exports a transparent background, which OCR cannot read at
        # all, so flatten it onto white first.
        transcript = client.ocr_image(trace.flatten_to_white(data))
    except client.MonlamError:
        # A failed OCR call is not fatal; the shape comparison still stands.
        transcript = ""

    ocr_matched = normalize.matches(transcript, target)
    correct, judged_by, score = trace.grade(data, target, ocr_matched)

    db.record_attempt(user_id, "trace", target, transcript, correct)

    return {
        "correct": correct,
        "judged_by": judged_by,
        "score": round(score, 2),
        "transcript": transcript,
        "target": target,
    }


# ----------------------------------------------------------------- static

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
