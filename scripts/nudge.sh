#!/usr/bin/env bash
# usage: nudge.sh session|post   (hook stdin JSON is passed through). Needs node; without it, stay silent.
command -v node >/dev/null 2>&1 || { echo '{}'; exit 0; }
exec node "$(dirname "$0")/nudge.mjs" "$1"
