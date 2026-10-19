#!/usr/bin/env bash
# Guardian self-test — proves the ratchet blocks regressions and allows the baseline.
#
# Runs entirely on synthetic fixtures in a temp directory. No application code, no
# repository file and no real baseline is read or written, so this is safe to run
# at any time.
#
#   bash engineering/quality-guardian/tests/ratchet.test.sh
#
# Exit 0 = every case behaved as specified.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RATCHET="$SCRIPT_DIR/../lib/ratchet.js"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# expect <description> <expected-exit> <command...>
expect() {
  local desc="$1" want="$2"; shift 2
  local out; out="$("$@" 2>&1)"; local got=$?
  if [[ "$got" == "$want" ]]; then
    printf '  \033[0;32mPASS\033[0m  %s\n' "$desc"
    PASS=$((PASS + 1))
  else
    printf '  \033[0;31mFAIL\033[0m  %s  (expected exit %s, got %s)\n' "$desc" "$want" "$got"
    printf '%s\n' "$out" | sed 's/^/          /'
    FAIL=$((FAIL + 1))
  fi
}

# ── Fixtures ────────────────────────────────────────────────────────────────
# Baseline: two known-dirty legacy files.
cat > "$TMP/pint-baseline.json" <<'JSON'
{
  "total": 2,
  "files": {
    "backend/Modules/Legacy/A.php": ["braces_position", "binary_operator_spaces"],
    "backend/Modules/Legacy/B.php": ["line_ending"]
  }
}
JSON

# Same two files, unchanged — the certified baseline.
cat > "$TMP/pint-same.json" <<'JSON'
{"result":"fail","files":[
  {"path":"Modules\\Legacy\\A.php","fixers":["braces_position","binary_operator_spaces"]},
  {"path":"Modules\\Legacy\\B.php","fixers":["line_ending"]}
]}
JSON

# One legacy file fixed — an improvement.
cat > "$TMP/pint-improved.json" <<'JSON'
{"result":"fail","files":[
  {"path":"Modules\\Legacy\\A.php","fixers":["braces_position","binary_operator_spaces"]}
]}
JSON

# A brand-new file violates — must block.
cat > "$TMP/pint-newfile.json" <<'JSON'
{"result":"fail","files":[
  {"path":"Modules\\Legacy\\A.php","fixers":["braces_position","binary_operator_spaces"]},
  {"path":"Modules\\Legacy\\B.php","fixers":["line_ending"]},
  {"path":"Modules\\Feature\\New.php","fixers":["concat_space"]}
]}
JSON

# A baseline file gains a fixer it never had — a regression inside legacy code.
cat > "$TMP/pint-regressed.json" <<'JSON'
{"result":"fail","files":[
  {"path":"Modules\\Legacy\\A.php","fixers":["braces_position","binary_operator_spaces","single_quote"]},
  {"path":"Modules\\Legacy\\B.php","fixers":["line_ending"]}
]}
JSON

# TypeScript baseline: 3 errors over 2 files.
cat > "$TMP/tsc-baseline.json" <<'JSON'
{"total":3,"byCode":{"TS7053":3},"byFile":{"src/a.tsx":2,"src/b.tsx":1}}
JSON

printf 'src/a.tsx(1,1): error TS7053: x\nsrc/a.tsx(2,1): error TS7053: x\nsrc/b.tsx(1,1): error TS7053: x\n' > "$TMP/tsc-same.log"
printf 'src/a.tsx(1,1): error TS7053: x\n' > "$TMP/tsc-improved.log"
printf 'src/a.tsx(1,1): error TS7053: x\nsrc/a.tsx(2,1): error TS7053: x\nsrc/b.tsx(1,1): error TS7053: x\nsrc/c.tsx(1,1): error TS2322: y\n' > "$TMP/tsc-more.log"
# Total is still 3, but b.tsx lost one and c.tsx gained one — the forgery case.
printf 'src/a.tsx(1,1): error TS7053: x\nsrc/a.tsx(2,1): error TS7053: x\nsrc/c.tsx(1,1): error TS2322: y\n' > "$TMP/tsc-swapped.log"

echo '{"total":4814}' > "$TMP/count-baseline.json"

printf '\n\033[1mGuardian ratchet self-test\033[0m\n\n'

echo "Pint"
expect "baseline unchanged → allowed"                 0 node "$RATCHET" compare-pint "$TMP/pint-baseline.json" "$TMP/pint-same.json"
expect "legacy file fixed → allowed (improvement)"    0 node "$RATCHET" compare-pint "$TMP/pint-baseline.json" "$TMP/pint-improved.json"
expect "NEW file violates → BLOCKED"                  1 node "$RATCHET" compare-pint "$TMP/pint-baseline.json" "$TMP/pint-newfile.json"
expect "baseline file gains a fixer → BLOCKED"        1 node "$RATCHET" compare-pint "$TMP/pint-baseline.json" "$TMP/pint-regressed.json"

# Batched scan: 04-pint.sh invokes Pint once per ~150 files to stay inside the
# OS argument limit, so the report holds SEVERAL concatenated JSON objects.
# A parser that reads only the first (or last) block silently under-reports and
# the gate goes green on an incomplete scan — the exact failure this guards.
cat > "$TMP/pint-batched.json" <<'JSON'
{"result":"fail","files":[
  {"path":"Modules\\Legacy\\A.php","fixers":["braces_position","binary_operator_spaces"]}
]}

{"result":"fail","files":[
  {"path":"Modules\\Legacy\\B.php","fixers":["line_ending"]}
]}
JSON

cat > "$TMP/pint-batched-new.json" <<'JSON'
{"result":"fail","files":[
  {"path":"Modules\\Legacy\\A.php","fixers":["braces_position","binary_operator_spaces"]}
]}

{"result":"fail","files":[
  {"path":"Modules\\Feature\\New.php","fixers":["concat_space"]}
]}
JSON

expect "batched report: both blocks parsed, at baseline → allowed" 0 \
  node "$RATCHET" compare-pint "$TMP/pint-baseline.json" "$TMP/pint-batched.json"
expect "batched report: violation in a LATER block → BLOCKED"      1 \
  node "$RATCHET" compare-pint "$TMP/pint-baseline.json" "$TMP/pint-batched-new.json"

echo
echo "TypeScript"
expect "error count unchanged → allowed"              0 node "$RATCHET" compare-tsc "$TMP/tsc-baseline.json" "$TMP/tsc-same.log"
expect "errors reduced → allowed"                     0 node "$RATCHET" compare-tsc "$TMP/tsc-baseline.json" "$TMP/tsc-improved.log"
expect "total rises → BLOCKED"                        1 node "$RATCHET" compare-tsc "$TMP/tsc-baseline.json" "$TMP/tsc-more.log"
expect "total flat but a file gains errors → BLOCKED" 1 node "$RATCHET" compare-tsc "$TMP/tsc-baseline.json" "$TMP/tsc-swapped.log"

echo
echo "Suppression count"
expect "count unchanged → allowed"                    0 node "$RATCHET" compare-count "$TMP/count-baseline.json" 4814 suppressions
expect "count falls → allowed"                        0 node "$RATCHET" compare-count "$TMP/count-baseline.json" 4700 suppressions
expect "count rises → BLOCKED"                        1 node "$RATCHET" compare-count "$TMP/count-baseline.json" 4815 suppressions

echo
echo "Baseline growth guard"
cp "$TMP/tsc-baseline.json" "$TMP/tsc-record.json"
expect "recording a LARGER baseline is refused"       1 node "$RATCHET" record-tsc "$TMP/tsc-record.json" "$TMP/tsc-more.log"
expect "recording a SMALLER baseline is allowed"      0 node "$RATCHET" record-tsc "$TMP/tsc-record.json" "$TMP/tsc-improved.log"
expect "explicit --allow-growth permits an increase"  0 node "$RATCHET" record-tsc "$TMP/tsc-record.json" "$TMP/tsc-more.log" --allow-growth

printf '\n%d passed, %d failed\n\n' "$PASS" "$FAIL"
[[ $FAIL -eq 0 ]] || exit 1
