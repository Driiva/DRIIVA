# Cursor worktree rescue

Recovered 11 August 2026 from eleven worktrees under `~/.cursor/worktrees/DRIIVA-1/`
that existed only on one laptop, on detached HEADs belonging to no branch, and were
about to be deleted.

This is an **archive branch**, deliberately orphaned. It shares no history with `main`
and is not meant to be merged. It exists so the work is in the repo instead of on a
single disk.

## What is here

- `worktrees/<name>/` - new files those worktrees had created but never committed:
  hooks, `client/src/lib/sentry.ts`, a test directory, `functions/src/http/pricing.ts`,
  logo assets.
- `patches/<name>-tracked.patch` - their uncommitted edits to tracked files, as
  `git diff --binary` against the commit each was sitting on.

## Secrets removed, deliberately

This repository is **public**. The original rescue carried live credentials, so before
anything came near here:

- every `.env` / `.env.local` was excluded (they held a real `DATABASE_URL` plus the
  `VITE_FIREBASE_*` set)
- every `.env` file-diff was stripped out of the patches
- a real Neon connection string hardcoded in `server/db.ts` was replaced with
  `postgresql://REDACTED_BY_RESCUE_SCRUB` (2 occurrences)

Verified zero of each before pushing. The patches therefore **will not apply cleanly**
where a `.env` hunk was removed, which is the correct trade for a public repo.

The unscrubbed originals stay off git, at `~/Documents/Driiva-cursor-rescue` (chmod 700).

## Provenance

The eleven worktrees pointed at only five distinct commits, all from February 2026 on
the pre-rebuild "Initial Driiva export from Replit" lineage. Those commits are tagged
locally as `rescue/cursor-<sha>` and are **not** pushed: two of them carry `.env` files
in their trees, and `.env` has never been in this repo's public history.

## A real finding worth acting on

Those worktrees had a live Neon `DATABASE_URL` hardcoded in `server/db.ts`. Current
`main` does not - it reads `process.env.DATABASE_URL` and only shows a
`user:pass@host` placeholder in an error message. If that Neon credential is still
valid, rotate it.
