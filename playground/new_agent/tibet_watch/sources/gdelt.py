"""The recall layer: GDELT's global news index, keyless and free.

Two things learned by probing it, both of which shape this module:

  * GDELT does not index Tibetan-language sources — `sourcelang:tibetan`
    returns zero articles. The Tibetan side of the corpus comes entirely from
    the curated feeds, so queries here are pinned to English.
  * It rate-limits hard. The 429 body asks for one request every five seconds,
    but 6s spacing still tripped it during testing, so the interval here is
    deliberately generous and a 429 costs us a single backed-off retry. This is
    one sequential call per search, never a fan-out.

  * Bare words in a query are ANDed. A six-word question therefore matches
    nothing at all, which is exactly how this module first failed —
    `Tibet boarding school` returns results where the full phrasing returns
    zero. Queries are trimmed to their three strongest content words.

Its value is mainstream and international coverage the exile outlets miss. Its
cost is precision — an unfiltered `Tibet` query returns Chinese state-media
tourism and culture pieces, exactly the near-miss case the relevance filter
exists to catch. Everything from here must be judged.
"""

import threading
import time
from typing import Dict, List, Optional

import requests

from ..net import USER_AGENT
from ..parsing import latin_tokens

ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc"

# Above GDELT's stated 5s, because 6s still drew 429s in testing.
MIN_INTERVAL = 8.0

_lock = threading.Lock()
_last_call = [0.0]
_cache: Dict[str, List[Dict]] = {}


def _throttle() -> None:
    with _lock:
        wait = MIN_INTERVAL - (time.time() - _last_call[0])
        if wait > 0:
            time.sleep(wait)
        _last_call[0] = time.time()


def build_query(query: str) -> str:
    """Trim to three content words ANDed with Tibet, pinned to English.

    Bare terms are ANDed by GDELT, so more words means fewer results, not
    better ones. Three is what testing showed still returns a useful list.
    """
    terms = [t for t in latin_tokens(query) if t != "tibet" and t != "tibetan"][:3]
    return " ".join(["Tibet", *terms, "sourcelang:english"])


def _fetch(full_query: str, timespan: str, limit: int) -> Optional[List[Dict]]:
    """One request. None means "rate-limited, worth retrying"."""
    _throttle()
    try:
        resp = requests.get(
            ENDPOINT,
            params={
                "query": full_query,
                "mode": "ArtList",
                "format": "json",
                "maxrecords": limit,
                "timespan": timespan,
                "sort": "hybridrel",
            },
            headers={"User-Agent": USER_AGENT},
            timeout=45,
        )
    except requests.RequestException:
        return []

    if resp.status_code == 429:
        return None
    if resp.status_code != 200:
        return []
    try:
        return resp.json().get("articles") or []
    except ValueError:
        # A rate-limit or overload reply arrives as plain text, not JSON.
        return None


def search(query: str, timespan: str = "3m", limit: int = 25) -> List[Dict]:
    """Query GDELT for English-language articles. Returns [] on any failure.

    Best-effort by design: the curated feeds are the backbone, so a throttled
    or unavailable GDELT degrades the result set rather than failing a search.
    """
    if len((query or "").strip()) < 3:
        return []

    full_query = build_query(query)
    cache_key = f"{full_query}|{timespan}|{limit}"
    if cache_key in _cache:
        return _cache[cache_key]

    articles = _fetch(full_query, timespan, limit)
    if articles is None:
        time.sleep(MIN_INTERVAL)
        articles = _fetch(full_query, timespan, limit) or []

    out: List[Dict] = []
    for art in articles:
        url = art.get("url")
        if not url:
            continue
        seen = art.get("seendate") or ""
        published = f"{seen[0:4]}-{seen[4:6]}-{seen[6:8]}" if len(seen) >= 8 else None
        out.append({
            "url": url,
            "title": (art.get("title") or "").strip(),
            "snippet": "",  # GDELT returns no excerpt
            "published_at": published,
            "source": art.get("domain") or "web",
            "language": "en",
            "found_via": "gdelt",
        })

    _cache[cache_key] = out
    return out
