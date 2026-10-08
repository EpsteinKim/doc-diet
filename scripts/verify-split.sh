#!/usr/bin/env bash
# usage: verify-split.sh <original-copy> <record> <head> [code-dir...]
# exit 1 when: the record differs from the original, the head is over the line cap
# (DOC_DIET_MAX_HEAD_LINES, default 300), or a (record §N) pointer names a section the record
# does not have. Backtick names that cannot be found are warnings; the count is on the last line.
set -u
if [ $# -lt 3 ]; then
  echo "usage: $0 <original-copy> <record> <head> [code-dir...]" >&2
  exit 2
fi
orig=$1 record=$2 head=$3; shift 3; code=("$@")
cap=${DOC_DIET_MAX_HEAD_LINES:-300}
for f in "$orig" "$record" "$head"; do
  [ -f "$f" ] || { echo "FAIL: not a file: $f" >&2; exit 2; }
done
if ! cmp -s "$orig" "$record"; then
  echo "FAIL: record differs from original (cmp):" >&2
  cmp "$orig" "$record" >&2
  exit 1
fi
echo "OK: record is byte-identical to original ($(wc -c < "$record" | tr -d ' ') bytes)"
fail=0

lines=$(wc -l < "$head" | tr -d ' ')
if [ "$lines" -gt "$cap" ]; then
  echo "FAIL: head is $lines lines, cap is $cap" >&2
  fail=1
fi

# Every (record §N) pointer (or (기록 §N)) must name a section the record has: a heading "## N", "## N." or
# "## §N", or an inline "§N". A dotted number (§2.14) is matched as a whole token.
while IFS= read -r sec; do
  [ -n "$sec" ] || continue
  esc=${sec//./\\.}
  end='([^0-9.]|\.( |$)|$)'
  grep -qE "^#+ *§?${esc}${end}|§${esc}${end}" "$record" && continue
  echo "FAIL: (record §$sec) in head, but the record has no section $sec" >&2
  fail=1
done < <(grep -oE '\((record|기록) *§[0-9]+(\.[0-9]+)*' "$head" | grep -oE '§[0-9]+(\.[0-9]+)*' | tr -d '§' | sort -u)

# Backtick names. With a code dir, a name must exist in the code as a whole word; the record does
# not count, because a name deleted from the code is still in the record, and that is exactly the
# stale line this check is for. Without a code dir, the record is all there is. One grep pass with
# every name in a pattern file: a pass per name took minutes on a 5,000-file tree.
names=$(mktemp) found=$(mktemp)
# Only name-shaped tokens are checked: an expression (`{ paid }`, `?? x`), a Figma node id
# (`283:37093`) or a template (`A<yymmdd>`) is quoted for reading, not as a name the code has.
grep -o '`[^`]\{1,\}`' "$head" | sed 's/^`//; s/`$//; s/()$//' \
  | grep -vE '[[:space:]{}<>%…§]|^[0-9]+:[0-9]+$|^[?@(/]' | sort -u > "$names"   # `f()` is cited as a call; the code defines `f`
# Last segments of member paths ride along in the pattern file so one grep pass answers both.
grep -E '\.' "$names" | grep -v '/' | sed 's/.*\.//' | sort -u >> "$names"
sort -u -o "$names" "$names"
if [ ${#code[@]} -gt 0 ]; then
  where="${code[*]} as a whole word (deleted or renamed?)"
  # Files over 1 MB are skipped: they are dumps and lockfiles, and -w over a 40 MB JSON line is
  # where the minutes went.
  find "${code[@]}" \( -name node_modules -o -name .git -o -name dist -o -name build -o -name .output \
    -o -name .nitro -o -name .next -o -name vendor -o -name target \) -prune -o -type f -size -1024k -print0 2>/dev/null \
    | LC_ALL=C xargs -0 grep -howF -f "$names" 2>/dev/null | sort -u > "$found"
else
  where="record"
  grep -hoF -f "$names" "$record" | sort -u > "$found"
fi
warn=0
while IFS= read -r name; do
  [ -n "$name" ] || continue
  # A path (`src/lib/x.ts`, `server/api/ads/**`) is a file that must exist, not a string the code
  # contains. A member path (`Ad.baseDays`, `adMoney().unpaid`) is judged on its last segment.
  case $name in
    */*|*\**) compgen -G "$name" >/dev/null 2>&1 && continue ;;
    *.*) grep -qxF -- "${name##*.}" "$found" && continue ;;
  esac
  echo "WARN: \`$name\` not found in $where"
  warn=$((warn+1))
done < <(comm -23 "$names" "$found")
rm -f "$names" "$found"
echo "head: $lines lines, $(wc -c < "$head" | tr -d ' ') bytes; $warn name warning(s)"
exit $fail
