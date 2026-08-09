#!/usr/bin/env bash
# Capture every mobile surface from a booted simulator running a dev build.
#
# Navigation is by deep link (expo-router honours the `driiva://` scheme) so the
# run is reproducible and does not depend on tapping coordinates that shift with
# every layout change. Sign-in is the one exception; it needs real text entry,
# which is what idb provides.
#
#   ./scripts/capture-mobile-screens.sh <out-dir>
#
# Expects: simulator booted with the app installed, emulators running and
# seeded (scripts/seed-emulator-demo.ts).
set -uo pipefail

OUT="${1:-/tmp/driiva-screens}"
BUNDLE="com.driiva.app"
export PATH="/Library/Frameworks/Python.framework/Versions/3.13/bin:$PATH"

mkdir -p "$OUT"

shot() {
  local name="$1"
  sleep "${2:-2}"
  xcrun simctl io booted screenshot "$OUT/$name.png" >/dev/null 2>&1 \
    && echo "  captured $name" \
    || echo "  FAILED $name"
}

open_route() {
  xcrun simctl openurl booted "driiva://$1" >/dev/null 2>&1
}

echo "Capturing to $OUT"

# Tab bar surfaces. expo-router route groups are parenthesised in the file tree
# but absent from the URL, so these are /dashboard and not /(tabs)/dashboard.
for route in dashboard trips record rewards profile; do
  open_route "$route"
  shot "$route" 3
done

# Stack screens reached from the profile menu, plus the Wave B leaderboard.
for route in leaderboard settings vehicle policy achievements support privacy terms trust; do
  open_route "$route"
  shot "$route" 3
done

echo "Done. $(ls -1 "$OUT"/*.png 2>/dev/null | wc -l | tr -d ' ') screenshots in $OUT"
