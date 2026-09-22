"""Pending + history queue under plugin-data/needs-you."""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import needs_redact

PLUGIN_ID = "needs-you"
MAX_PENDING = 40
MAX_HISTORY = 30


def data_dir() -> Path:
    try:
        from plugins.plugin_storage import plugin_data_dir  # type: ignore

        return plugin_data_dir(PLUGIN_ID)
    except Exception:
        home = Path(os.environ.get("HERMES_HOME") or (Path.home() / ".hermes"))
        path = home / "plugin-data" / PLUGIN_ID
        path.mkdir(parents=True, exist_ok=True)
        return path


def state_path() -> Path:
    return data_dir() / "queue.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _empty() -> dict[str, Any]:
    return {
        "settings": {
            "os_notify": True,
            "sound": True,
            "muted": False,
        },
        "pending": [],
        "history": [],
    }


def load_state() -> dict[str, Any]:
    path = state_path()
    if not path.is_file():
        return _empty()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _empty()
    if not isinstance(raw, dict):
        return _empty()
    for key in ("pending", "history"):
        if not isinstance(raw.get(key), list):
            raw[key] = []
    if not isinstance(raw.get("settings"), dict):
        raw["settings"] = _empty()["settings"]
    return raw


def save_state(state: dict[str, Any]) -> None:
    path = state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def get_settings() -> dict[str, Any]:
    return dict(load_state().get("settings") or {})


def update_settings(patch: dict[str, Any]) -> dict[str, Any]:
    state = load_state()
    settings = dict(state.get("settings") or {})
    for key in ("os_notify", "sound", "muted"):
        if key in patch:
            settings[key] = bool(patch[key])
    state["settings"] = settings
    save_state(state)
    return settings


def _digest(session_key: str, command_preview: str, pattern_key: str) -> str:
    blob = f"{session_key}|{pattern_key}|{command_preview}".encode("utf-8", errors="replace")
    return hashlib.sha256(blob).hexdigest()[:16]


def enqueue_approval(**kwargs: Any) -> dict[str, Any]:
    preview = needs_redact.redact_text(str(kwargs.get("command") or ""))
    desc = needs_redact.redact_text(str(kwargs.get("description") or ""), max_len=200)
    raw_keys = kwargs.get("pattern_keys")
    keys: list[str] = []
    if isinstance(raw_keys, list):
        keys = [str(k)[:64] for k in raw_keys if k][:8]
    pk = str(kwargs.get("pattern_key") or (keys[0] if keys else ""))[:64]
    session_key = str(kwargs.get("session_key") or "")[:200]
    digest = _digest(session_key, preview, pk)
    entry = {
        "id": str(uuid.uuid4()),
        "digest": digest,
        "at": now_iso(),
        "status": "pending",
        "session_key": session_key,
        "session_id": str(kwargs.get("session_id") or "")[:200],
        "surface": str(kwargs.get("surface") or "")[:64],
        "pattern_key": pk,
        "pattern_keys": keys,
        "description": desc,
        "command_preview": preview,
        "turn_id": str(kwargs.get("turn_id") or "")[:120],
        "tool_call_id": str(kwargs.get("tool_call_id") or "")[:120],
        "request_id": str(kwargs.get("request_id") or "")[:120],
    }
    state = load_state()
    pending = [it for it in state.get("pending", []) if isinstance(it, dict)]
    pending = [it for it in pending if it.get("digest") != digest]
    pending.append(entry)
    if len(pending) > MAX_PENDING:
        pending = pending[-MAX_PENDING:]
    state["pending"] = pending
    save_state(state)
    return entry


def _match_index(
    pending: list[dict[str, Any]],
    *,
    item_id: str = "",
    digest: str = "",
    session_key: str = "",
    session_id: str = "",
) -> int:
    if item_id:
        for i, it in enumerate(pending):
            if it.get("id") == item_id:
                return i
    if digest:
        for i, it in enumerate(pending):
            if it.get("digest") == digest:
                return i
    if session_key:
        for i, it in enumerate(pending):
            if it.get("session_key") == session_key:
                return i
    if session_id:
        for i, it in enumerate(pending):
            if it.get("session_id") == session_id:
                return i
    return -1


def resolve_approval(**kwargs: Any) -> dict[str, Any] | None:
    state = load_state()
    pending = [it for it in state.get("pending", []) if isinstance(it, dict)]
    history = [it for it in state.get("history", []) if isinstance(it, dict)]

    preview = needs_redact.redact_text(str(kwargs.get("command") or ""))
    pk = str(kwargs.get("pattern_key") or "")[:64]
    session_key = str(kwargs.get("session_key") or "")
    digest = ""
    if session_key or preview or pk:
        digest = _digest(session_key, preview, pk)

    idx = _match_index(
        pending,
        item_id=str(kwargs.get("item_id") or ""),
        digest=digest,
        session_key=session_key,
        session_id=str(kwargs.get("session_id") or ""),
    )
    if idx < 0:
        return None

    matched = dict(pending[idx])
    matched["status"] = "resolved"
    matched["choice"] = str(kwargs.get("choice") or "")[:64]
    matched["decided_by"] = str(kwargs.get("decided_by") or "")[:64]
    matched["resolved_at"] = now_iso()
    pending.pop(idx)
    history.append(matched)
    if len(history) > MAX_HISTORY:
        history = history[-MAX_HISTORY:]
    state["pending"] = pending
    state["history"] = history
    save_state(state)
    return matched


def list_pending() -> list[dict[str, Any]]:
    return [it for it in load_state().get("pending", []) if isinstance(it, dict)]


def list_history() -> list[dict[str, Any]]:
    return [it for it in load_state().get("history", []) if isinstance(it, dict)]


def clear_pending() -> int:
    state = load_state()
    n = len(state.get("pending") or [])
    state["pending"] = []
    save_state(state)
    return n


def dismiss(item_id: str) -> bool:
    state = load_state()
    pending = [it for it in state.get("pending", []) if isinstance(it, dict)]
    next_pending = [it for it in pending if it.get("id") != item_id]
    if len(next_pending) == len(pending):
        return False
    state["pending"] = next_pending
    save_state(state)
    return True


def snapshot() -> dict[str, Any]:
    pending = list_pending()
    return {
        "ok": True,
        "count": len(pending),
        "pending": pending,
        "history": list(reversed(list_history()))[:20],
        "settings": get_settings(),
    }


def to_markdown_queue(items: list[dict[str, Any]] | None = None) -> str:
    rows = items if items is not None else list_pending()
    if not rows:
        return "(Needs You — nothing waiting)"
    lines = [f"Needs You — {len(rows)} waiting"]
    for i, it in enumerate(reversed(rows), 1):
        bit = (it.get("description") or it.get("command_preview") or "")[:100]
        lines.append(
            f"{i}. `{it.get('pattern_key') or 'approval'}` "
            f"({it.get('surface') or '?'}) — {bit}"
        )
    return "\n".join(lines)
