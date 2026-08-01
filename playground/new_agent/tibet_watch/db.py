"""SQLite store for the crawled corpus.

JSONL got the on-demand agent this far, but a newsletter needs three things it
cannot do: query by date window, remember what has already been published, and
survive a crawler that runs every four hours forever. Hence a real table.

Two columns carry more weight than they look:

  published_at        the newsletter windows on this, NOT on first_seen_at.
                      On a cold start everything is "first seen today", and
                      windowing on that would put a six-month-old TCHRD piece
                      in issue #1.

  published_in_issue  NULL means never sent. This is the entire novelty
                      mechanism, and it lives on the article from the start so
                      compose never has to reconstruct history.
"""

import hashlib
import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

DEFAULT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "tibet_watch.db"
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS articles (
    id                 TEXT PRIMARY KEY,
    canonical_url      TEXT UNIQUE NOT NULL,
    url                TEXT NOT NULL,
    title              TEXT,
    source             TEXT,
    source_domain      TEXT,
    lang               TEXT,
    published_at       TEXT,          -- ISO8601 UTC; NULL when the feed gave none
    first_seen_at      TEXT NOT NULL,
    fetched_at         TEXT,
    snippet            TEXT,
    text               TEXT,
    word_count         INTEGER,
    char_count         INTEGER,
    content_hash       TEXT,
    found_via          TEXT,
    is_state_media     INTEGER DEFAULT 0,
    relevant           INTEGER,       -- NULL = not yet screened
    relevance_score    REAL,
    why_relevant       TEXT,
    extract_error      TEXT,
    extract_attempts   INTEGER DEFAULT 0,
    cluster_id         TEXT,          -- filled by compose
    published_in_issue TEXT           -- NULL = never sent
);

CREATE INDEX IF NOT EXISTS idx_articles_published  ON articles(published_at);
CREATE INDEX IF NOT EXISTS idx_articles_first_seen ON articles(first_seen_at);
CREATE INDEX IF NOT EXISTS idx_articles_relevant   ON articles(relevant);
CREATE INDEX IF NOT EXISTS idx_articles_issue      ON articles(published_in_issue);

CREATE TABLE IF NOT EXISTS feeds (
    name                 TEXT PRIMARY KEY,
    url                  TEXT,
    etag                 TEXT,
    last_modified        TEXT,
    last_polled          TEXT,
    last_success         TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    items_seen_total     INTEGER DEFAULT 0,
    last_item_ids        TEXT           -- JSON list, for overlap/gap detection
);

CREATE TABLE IF NOT EXISTS crawl_runs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at       TEXT,
    finished_at      TEXT,
    feeds_polled     INTEGER DEFAULT 0,
    not_modified     INTEGER DEFAULT 0,
    new_items        INTEGER DEFAULT 0,
    screened_out     INTEGER DEFAULT 0,
    extracted        INTEGER DEFAULT 0,
    extract_failures INTEGER DEFAULT 0,
    gdelt_items      INTEGER DEFAULT 0,
    gap_warnings     TEXT,
    errors           TEXT
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(path: str = DEFAULT_PATH) -> sqlite3.Connection:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    conn = sqlite3.connect(path, timeout=30)
    conn.row_factory = sqlite3.Row
    # WAL lets the compose job read while a crawl is writing.
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


# ---------------------------------------------------------------------------
# Articles
# ---------------------------------------------------------------------------

ARTICLE_FIELDS = (
    "id", "canonical_url", "url", "title", "source", "source_domain", "lang",
    "published_at", "first_seen_at", "snippet", "found_via", "is_state_media",
)


def insert_article(conn: sqlite3.Connection, row: Dict[str, Any]) -> bool:
    """Insert if unseen. Returns True when the row was new.

    INSERT OR IGNORE on a deterministic id is what makes the whole crawl
    idempotent: safe to run twice, safe to crash halfway, safe to resume after
    two days of downtime.
    """
    row = {**row, "first_seen_at": row.get("first_seen_at") or now_iso()}
    values = [row.get(f) for f in ARTICLE_FIELDS]
    cur = conn.execute(
        f"INSERT OR IGNORE INTO articles ({','.join(ARTICLE_FIELDS)}) "
        f"VALUES ({','.join('?' * len(ARTICLE_FIELDS))})",
        values,
    )
    return cur.rowcount > 0


def set_screening(conn: sqlite3.Connection, article_id: str, relevant: bool,
                  score: Optional[float], reason: str) -> None:
    conn.execute(
        "UPDATE articles SET relevant=?, relevance_score=?, why_relevant=? WHERE id=?",
        (1 if relevant else 0, score, reason[:300], article_id),
    )


def set_text(conn: sqlite3.Connection, article_id: str, text: str, title: str,
             published_at: Optional[str], word_count: int, char_count: int) -> None:
    conn.execute(
        """UPDATE articles
              SET text=?, content_hash=?, word_count=?, char_count=?,
                  fetched_at=?, extract_error=NULL,
                  title=COALESCE(NULLIF(?, ''), title),
                  published_at=COALESCE(published_at, ?)
            WHERE id=?""",
        (text, hashlib.sha1(text[:5000].encode("utf-8")).hexdigest()[:16],
         word_count, char_count, now_iso(), title, published_at, article_id),
    )


def set_extract_error(conn: sqlite3.Connection, article_id: str, error: str) -> None:
    conn.execute(
        "UPDATE articles SET extract_error=?, extract_attempts=extract_attempts+1 WHERE id=?",
        (error[:300], article_id),
    )


def unscreened(conn: sqlite3.Connection) -> List[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM articles WHERE relevant IS NULL ORDER BY first_seen_at"
    ).fetchall()


def needing_extraction(conn: sqlite3.Connection, window_days: int,
                       max_attempts: int = 3, limit: int = 120) -> List[sqlite3.Row]:
    """Relevant, in-window articles with no text yet.

    The window check is why a 183-day-old TCHRD backlog costs us nothing: those
    rows are recorded, but we never spend an HTTP request downloading them.
    An article with no date at all is treated as in-window — better to fetch a
    few extra than to silently skip an outlet whose feed omits dates.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=window_days)).isoformat(timespec="seconds")
    return conn.execute(
        """SELECT * FROM articles
            WHERE relevant = 1
              AND text IS NULL
              AND extract_attempts < ?
              AND (published_at IS NULL OR published_at >= ?)
         ORDER BY COALESCE(published_at, first_seen_at) DESC
            LIMIT ?""",
        (max_attempts, cutoff, limit),
    ).fetchall()


def window(conn: sqlite3.Connection, days: int = 7,
           only_unpublished: bool = True) -> List[sqlite3.Row]:
    """Relevant articles for an issue. This is what compose.py will call."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
    sql = ["SELECT * FROM articles WHERE relevant = 1 AND text IS NOT NULL",
           "AND COALESCE(published_at, first_seen_at) >= ?"]
    if only_unpublished:
        sql.append("AND published_in_issue IS NULL")
    sql.append("ORDER BY COALESCE(published_at, first_seen_at) DESC")
    return conn.execute(" ".join(sql), (cutoff,)).fetchall()


def stats(conn: sqlite3.Connection) -> Dict[str, Any]:
    def one(sql: str, *args) -> int:
        return conn.execute(sql, args).fetchone()[0]

    return {
        "articles": one("SELECT COUNT(*) FROM articles"),
        "relevant": one("SELECT COUNT(*) FROM articles WHERE relevant = 1"),
        "screened_out": one("SELECT COUNT(*) FROM articles WHERE relevant = 0"),
        "unscreened": one("SELECT COUNT(*) FROM articles WHERE relevant IS NULL"),
        "with_text": one("SELECT COUNT(*) FROM articles WHERE text IS NOT NULL"),
        "extract_failed": one("SELECT COUNT(*) FROM articles WHERE extract_error IS NOT NULL"),
        "never_published": one("SELECT COUNT(*) FROM articles WHERE published_in_issue IS NULL AND relevant = 1"),
    }


# ---------------------------------------------------------------------------
# Feed state — conditional GET and gap detection
# ---------------------------------------------------------------------------

def feed_state(conn: sqlite3.Connection, name: str) -> Dict[str, Any]:
    row = conn.execute("SELECT * FROM feeds WHERE name=?", (name,)).fetchone()
    if row is None:
        return {"name": name, "etag": None, "last_modified": None,
                "consecutive_failures": 0, "last_item_ids": []}
    state = dict(row)
    try:
        state["last_item_ids"] = json.loads(state.get("last_item_ids") or "[]")
    except json.JSONDecodeError:
        state["last_item_ids"] = []
    return state


def save_feed_state(conn: sqlite3.Connection, name: str, url: str, *,
                    etag: Optional[str] = None, last_modified: Optional[str] = None,
                    ok: bool = True, item_ids: Optional[List[str]] = None,
                    seen: int = 0) -> None:
    prior = feed_state(conn, name)
    failures = 0 if ok else prior.get("consecutive_failures", 0) + 1
    conn.execute(
        """INSERT INTO feeds (name, url, etag, last_modified, last_polled, last_success,
                              consecutive_failures, items_seen_total, last_item_ids)
                VALUES (?,?,?,?,?,?,?,?,?)
           ON CONFLICT(name) DO UPDATE SET
                url=excluded.url,
                etag=COALESCE(excluded.etag, feeds.etag),
                last_modified=COALESCE(excluded.last_modified, feeds.last_modified),
                last_polled=excluded.last_polled,
                last_success=COALESCE(excluded.last_success, feeds.last_success),
                consecutive_failures=excluded.consecutive_failures,
                items_seen_total=feeds.items_seen_total + ?,
                last_item_ids=COALESCE(excluded.last_item_ids, feeds.last_item_ids)""",
        (name, url, etag, last_modified, now_iso(), now_iso() if ok else None,
         failures, seen, json.dumps(item_ids) if item_ids is not None else None, seen),
    )


def unhealthy_feeds(conn: sqlite3.Connection, threshold: int = 3) -> List[sqlite3.Row]:
    """Feeds that have failed repeatedly — the continuous version of gate1."""
    return conn.execute(
        "SELECT * FROM feeds WHERE consecutive_failures >= ? ORDER BY consecutive_failures DESC",
        (threshold,),
    ).fetchall()


# ---------------------------------------------------------------------------
# Run log
# ---------------------------------------------------------------------------

def start_run(conn: sqlite3.Connection) -> int:
    cur = conn.execute("INSERT INTO crawl_runs (started_at) VALUES (?)", (now_iso(),))
    conn.commit()
    return cur.lastrowid


def finish_run(conn: sqlite3.Connection, run_id: int, **counts) -> None:
    fields = ["feeds_polled", "not_modified", "new_items", "screened_out",
              "extracted", "extract_failures", "gdelt_items", "gap_warnings", "errors"]
    sets = ", ".join(f"{f}=?" for f in fields)
    conn.execute(
        f"UPDATE crawl_runs SET finished_at=?, {sets} WHERE id=?",
        [now_iso()] + [counts.get(f) for f in fields] + [run_id],
    )
    conn.commit()


def recent_runs(conn: sqlite3.Connection, limit: int = 5) -> List[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM crawl_runs ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
