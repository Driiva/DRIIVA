#!/usr/bin/env bash
#
# Run the visual gates end to end, from nothing.
#
# The design laws and the axe audit both need four things: the QA emulator, a
# seeded driver in it, a dev server pointed at that emulator, and a browser
# that will actually let the auth call through. Standing those up by hand takes
# three terminals, and a gate that takes three terminals is a gate people stop
# running, which is how design:laws spent a week reporting green on routes it
# was never measuring.
#
# Everything this starts, it stops, including on failure or Ctrl-C. Anything it
# finds already running, it leaves alone.
#
# WHY THIS LAUNCHES ITS OWN BROWSER, against the attach-by-default rule.
# That rule exists so anything touching Jamal's signed-in session uses his
# browser. This is the opposite: a gate driving a seeded emulator as a
# synthetic test driver must NOT run as him. It also cannot run in his profile,
# for a reason worth writing down because nobody would guess it.
#
# The Auth emulator embeds the REAL hostname in the PATH:
#
#   http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword
#
# So any content blocker holding a rule against "identitytoolkit.googleapis.com"
# blocks a request going to localhost. curl succeeds, the page gets
# net::ERR_BLOCKED_BY_CLIENT, and Firebase reports auth/network-request-failed,
# which looks exactly like a config error and is not one. ~/chrome-cdp-profile
# has 19 extensions. Two rounds of correct config changes could never have
# fixed it. A dedicated empty profile removes the whole layer, and unlike an
# allowlist it cannot rot when an extension updates its rules.
#
# STILL INCOMPLETE, do not read a green from this yet. The stack now comes up
# clean: the emulator is reused if already running, the driver is seeded, the
# client env is written where Vite will actually read it, and the gate gets its
# own extension-free browser. Two things are still open.
#
#   1. Sign-in. On the one full run of this script, the four authenticated
#      routes were STILL reported NOT REACHED against the clean browser, so the
#      extension block explains the ERR_BLOCKED_BY_CLIENT that was observed but
#      is not proven to be the only cause. That run's failure text was not
#      captured, so treat the clean profile as untested rather than as a fix.
#   2. FIXED (299b131). axe used to resolve axe-core through a literal
#      ../node_modules path, which does not exist in a git worktree, so the
#      audit died on ENOENT before checking anything and accessibility could
#      not be run from any branch. It resolves the module properly now.
#
# Usage:  ./scripts/run-gates.sh [--keep]      (--keep leaves the stack up)
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${GATE_PORT:-5202}"
CDP_PORT="${GATE_CDP_PORT:-9333}"
CHROME="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

EMU_PID=""; SRV_PID=""; BROWSER_PID=""
STARTED_EMULATOR=0
PROFILE_DIR=""
ENV_BACKUP=""

cleanup() {
  # .env.local is restored even under --keep: it is this script's scratch file,
  # not part of the stack, and leaving it behind changes how a plain `npm run
  # dev` behaves afterwards.
  if [ -n "$ENV_BACKUP" ]; then
    if [ "$ENV_BACKUP" = "__none__" ]; then rm -f .env.local
    else mv "$ENV_BACKUP" .env.local; fi
  fi
  [ "$KEEP" = "1" ] && { echo "gates: leaving the stack up as asked"; return; }
  [ -n "$SRV_PID" ] && kill "$SRV_PID" 2>/dev/null
  # Only stop the emulator if this run started it. Another agent's stack, or a
  # developer's own, is not ours to kill.
  [ "$STARTED_EMULATOR" = "1" ] && [ -n "$EMU_PID" ] && kill "$EMU_PID" 2>/dev/null
  if [ -n "$BROWSER_PID" ]; then
    kill "$BROWSER_PID" 2>/dev/null
    # Give Chrome a moment to release the profile before removing it, or the
    # rm fails with "Directory not empty" and leaves the profile behind.
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$BROWSER_PID" 2>/dev/null || break
      sleep 0.5
    done
  fi
  [ -n "$PROFILE_DIR" ] && rm -rf "$PROFILE_DIR" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

wait_for() { # wait_for <url> <label> <tries>
  local i=0
  until curl -s -o /dev/null --max-time 2 "$1"; do
    i=$((i+1)); [ "$i" -ge "${3:-60}" ] && { echo "gates: $2 never came up at $1"; return 1; }
    sleep 2
  done
}

up() { curl -s -o /dev/null --max-time 2 "$1"; }

# ── 1. Emulator ──────────────────────────────────────────────────────────────
# Reuse a stack that is already up. `firebase emulators:start` fails outright on
# a port clash ("Could not start Emulator UI, port taken"), which turned a
# perfectly usable running stack into a failed gate more than once.
if up "http://127.0.0.1:9098" && up "http://127.0.0.1:8085"; then
  echo "gates: an emulator is already running on 9098/8085, using it"
else
  echo "gates: starting the QA emulator"
  npm run qa:emulators >/tmp/driiva-gate-emulator.log 2>&1 &
  EMU_PID=$!
  STARTED_EMULATOR=1
  # Wait for BOTH emulators, not just Firestore. The seed authenticates first,
  # so waiting only on 8085 races Auth and fails with ECONNREFUSED on 9098.
  # Waiting on the wrong signal is the same mistake as a gate that reports on a
  # route it never reached.
  wait_for "http://127.0.0.1:8085" "the firestore emulator" 60 || exit 1
  wait_for "http://127.0.0.1:9098" "the auth emulator" 60 || exit 1
fi

echo "gates: seeding the driver"
npm run qa:seed >/tmp/driiva-gate-seed.log 2>&1 || { echo "gates: seed failed, see /tmp/driiva-gate-seed.log"; exit 1; }

# ── 2. Client env ────────────────────────────────────────────────────────────
# Written to .env.local, NOT exported. Vite resolves import.meta.env.VITE_* from
# env FILES; a shell export never reaches the client bundle. Exporting these is
# why the gate signed in against 9099/8080, where nothing listens, and read as
# a network error.
if [ -f .env.local ]; then ENV_BACKUP="$(mktemp)"; cp .env.local "$ENV_BACKUP"
else ENV_BACKUP="__none__"; fi
cat > .env.local <<'ENVEOF'
# Written by scripts/run-gates.sh. Restored on exit.
VITE_USE_FIREBASE_EMULATOR=true
VITE_EMULATOR_HOST=127.0.0.1
VITE_EMULATOR_AUTH_PORT=9098
VITE_EMULATOR_FIRESTORE_PORT=8085
ENVEOF

# ── 3. Dev server ────────────────────────────────────────────────────────────
echo "gates: starting the dev server on $PORT"
# Through `npm run dev`, not a bare tsx call: the server reads DATABASE_URL and
# the rest of its config from Doppler, and starting it directly dies on
# "DATABASE_URL must be set" before it ever binds a port.
PORT="$PORT" npm run dev >/tmp/driiva-gate-server.log 2>&1 &
SRV_PID=$!
if ! wait_for "http://localhost:$PORT" "the dev server" 60; then
  echo "gates: see /tmp/driiva-gate-server.log. If it is a Doppler error, run"
  echo "gates: 'doppler setup --no-interactive' in this worktree first."
  exit 1
fi

# ── 4. Clean browser ─────────────────────────────────────────────────────────
if [ ! -x "$CHROME" ]; then
  echo "gates: no Chrome at $CHROME. Set CHROME_BIN."; exit 1
fi
PROFILE_DIR="$(mktemp -d -t driiva-gate-profile)"
echo "gates: launching a clean browser on $CDP_PORT (no extensions, throwaway profile)"
"$CHROME" \
  --remote-debugging-port="$CDP_PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --headless=new \
  --disable-extensions \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-networking \
  about:blank >/tmp/driiva-gate-browser.log 2>&1 &
BROWSER_PID=$!
wait_for "http://127.0.0.1:$CDP_PORT/json/version" "the gate browser" 30 || exit 1

export CDP_URL="http://127.0.0.1:$CDP_PORT"
export DEV_URL="http://localhost:$PORT"
export APP_URL="http://localhost:$PORT"

# ── 5. Gates ─────────────────────────────────────────────────────────────────
STATUS=0
echo
echo "gates: design laws"
npm run design:laws || STATUS=1
echo
echo "gates: axe"
npm run axe || STATUS=1

echo
[ "$STATUS" = "0" ] && echo "gates: all green" || echo "gates: FAILED, see the output above"
exit "$STATUS"
