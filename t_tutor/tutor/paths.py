"""Where mutable state lives.

A container's filesystem is wiped on every deploy, so anything the app writes
has to sit on a mounted volume. `DATA_DIR` is what a deployment sets to point
at one; the tutor database in particular holds accounts, chat history and
placement results, none of which can be regenerated.

Without `DATA_DIR` every file stays exactly where it has always been, so an
existing checkout keeps its data and local development needs no configuration.
"""

from __future__ import annotations

import os


def data_dir() -> str | None:
    """The configured volume, or None when running from a working tree."""
    root = (os.environ.get("DATA_DIR") or "").strip()
    return root or None


def state_path(filename: str, local_default: str) -> str:
    """Absolute path for a file the app writes to.

    `local_default` is where the file lives in a checkout, and is used verbatim
    when no volume is configured — moving it would look like data loss to
    anyone who already has a database.
    """
    root = data_dir()
    if root:
        os.makedirs(root, exist_ok=True)
        return os.path.join(root, filename)
    return os.path.abspath(local_default)
