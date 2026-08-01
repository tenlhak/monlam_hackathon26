"""SQLite persistence for users, chat history, and practice attempts.

Uses the standard library `sqlite3`, so there is no extra dependency. The
database file sits next to the app and the schema is created on first use.
"""

import os
import sqlite3
from typing import Dict, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "t_tutor.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    level      INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT 'New chat',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS practice_attempts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    drill      TEXT NOT NULL,
    target     TEXT NOT NULL,
    transcript TEXT,
    correct    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_attempt_user ON practice_attempts(user_id, created_at DESC);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(os.path.abspath(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns the original schema did not have.

    Existing databases predate the placement quiz, so `placed_at` has to be
    added rather than declared in SCHEMA — CREATE TABLE IF NOT EXISTS leaves an
    existing table untouched, and those users must keep their chat history.
    A NULL `placed_at` is what marks a learner as never placed.
    """
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)")}
    if "placed_at" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN placed_at TEXT")


# ---------------------------------------------------------------- users


def get_or_create_user(name: str) -> Dict:
    name = name.strip()
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE name = ?", (name,)).fetchone()
        if row is None:
            cur = conn.execute("INSERT INTO users (name) VALUES (?)", (name,))
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)


def get_user(user_id: int) -> Optional[Dict]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def set_level(user_id: int, level: int) -> None:
    with connect() as conn:
        conn.execute("UPDATE users SET level = ? WHERE id = ?", (level, user_id))


def record_placement(user_id: int, level: int) -> Optional[Dict]:
    """Store a placement result. The level only ever rises.

    A retake that scores lower must not take away levels the learner already
    had, so the stored level is the better of the two. `placed_at` is stamped
    every time, since it answers "has this learner been placed", not "when did
    they reach this level".
    """
    with connect() as conn:
        conn.execute(
            "UPDATE users SET level = MAX(level, ?), placed_at = datetime('now')"
            " WHERE id = ?",
            (level, user_id),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


# -------------------------------------------------------- conversations


def create_conversation(user_id: int, title: str = "New chat") -> Dict:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO conversations (user_id, title) VALUES (?, ?)", (user_id, title)
        )
        row = conn.execute(
            "SELECT * FROM conversations WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return dict(row)


def list_conversations(user_id: int) -> List[Dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def rename_conversation(conversation_id: int, title: str) -> None:
    with connect() as conn:
        conn.execute(
            "UPDATE conversations SET title = ? WHERE id = ?", (title[:80], conversation_id)
        )


def delete_conversation(conversation_id: int) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
        conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))


# ------------------------------------------------------------- messages


def add_message(conversation_id: int, role: str, content: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
            (conversation_id, role, content),
        )
        conn.execute(
            "UPDATE conversations SET updated_at = datetime('now') WHERE id = ?",
            (conversation_id,),
        )


def get_messages(conversation_id: int, limit: Optional[int] = None) -> List[Dict]:
    """Messages oldest-first. `limit` keeps only the most recent N."""
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id",
            (conversation_id,),
        ).fetchall()
        out = [dict(r) for r in rows]
        return out[-limit:] if limit else out


# ---------------------------------------------------- practice attempts


def record_attempt(
    user_id: int, drill: str, target: str, transcript: str = "", correct: bool = False
) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO practice_attempts (user_id, drill, target, transcript, correct)"
            " VALUES (?, ?, ?, ?, ?)",
            (user_id, drill, target, transcript, 1 if correct else 0),
        )


def attempt_stats(user_id: int) -> Dict:
    """Totals plus the targets most often missed, for a simple progress readout."""
    with connect() as conn:
        totals = conn.execute(
            "SELECT COUNT(*) AS attempts, COALESCE(SUM(correct), 0) AS correct"
            " FROM practice_attempts WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        weak = conn.execute(
            "SELECT target, COUNT(*) AS misses FROM practice_attempts"
            " WHERE user_id = ? AND correct = 0 GROUP BY target"
            " ORDER BY misses DESC LIMIT 5",
            (user_id,),
        ).fetchall()
        return {
            "attempts": totals["attempts"],
            "correct": totals["correct"],
            "weakest": [dict(r) for r in weak],
        }
