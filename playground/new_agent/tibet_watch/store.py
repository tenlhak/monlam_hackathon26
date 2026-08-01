"""Document store — the reason the agent passes handles instead of payloads.

melong turned out to have a ~32k context, so a whole article would technically
fit in the transcript. It still must not go there: every later turn re-sends
the entire scratchpad, so inlining one 30k-token article makes a six-step loop
cost roughly ten times what it should. Tools therefore return an id plus a
snippet, and the full text lives here.
"""

import hashlib
import json
import os
import re
import threading
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

# Tracking parameters that make identical articles look distinct.
JUNK_PARAMS = re.compile(r"^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|source|amp)", re.I)


def canonical_url(url: str) -> str:
    """Strip the noise that makes the same article look like several."""
    try:
        parts = urlparse(url.strip())
    except ValueError:
        return url.strip()

    host = (parts.netloc or "").lower()
    if host.startswith("www."):
        host = host[4:]
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if not JUNK_PARAMS.match(k)])
    path = parts.path.rstrip("/") or "/"
    return urlunparse(("https", host, path, "", query, ""))


def doc_id(url: str) -> str:
    """Stable short id, so re-running a query re-identifies the same article."""
    return hashlib.sha1(canonical_url(url).encode("utf-8")).hexdigest()[:8]


def title_key(title: str) -> str:
    """Normalised title, for catching one wire story republished by three outlets."""
    return re.sub(r"[^a-z0-9ༀ-࿿]+", "", (title or "").lower())[:80]


@dataclass
class Doc:
    id: str
    url: str
    title: str
    source: str
    published_at: Optional[str] = None
    snippet: str = ""
    language: Optional[str] = None
    found_via: str = ""

    # Filled in later in the pipeline.
    relevant: Optional[bool] = None
    relevance_score: Optional[float] = None   # is it about the Tibetan cause?
    query_score: float = 0.0                  # does it answer *this* question?
    why_relevant: Optional[str] = None
    text: Optional[str] = field(default=None, repr=False)
    word_count: Optional[int] = None
    summary_en: Optional[str] = None
    summary_bo: Optional[str] = None
    fetched_at: Optional[str] = None
    error: Optional[str] = None

    def public(self) -> Dict:
        """Everything except the full article body."""
        d = asdict(self)
        d.pop("text", None)
        return d


class DocStore:
    """In-process store with optional JSONL persistence.

    Thread-safe because the RSS and GDELT fan-out writes from a thread pool.
    """

    def __init__(self, path: Optional[str] = None):
        self.path = path
        self._docs: Dict[str, Doc] = {}
        self._titles: Dict[str, str] = {}
        self._lock = threading.Lock()

    def add(self, url: str, title: str, source: str, **kw) -> Optional[Doc]:
        """Register a candidate. Returns None if it duplicates something known."""
        if not url:
            return None
        did = doc_id(url)
        tkey = title_key(title)

        with self._lock:
            if did in self._docs:
                return None
            # Same story from a different outlet: keep the first, drop the rest.
            if tkey and tkey in self._titles:
                return None

            doc = Doc(id=did, url=canonical_url(url), title=(title or "").strip(),
                      source=source, **kw)
            self._docs[did] = doc
            if tkey:
                self._titles[tkey] = did
            return doc

    def get(self, did: str) -> Optional[Doc]:
        return self._docs.get((did or "").strip())

    def resolve(self, handle: str) -> Optional[Doc]:
        """Look up by id, or by URL if the model passed one instead."""
        handle = (handle or "").strip()
        if not handle:
            return None
        found = self.get(handle)
        if found:
            return found
        if handle.startswith("http"):
            return self.get(doc_id(handle))
        return None

    def all(self) -> List[Doc]:
        return list(self._docs.values())

    def summarised(self) -> List[Doc]:
        return [d for d in self._docs.values() if d.summary_en or d.summary_bo]

    def flush(self) -> Optional[str]:
        """Append summarised documents to the JSONL log."""
        if not self.path:
            return None
        os.makedirs(os.path.dirname(os.path.abspath(self.path)), exist_ok=True)
        with open(self.path, "a", encoding="utf-8") as fh:
            for doc in self.summarised():
                fh.write(json.dumps(doc.public(), ensure_ascii=False) + "\n")
        return self.path
