#!/usr/bin/env bash
# One-shot: launch the installed dev build, sign it in against the seeded
# emulator, and capture every routable surface.
#
#   ./scripts/review-mobile.sh [out-dir]
#
# Preconditions, each checked rather than assumed:
#   - a simulator is booted with com.driiva.app installed
#   - Metro is serving with EXPO_PUBLIC_FIREBASE_EMULATOR=1
#   - the Firebase emulators are up and seeded (scripts/seed-emulator-demo.ts)
set -uo pipefail

OUT="${1:-/tmp/driiva-screens}"
BUNDLE="com.driiva.app"
HERE="$(cd "$(dirname "$0")" && pwd)"

fail() { echo "PRECONDITION FAILED: $1"; exit 1; }

xcrun simctl listapps booted 2>/dev/null | grep -q "$BUNDLE" \
  || fail "$BUNDLE is not installed on the booted simulator."
curl -s -o /dev/null --max-time 5 http://localhost:8081/status \
  || fail "Metro is not answering on 8081."
curl -s -o /dev/null --max-time 5 http://127.0.0.1:4000 \
  || fail "Firebase emulators are not answering on 4000."

mkdir -p "$OUT"

echo "Launching $BUNDLE"
xcrun simctl launch booted "$BUNDLE" >/dev/null 2>&1
sleep 12   # first launch pulls the whole dev bundle from Metro

# The signed-out landing screen is a surface worth reviewing in its own right,
# so capture it before authenticating.
xcrun simctl io booted screenshot "$OUT/auth-signin.png" >/dev/null 2>&1 \
  && echo "  captured auth-signin"

"$HERE/sim-signin.sh" || echo "  sign-in driver reported a problem, continuing"

"$HERE/capture-mobile-screens.sh" "$OUT"
