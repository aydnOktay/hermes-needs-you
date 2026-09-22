"""Best-effort local redaction for approval command previews.

Hermes may already redact before hooks on some surfaces; we still scrub
before persisting so secrets do not land in plugin-data.
"""

from __future__ import annotations

import re

_PATTERNS = [
    re.compile(r"(?i)(api[_-]?key|token|secret|password|passwd|authorization)\s*[=:]\s*\S+"),
    re.compile(r"(?i)\bBearer\s+[A-Za-z0-9\-._~+/]+=*"),
    re.compile(r"(?i)\bsk-[A-Za-z0-9]{8,}"),
    re.compile(r"(?i)\bghp_[A-Za-z0-9]{20,}"),
    re.compile(r"(?i)\bxox[baprs]-[A-Za-z0-9-]{10,}"),
]


def redact_text(raw: str, max_len: int = 280) -> str:
    text = (raw or "").replace("\r\n", "\n").strip()
    if not text:
        return ""
    out = text
    for pat in _PATTERNS:
        out = pat.sub("[redacted]", out)
    if len(out) > max_len:
        out = out[: max_len - 1] + "…"
    return out
