"""Tool handlers — always return JSON strings, never raise."""

from __future__ import annotations

import json

import needs_store


def needs_you_list(args: dict, **kwargs) -> str:
    del kwargs
    try:
        payload = args if isinstance(args, dict) else {}
        snap = needs_store.snapshot()
        if payload.get("markdown") is not False:
            snap["markdown"] = needs_store.to_markdown_queue(snap.get("pending") or [])
        return json.dumps(snap, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"ok": False, "error": str(exc)})


def needs_you_clear(args: dict, **kwargs) -> str:
    del kwargs
    try:
        payload = args if isinstance(args, dict) else {}
        if payload.get("confirm") is not True:
            return json.dumps(
                {"ok": False, "error": "pass confirm=true to clear the local queue"}
            )
        n = needs_store.clear_pending()
        return json.dumps({"ok": True, "cleared": n, "count": 0, "pending": []})
    except Exception as exc:
        return json.dumps({"ok": False, "error": str(exc)})
