#!/usr/bin/env bash
# Strip trailing \n / \r literal-escape pollution from Vercel env vars directly.
# Use this when Doppler → Vercel sync is broken or absent.
# Never prints secret values. Temp file is deleted on exit.
#
# Usage: bash scripts/clean-vercel-env.sh <environment>
#   environment: production | preview | development

set -euo pipefail

ENV="${1:-production}"
TMPFILE="$(mktemp /tmp/vercel-env-audit.XXXXXX)"
trap 'rm -f "$TMPFILE"' EXIT INT TERM

echo "Pulling $ENV env from Vercel..."
vercel env pull "$TMPFILE" --environment="$ENV" --yes >/dev/null 2>&1

POLLUTED=0
CLEAN=0
FIXED_KEYS=""

# Use python for safe, portable parsing — no shell variable value exposure.
# Output: one line per polluted key, format "POLLUTED KEY NEW_VAL_LEN"
python3 - "$TMPFILE" <<'PY' | while IFS= read -r line; do
import os, re, sys, shlex
path = sys.argv[1]
with open(path, "r") as f:
    for raw in f:
        raw = raw.rstrip("\n")
        if not raw or raw.startswith("#"):
            continue
        m = re.match(r'^([A-Z_][A-Z0-9_]*)="(.*)"\s*$', raw)
        if not m:
            continue
        key, val = m.group(1), m.group(2)
        # Strip trailing literal \n / \r escape (possibly repeated)
        cleaned = re.sub(r'(\\n|\\r)+$', '', val)
        if cleaned != val:
            print(f"POLLUTED {key} {len(cleaned)}")
PY
  set -- $line
  status="$1"; key="$2"; new_len="$3"
  [[ "$status" != "POLLUTED" ]] && continue

  # Read cleaned value from the file again (never print it)
  clean_val="$(python3 -c "
import re, sys
with open('$TMPFILE') as f:
    for ln in f:
        m = re.match(r'^$key=\"(.*)\"\s*$', ln.rstrip('\n'))
        if m:
            v = re.sub(r'(\\\\n|\\\\r)+$', '', m.group(1))
            sys.stdout.write(v)
            break
")"

  # Remove old, add clean value via stdin
  vercel env rm "$key" "$ENV" --yes >/dev/null 2>&1 || true
  printf "%s" "$clean_val" | vercel env add "$key" "$ENV" >/dev/null 2>&1
  unset clean_val

  printf "✓ %-40s → len=%s\n" "$key" "$new_len"
  POLLUTED=$((POLLUTED + 1))
  FIXED_KEYS="$FIXED_KEYS $key"
done

echo
echo "Fixed $POLLUTED polluted keys in $ENV."
echo "Trigger a Vercel redeploy to rebuild with clean env."
