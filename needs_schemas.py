"""JSON tool schemas."""

from __future__ import annotations

NEEDS_YOU_LIST = {
    "name": "needs_you_list",
    "description": (
        "List pending Hermes approvals waiting for the human (Needs You desk). "
        "Returns redacted command previews only."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "markdown": {
                "type": "boolean",
                "description": "Include a markdown summary field.",
            }
        },
        "additionalProperties": False,
    },
}

NEEDS_YOU_CLEAR = {
    "name": "needs_you_clear",
    "description": (
        "Clear the Needs You pending queue locally (does not approve or deny "
        "live gateway approvals)."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "confirm": {
                "type": "boolean",
                "description": "Must be true to clear.",
            }
        },
        "required": ["confirm"],
        "additionalProperties": False,
    },
}
