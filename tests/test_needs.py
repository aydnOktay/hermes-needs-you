"""Local checks — no Hermes / network required."""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["HERMES_HOME"] = tempfile.mkdtemp(prefix="needs-you-test-")

import needs_hooks
import needs_redact
import needs_store
import needs_tools


def test_redact() -> None:
    text = needs_redact.redact_text("export API_KEY=sk-secret123456789 curl https://x")
    assert "[redacted]" in text
    assert "sk-secret" not in text


def test_enqueue_resolve() -> None:
    entry = needs_store.enqueue_approval(
        session_key="sess-1",
        session_id="sid-1",
        surface="gateway",
        pattern_key="rm_rf",
        description="Dangerous delete",
        command="rm -rf /tmp/demo",
    )
    assert entry["status"] == "pending"
    assert entry["command_preview"]
    pending = needs_store.list_pending()
    assert len(pending) == 1
    done = needs_store.resolve_approval(
        session_key="sess-1",
        command="rm -rf /tmp/demo",
        pattern_key="rm_rf",
        choice="once",
    )
    assert done is not None
    assert done["choice"] == "once"
    assert needs_store.list_pending() == []
    assert needs_store.list_history()


def test_hooks() -> None:
    needs_store.clear_pending()
    needs_hooks.on_pre_approval_request(
        session_key="k2",
        session_id="s2",
        surface="cli",
        pattern_key="sudo",
        description="sudo",
        command="sudo apt update",
    )
    assert needs_store.list_pending()
    needs_hooks.on_post_approval_response(
        session_key="k2",
        command="sudo apt update",
        pattern_key="sudo",
        choice="deny",
    )
    assert needs_store.list_pending() == []


def test_tools() -> None:
    needs_store.clear_pending()
    needs_store.enqueue_approval(
        session_key="t1",
        pattern_key="curl",
        command="curl https://example.com",
    )
    data = json.loads(needs_tools.needs_you_list({"markdown": True}, extra=1))
    assert data["ok"] is True
    assert data["count"] >= 1
    assert "markdown" in data
    cleared = json.loads(needs_tools.needs_you_clear({"confirm": True}))
    assert cleared["ok"] is True
    assert cleared["count"] == 0


if __name__ == "__main__":
    test_redact()
    test_enqueue_resolve()
    test_hooks()
    test_tools()
    print("ok")
