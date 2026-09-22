<p align="center">
  <img src="logo.png" alt="Needs You — Hermes Agent" width="160" />
</p>

# Needs You

**Hermes is waiting. One page for everything that needs you.**

A Hermes Desktop plugin: the pending **approval queue** as a full page —
not a chip that only blinks, not a tray you forget. Leave the chat. When
the agent hits a dangerous command, it lands here. Approve once, allow for
the session, deny, or jump back to the session.

Repo: https://github.com/aydnOktay/hermes-needs-you

POWERED BY HERMES AGENT · COMMUNITY PLUGIN · v0.1.0

Disclosure — stores **redacted** command previews and approval metadata under
`$HERMES_HOME/plugin-data/needs-you/`. Nothing leaves the machine. No API keys.

## What you get

| | |
| --- | --- |
| **Full page** Sidebar **Needs You**, palette-friendly route `/needs-you`. | **Status chip** `needs you N` — click opens the page. |
| **Live queue** Hooks catch `pre_approval_request` / `post_approval_response`. | **Decide here** `approval.respond` via the gateway when possible. |
| **Notify** Optional chime + OS notify when a new item arrives. | **Safe storage** Secrets scrubbed before write; previews truncated. |

## Install

```powershell
hermes plugins install https://github.com/aydnOktay/hermes-needs-you.git
hermes plugins enable needs-you
```

Copy the Desktop package (Hermes 0.21 may skip it):

```powershell
New-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\hermes\desktop-plugins\needs-you" | Out-Null
Copy-Item "$env:LOCALAPPDATA\hermes\plugins\needs-you\desktop\plugin.js" "$env:LOCALAPPDATA\hermes\desktop-plugins\needs-you\plugin.js" -Force
```

Restart Hermes Desktop. Open **Needs You** in the sidebar.

## Use

- Trigger any approval (dangerous shell / code).
- Chip shows `needs you 1` — open the page.
- **Approve once** / **Allow session** / **Deny**, or **Open session**.
- Slash: `/needs`, `/needs clear`, `/needs help`

Tools: `needs_you_list`, `needs_you_clear` (local queue only — clear does **not** deny a live approval).

## v1 rules

- Unique modules (`needs_store` / `needs_hooks` / …)
- Observer hooks only enqueue/resolve local state; consent is via gateway RPC
- Redacted previews only — never persist raw secrets on purpose
- Full page (`ROUTES_AREA`) + sidebar + status chip

## Not this

- Not a Done Bell replacement (turn-finished chime) — complementary
- Not a Resetwatch / quota page
- Not an agent tool that auto-approves

## License

MIT
