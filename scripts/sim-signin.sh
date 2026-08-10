#!/usr/bin/env bash
# Sign the simulator's Driiva build in against the seeded emulator account.
#
# Drives the real sign-in screen through idb rather than adding a dev-only
# auto-login to the app: a test-only bypass in shipped auth code is exactly the
# sort of thing that survives to production, and driving the real screen also
# proves the screen works.
#
# Field coordinates are resolved from the live accessibility tree, not
# hardcoded, so a layout change does not silently type into the wrong box.
set -uo pipefail

export PATH="/Library/Frameworks/Python.framework/Versions/3.13/bin:$PATH"
EMAIL="${DRIIVA_TEST_EMAIL:-test@driiva.co.uk}"
PASSWORD="${DRIIVA_TEST_PASSWORD:-driiva1}"
UDID="$(xcrun simctl list devices booted -j | python3 -c "
import json,sys
d=json.load(sys.stdin)['devices']
for runtime, devs in d.items():
    for dev in devs:
        if dev.get('state')=='Booted':
            print(dev['udid']); raise SystemExit
")"

if [ -z "$UDID" ]; then echo "No booted simulator."; exit 1; fi
echo "Simulator: $UDID"

# Centre of the first accessibility element whose label or value matches $1.
find_centre() {
  idb ui describe-all --udid "$UDID" 2>/dev/null | python3 -c "
import json,sys,re
needle=sys.argv[1].lower()
raw=sys.stdin.read().strip()
try:
    items=json.loads(raw)
except json.JSONDecodeError:
    items=[json.loads(l) for l in raw.splitlines() if l.strip()]
for el in items:
    hay=' '.join(str(el.get(k) or '') for k in ('AXLabel','AXValue','AXPlaceholderValue','type')).lower()
    if needle in hay:
        f=el.get('frame') or {}
        if f:
            print(int(f['x']+f['width']/2), int(f['y']+f['height']/2)); break
" "$1"
}

tap_and_type() {
  local needle="$1" text="$2"
  local coords; coords="$(find_centre "$needle")"
  if [ -z "$coords" ]; then echo "  could not locate field matching '$needle'"; return 1; fi
  echo "  tapping '$needle' at $coords"
  idb ui tap --udid "$UDID" $coords >/dev/null 2>&1
  sleep 1
  idb ui text --udid "$UDID" "$text" >/dev/null 2>&1
  sleep 1
}

echo "Signing in as $EMAIL"
tap_and_type "email" "$EMAIL"
tap_and_type "password" "$PASSWORD"

coords="$(find_centre 'sign in')"
if [ -n "$coords" ]; then
  echo "  submitting at $coords"
  idb ui tap --udid "$UDID" $coords >/dev/null 2>&1
else
  echo "  could not find the submit control"
fi

sleep 6
xcrun simctl io booted screenshot /tmp/driiva-after-signin.png >/dev/null 2>&1
echo "Post sign-in screenshot: /tmp/driiva-after-signin.png"
