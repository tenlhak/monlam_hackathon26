"""Search backends. RSS is the precision layer, GDELT the recall layer."""

from . import gdelt, rss
from .registry import (
    FEEDS,
    IN_SCOPE_TERMS,
    OUT_OF_SCOPE_TERMS,
    RELEVANCE_RUBRIC,
    TRUSTED_DOMAINS,
)

__all__ = [
    "rss", "gdelt", "FEEDS", "TRUSTED_DOMAINS",
    "IN_SCOPE_TERMS", "OUT_OF_SCOPE_TERMS", "RELEVANCE_RUBRIC",
]
