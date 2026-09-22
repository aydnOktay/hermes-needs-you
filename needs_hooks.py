"""Approval observers — enqueue / resolve. Never raise."""

from __future__ import annotations

import needs_store


def on_pre_approval_request(**kwargs) -> None:
    try:
        needs_store.enqueue_approval(
            session_key=str(kwargs.get("session_key") or ""),
            session_id=str(kwargs.get("session_id") or ""),
            surface=str(kwargs.get("surface") or kwargs.get("platform") or ""),
            pattern_key=str(kwargs.get("pattern_key") or ""),
            pattern_keys=kwargs.get("pattern_keys"),
            description=str(kwargs.get("description") or ""),
            command=str(kwargs.get("command") or ""),
            turn_id=str(kwargs.get("turn_id") or ""),
            tool_call_id=str(kwargs.get("tool_call_id") or ""),
            request_id=str(kwargs.get("request_id") or ""),
        )
    except Exception:
        return


def on_post_approval_response(**kwargs) -> None:
    try:
        needs_store.resolve_approval(
            choice=str(kwargs.get("choice") or ""),
            decided_by=str(kwargs.get("decided_by") or ""),
            session_key=str(kwargs.get("session_key") or ""),
            session_id=str(kwargs.get("session_id") or ""),
            command=str(kwargs.get("command") or ""),
            pattern_key=str(kwargs.get("pattern_key") or ""),
        )
    except Exception:
        return
