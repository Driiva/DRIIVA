#!/usr/bin/env bash
# Capture every mobile surface from a booted simulator running a dev build.
#
# Navigation is by deep link (expo-router honours the `driiva://` scheme) so the
# run is reproducible and does not depend on tapping coordinates that shift with
# every layout change. Route groups are parenthesised in the file tree but
# absent from the URL, so the tab screens are /dashboard, not /(tabs)/dashboard.
#
#   ./scripts/capture-mobile-screens.sh <out-dir>
#
# Expects: simulator booted with the app installed, Metro running with
# EXPO_PUBLIC_FIREBASE_EMULATOR=1, emulators running and seeded
# (scripts/seed-emulator-demo.ts), and the app already signed in
# (scripts/sim-signin.sh).
#
# Not captured here, because they are transient states rather than routes and
# need real interaction: the record screen's post-trip "was this you driving?"
# confirmation, and the refund moment that follows a scored trip.
set -uo pipefail

OUT="${1:-/tmp/driiva-screens}"
BUNDLE="com.driiva.app"
mkdir -p "$OUT"

# A screenshot of the springboard is not evidence of anything. Fail loudly
# rather than filing a home screen as a product surface.
assert_foreground() {
  local state
  state="$(xcrun simctl listapps booted 2>/dev/null | grep -c "$BUNDLE")"
  if [ "$state" -eq 0 ]; then
    echo "ERROR: $BUNDLE is not installed on the booted simulator."
    exit 1
  fi
}

shot() {
  local name="$1"
  sleep "${2:-3}"
  if xcrun simctl io booted screenshot "$OUT/$name.png" >/dev/null 2>&1; then
    echo "  captured $name"
  else
    echo "  FAILED $name"
  fi
}

open_route() {
  xcrun simctl openurl booted "driiva://$1" >/dev/null 2>&1
}

assert_foreground
echo "Capturing to $OUT"

# Tab bar surfaces.
for route in dashboard trips record rewards profile; do
  open_route "$route"
  shot "tab-$route"
done

# Stack screens from the profile menu, plus the Wave B leaderboard.
for route in leaderboard settings vehicle policy achievements support privacy terms trust; do
  open_route "$route"
  shot "stack-$route"
done

# A real trip detail, so the five-factor breakdown and the route polyline are
# both exercised against seeded GPS batches rather than an empty state.
open_route "trips/seed-trip-000"
shot "trip-detail"

COUNT="$(ls -1 "$OUT"/*.png 2>/dev/null | wc -l | tr -d ' ')"
echo "Done. $COUNT screenshots in $OUT"
