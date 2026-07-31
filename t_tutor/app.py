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
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tutor import client, content, db, normalize, prompts  # noqa: E402

app = FastAPI(title="T-Tutor", description="A Tibetan tutor built on Monlam AI")

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# Chat is billed per token, so only the tail of a long conversation is sent.
HISTORY_LIMIT = 20


@app.on_event("startup")
def _startup() -> None:
    db.init()


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

    messages = prompts.build_messages(
        db.get_messages(req.conversation_id, limit=HISTORY_LIMIT), user["level"]
    )

    def event_stream():
        reply = ""
        try:
            for delta in client.stream_chat(messages):
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


# ----------------------------------------------------------------- static

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
