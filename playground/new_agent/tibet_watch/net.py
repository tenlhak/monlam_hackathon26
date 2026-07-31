"""Shared HTTP session: one identity, one set of timeouts, one retry policy.

We are scraping small independent newsrooms, several of which run on modest
hosting. A real User-Agent, a short delay between hits on the same host and a
bounded retry are the minimum courtesy.
"""

import threading
import time
from typing import Dict, Optional
from urllib.parse import urlparse

import requests

USER_AGENT = (
    "tibet-watch/0.1 (Monlam Hackathon research prototype; "
    "summarises Tibet-related reporting)"
)

DEFAULT_TIMEOUT = 30
PER_HOST_DELAY = 1.0

_session = requests.Session()
_session.headers.update({
    "User-Agent": USER_AGENT,
    "Accept-Language": "en,bo;q=0.9",
})

_last_hit: Dict[str, float] = {}
_lock = threading.Lock()


def _throttle(url: str) -> None:
    """Keep at least PER_HOST_DELAY between requests to the same host."""
    host = urlparse(url).netloc
    with _lock:
        elapsed = time.time() - _last_hit.get(host, 0.0)
        if elapsed < PER_HOST_DELAY:
            time.sleep(PER_HOST_DELAY - elapsed)
        _last_hit[host] = time.time()


def get(url: str, timeout: int = DEFAULT_TIMEOUT, retries: int = 1, **kwargs) -> Optional[requests.Response]:
    """GET with throttling and a bounded retry. Returns None on failure.

    Returning None rather than raising is deliberate: one dead feed out of ten
    should degrade a search, not fail it.
    """
    for attempt in range(retries + 1):
        _throttle(url)
        try:
            resp = _session.get(url, timeout=timeout, **kwargs)
            if resp.status_code == 200:
                return resp
            # 4xx will not improve on retry; 5xx might.
            if resp.status_code < 500:
                return None
        except requests.RequestException:
            pass
        if attempt < retries:
            time.sleep(1.5 * (attempt + 1))
    return None
