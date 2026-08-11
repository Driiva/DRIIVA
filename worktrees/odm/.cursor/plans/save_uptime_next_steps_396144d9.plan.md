---
name: Save Uptime Next Steps
overview: Add the deploy and UptimeRobot setup steps to project documentation so they are saved for later.
todos: []
isProject: false
---

# Save "Next Steps" for Health / Uptime

## Goal

Persist the two follow-up steps (deploy functions, add UptimeRobot monitor) in the repo so you can find them later.

## Option A — Add to existing TECH_ROADMAP (recommended)

In [docs/TECH_ROADMAP.md](docs/TECH_ROADMAP.md), right after the existing uptime monitoring note (the line that says "Configure UptimeRobot (or similar) to hit this URL every 5 minutes..."), add a **Next steps** bullet list:

- Deploy: `firebase deploy --only functions`
- In UptimeRobot: add an HTTP(s) monitor for `https://<region>-<project-id>.cloudfunctions.net/health` with a 5-minute interval and your alert contacts.

Keeps all uptime-related docs in one place.

## Option B — New file

Create e.g. `docs/DEPLOYMENT_NEXT_STEPS.md` or `docs/UPTIME_SETUP.md` containing the same two steps (and optionally the health URL explanation). Use if you prefer a dedicated checklist file.

---

**Recommendation:** Option A (append to TECH_ROADMAP under the current uptime monitoring paragraph). One edit, no new file.
