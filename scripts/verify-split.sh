#!/usr/bin/env bash
# usage: verify-split.sh <original-copy> <record> <head> [code-dir]
set -u
if [ $# -lt 3 ]; then
  echo "usage: $0 <original-copy> <record> <head> [code-dir]" >&2
  exit 2
fi
orig=$1 record=$2 head=$3 code=${4:-}
for f in "$orig" "$record" "$head"; do
  [ -f "$f" ] || { echo "FAIL: not a file: $f" >&2; exit 2; }
done
if ! cmp -s "$orig" "$record"; then
  echo "FAIL: record differs from original (cmp):" >&2
  cmp "$orig" "$record" >&2
  exit 1
fi
echo "OK: record is byte-identical to original ($(wc -c < "$record" | tr -d ' ') bytes)"

warn=0
while IFS= read -r name; do
  [ -n "$name" ] || continue
  grep -qF -- "$name" "$record" && continue
  [ -n "$code" ] && [ -d "$code" ] && grep -rqF -- "$name" "$code" 2>/dev/null && continue
  echo "WARN: \`$name\` not found in record${code:+ or $code}"
  warn=$((warn+1))
done < <(grep -o '`[^`]\{1,\}`' "$head" | sed 's/^`//; s/`$//' | sort -u)
echo "head: $(wc -l < "$head" | tr -d ' ') lines, $(wc -c < "$head" | tr -d ' ') bytes; $warn name warning(s)"
