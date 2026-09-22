"""Dashboard/Desktop backend — mounted at /api/plugins/needs-you/."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter, Request

_ROOT = Path(__file__).resolve().parent.parent
_root_str = str(_ROOT)
if _root_str in sys.path:
    sys.path.remove(_root_str)
sys.path.insert(0, _root_str)

import needs_store  # noqa: E402

router = APIRouter()


def _payload(request_json: object) -> dict:
    if isinstance(request_json, dict):
        return request_json
    return {}


@router.get("/queue")
async def queue() -> dict:
    return needs_store.snapshot()


@router.post("/settings")
async def settings(request: Request) -> dict:
    try:
        body = _payload(await request.json())
    except Exception:
        body = {}
    settings = needs_store.update_settings(body)
    snap = needs_store.snapshot()
    snap["settings"] = settings
    return snap


@router.post("/dismiss")
async def dismiss(request: Request) -> dict:
    try:
        body = _payload(await request.json())
    except Exception:
        body = {}
    item_id = str(body.get("id") or "").strip()
    if not item_id:
        return {"ok": False, "error": "id is required"}
    ok = needs_store.dismiss(item_id)
    snap = needs_store.snapshot()
    snap["ok"] = ok
    if not ok:
        snap["error"] = "not found"
    return snap


@router.post("/clear")
async def clear() -> dict:
    n = needs_store.clear_pending()
    snap = needs_store.snapshot()
    snap["cleared"] = n
    return snap
