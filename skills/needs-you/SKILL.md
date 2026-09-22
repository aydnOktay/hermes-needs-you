---
name: needs-you
description: >
  Use when explaining pending Hermes approvals, the Needs You desk, or when
  the user asks what is waiting for human consent. Load with
  skill_view("needs-you:needs-you").
---

# needs-you

Full Desktop page for **pending approvals**. Hooks fill a local queue with
redacted previews. The human decides on the page (gateway `approval.respond`)
or in the session chat.

## Notes

- Tools list/clear the **local** queue only
- Clear does not deny a live approval
- Prefer pointing the user at the Needs You sidebar page
