"""needs-you — Hermes is waiting. One page for everything that needs you."""

from __future__ import annotations

import json
import sys
from pathlib import Path

_DIR = str(Path(__file__).resolve().parent)
if _DIR in sys.path:
    sys.path.remove(_DIR)
sys.path.insert(0, _DIR)

import needs_context
import needs_hooks
import needs_schemas
import needs_store
import needs_tools


def _slash_text(raw: object) -> str:
    if not isinstance(raw, str):
        return str(raw)
    text = raw.strip()
    if not text.startswith("{"):
        return text
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return text
    if isinstance(data, dict):
        md = data.get("markdown")
        if isinstance(md, str) and md.strip():
            return md.strip()
        if data.get("ok") is False:
            return f"(error: {data.get('error') or 'failed'})"
    return text


def _handle_slash(ctx, raw_args: str) -> str:
    del ctx
    parts = (raw_args or "").strip().split()
    verb = (parts[0].lower() if parts else "list")
    if verb in {"help", "?"}:
        return (
            "Usage:\n"
            "  /needs             — pending approvals\n"
            "  /needs list        — same\n"
            "  /needs clear       — clear local queue (not a live deny)\n"
            "Open the Needs You page in Desktop for Approve / Deny."
        )
    if verb in {"clear", "reset"}:
        return _slash_text(needs_tools.needs_you_clear({"confirm": True}))
    return _slash_text(needs_tools.needs_you_list({"markdown": True}))


def register(ctx) -> None:
    needs_context.set_ctx(ctx)

    ctx.register_tool(
        name="needs_you_list",
        toolset="needs_you",
        schema=needs_schemas.NEEDS_YOU_LIST,
        handler=needs_tools.needs_you_list,
    )
    ctx.register_tool(
        name="needs_you_clear",
        toolset="needs_you",
        schema=needs_schemas.NEEDS_YOU_CLEAR,
        handler=needs_tools.needs_you_clear,
    )
    ctx.register_hook("pre_approval_request", needs_hooks.on_pre_approval_request)
    ctx.register_hook("post_approval_response", needs_hooks.on_post_approval_response)

    try:
        ctx.register_command(
            "needs",
            handler=lambda raw: _handle_slash(ctx, raw),
            description="Needs You — pending approvals desk",
            args_hint="list|clear|help",
        )
    except TypeError:
        ctx.register_command(
            "needs",
            handler=lambda raw: _handle_slash(ctx, raw),
            description="Needs You — pending approvals desk",
        )

    skill_md = Path(__file__).parent / "skills" / "needs-you" / "SKILL.md"
    if skill_md.is_file():
        try:
            ctx.register_skill("needs-you", skill_md)
        except TypeError:
            ctx.register_skill("needs-you", str(skill_md))
