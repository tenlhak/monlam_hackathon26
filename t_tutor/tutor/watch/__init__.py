"""tibet_watch — an on-demand agent that finds and summarises reporting on the
Tibetan cause, built on Monlam AI's `melong` model.
"""

from .melong import ChatMelong, MonlamError

__all__ = ["ChatMelong", "MonlamError"]
