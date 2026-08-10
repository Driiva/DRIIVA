#!/usr/bin/env bash
#
# Run the visual gates end to end, from nothing.
#
# The design laws and the axe audit both need three things alive: the QA
# emulator, a seeded driver in it, and a dev server pointed at that emulator.
# Standing those up by hand takes three terminals, and a gate that takes three
# terminals is a gate people stop running, which is how design:laws spent a
# week reporting green on routes it was never measuring.
#
# Everything this starts, it stops, including on failure or Ctrl-C.
#
# KNOWN LIMITATION, do not read a green from this yet. The stack comes up and
# both gates run, but sign-in does not complete, so the four authenticated
# routes report NOT REACHED and the run correctly refuses to call itself a pass.
# The client reads its emulator ports from VITE_EMULATOR_AUTH_PORT and
# VITE_EMULATOR_FIRESTORE_PORT, and exporting them into the dev server here is
# not reaching import.meta.env. That last hop is the open piece.
#
# Usage:  ./scripts/run-gates.sh [--keep]      (--keep leaves the stack up)
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${GATE_PORT:-5202}"
KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

EMU_PID=""; SRV_PID=""
cleanup() {
  [ "$KEEP" = "1" ] && { echo "gates: leaving the stack up as asked"; return; }
  [ -n "$SRV_PID" ] && kill "$SRV_PID" 2>/dev/null
  [ -n "$EMU_PID" ] && kill "$EMU_PID" 2>/dev/null
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

echo "gates: starting the QA emulator"
npm run qa:emulators >/tmp/driiva-gate-emulator.log 2>&1 &
EMU_PID=$!
# Wait for BOTH emulators, not just Firestore. The seed authenticates first, so
# waiting only on 8085 races Auth and fails with ECONNREFUSED on 9098. Waiting
# on the wrong signal is the same mistake as a gate that reports on a route it
# never reached.
wait_for "http://127.0.0.1:8085" "the firestore emulator" 60 || exit 1
wait_for "http://127.0.0.1:9098" "the auth emulator" 60 || exit 1

echo "gates: seeding the driver"
npm run qa:seed >/tmp/driiva-gate-seed.log 2>&1 || { echo "gates: seed failed, see /tmp/driiva-gate-seed.log"; exit 1; }

echo "gates: starting the dev server on $PORT"
# The QA emulator runs on 8085/9098, not the Firebase defaults, and the client
# falls back to 9099/8080 unless told otherwise. Omitting these is why the first
# run signed in against an emulator holding no seeded driver and reported four
# routes NOT REACHED.
VITE_USE_FIREBASE_EMULATOR=true \
VITE_EMULATOR_AUTH_PORT=9098 \
VITE_EMULATOR_FIRESTORE_PORT=8085 \
PORT="$PORT" npx tsx server/index.ts >/tmp/driiva-gate-server.log 2>&1 &
SRV_PID=$!
wait_for "http://localhost:$PORT" "the dev server" 60 || exit 1

STATUS=0
echo
echo "gates: design laws"
DEV_URL="http://localhost:$PORT" npm run design:laws || STATUS=1
echo
echo "gates: axe"
DEV_URL="http://localhost:$PORT" npm run axe || STATUS=1

echo
[ "$STATUS" = "0" ] && echo "gates: all green" || echo "gates: FAILED, see the output above"
exit "$STATUS"
