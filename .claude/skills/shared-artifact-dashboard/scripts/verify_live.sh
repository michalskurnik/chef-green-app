#!/usr/bin/env bash
# Verify the published page equals your build (the platform only adds a small wrapper).
#   bash verify_live.sh <build.html> <live index.html saved by `Artifact read path:index.html`> [marker text]
# Expected: missing-from-live 0, wrapper lines about 5, marker found 1.
set -u
build="$1"; live="$2"; marker="${3:-}"
d=$(diff <(fold -w 200 "$build") <(fold -w 200 "$live"))
missing=$(printf '%s\n' "$d" | grep -c '^<' || true)
added=$(printf '%s\n' "$d" | grep -c '^>' || true)
echo "missing-from-live: $missing  wrapper-lines: $added"
if [ -n "$marker" ]; then printf 'marker found: '; grep -c -- "$marker" "$live" || true; fi
[ "$missing" = "0" ] && echo "OK: live page contains the whole build" || { echo "MISMATCH: live page differs from the build"; exit 1; }
