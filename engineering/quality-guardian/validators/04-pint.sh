#!/usr/bin/env bash
# NAME: Laravel Pint
#
# RATCHET GATE — scoped to the current push, regression-detecting.
#
# ─── THE ALGORITHM ──────────────────────────────────────────────────────────
#
#  1. RESOLVE THE PUSH RANGE (merge-base), first match wins:
#       a. $GUARDIAN_PUSH_RANGE          — explicit override / CI
#       b. git merge-base @{upstream} HEAD — the configured upstream
#       c. git merge-base origin/HEAD HEAD — default remote branch
#       d. none                           — first push of a branch with no remote
#
#     `A...HEAD` (three-dot) is used, which git resolves through the MERGE BASE.
#     That is what makes this correct when the target branch has moved on: only
#     commits unique to this branch are considered, never the other side's.
#
#  2. COLLECT CHANGED PHP FILES
#       git diff --name-only --diff-filter=ACMR <base>...HEAD -- '*.php'
#     Deleted files are excluded (ACMR). Files that no longer exist are dropped.
#     If the set is empty the validator PASSES — nothing in this push is PHP.
#
#  3. SCAN ONLY THOSE FILES
#     Pint runs against that list and nothing else, batched to stay inside the
#     platform's command-line length limit. An untouched legacy file is never
#     handed to Pint, so it cannot fail this gate. That is requirement
#     "untouched legacy file → ignored", enforced by construction rather than by
#     filtering afterwards.
#
#  4. CLASSIFY EACH VIOLATION against engineering/baselines/pint-baseline.json:
#       • file NOT in the baseline                  → NEW violation      → FAIL
#       • file in baseline, carries a fixer it did
#         not have before                           → STYLE REGRESSION   → FAIL
#       • file in baseline, same or fewer fixers    → pre-existing debt  → allow
#
#     Step 4 is what makes step 3 usable here. Measured on this repository:
#     3,759 PHP files have changed since origin/main and ALL 628 violating files
#     are inside that set, because the branch is 139 commits ahead. Scoping alone
#     would therefore block the push exactly as the old gate did. The baseline is
#     what distinguishes "you touched a file that was already messy" from "you
#     made it worse" — which is precisely the requirement: a modified file fails
#     on a style REGRESSION, not on inherited debt.
#
#     Fallback: when no range can be resolved (step 1d), the validator scans the
#     whole backend and applies the same classification. Strictly safer — more is
#     scanned, and the verdict rule is unchanged.
#
# Why this replaced the previous behaviour: the old validator ran
# `pint --test` across the whole backend with no baseline, so 628 legacy files
# blocked every push even when the commits being pushed touched none of them.
# Measured then: 0 of 628 introduced by the commits under test, and 87 of 87
# sampled files already violating at their own commit's parent
# (TASK-GUARDIAN-PREPUSH-RCA-001).
set -uo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
MODE="${2:-full}"
BACKEND="$PROJECT_ROOT/backend"
GUARDIAN="$PROJECT_ROOT/engineering/quality-guardian"
BASELINE="$PROJECT_ROOT/engineering/baselines/pint-baseline.json"

command -v php  &>/dev/null || { echo "php not in PATH"; exit 2; }
command -v node &>/dev/null || { echo "node not in PATH — required by the ratchet engine"; exit 2; }

[[ -f "$BACKEND/vendor/bin/pint" ]] || {
  echo "vendor/bin/pint not found — run: cd backend && composer install"; exit 2; }

[[ -f "$BASELINE" ]] || {
  echo "Pint baseline missing: $BASELINE"
  echo "Record it with: engineering/quality-guardian/bin/record-baselines.sh pint"
  exit 2; }

TMP_REPORT="$(mktemp)"
TMP_CHANGED="$(mktemp)"
TMP_MERGED="$(mktemp)"
trap 'rm -f "$TMP_REPORT" "$TMP_CHANGED" "$TMP_MERGED"' EXIT

# ── 1. Resolve the merge base ───────────────────────────────────────────────
BASE=""
RANGE_SOURCE=""

if [[ -n "${GUARDIAN_PUSH_RANGE:-}" ]]; then
  BASE="$GUARDIAN_PUSH_RANGE"
  RANGE_SOURCE="GUARDIAN_PUSH_RANGE"
elif UP="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)" && [[ -n "$UP" ]]; then
  BASE="$(git -C "$PROJECT_ROOT" merge-base "$UP" HEAD 2>/dev/null)"
  RANGE_SOURCE="upstream ($UP)"
elif git -C "$PROJECT_ROOT" rev-parse --verify --quiet origin/HEAD >/dev/null 2>&1; then
  BASE="$(git -C "$PROJECT_ROOT" merge-base origin/HEAD HEAD 2>/dev/null)"
  RANGE_SOURCE="origin/HEAD"
fi

# ── 2. Collect changed PHP files ────────────────────────────────────────────
SCOPED=0
if [[ -n "$BASE" ]]; then
  git -C "$PROJECT_ROOT" diff --name-only --diff-filter=ACMR "${BASE}...HEAD" -- '*.php' \
    2>/dev/null > "$TMP_CHANGED" || : > "$TMP_CHANGED"

  # Drop anything that no longer exists on disk.
  : > "$TMP_MERGED"
  while IFS= read -r f; do
    [[ -n "$f" && -f "$PROJECT_ROOT/$f" ]] && printf '%s\n' "$f" >> "$TMP_MERGED"
  done < "$TMP_CHANGED"
  mv "$TMP_MERGED" "$TMP_CHANGED"

  COUNT=$(wc -l < "$TMP_CHANGED" | tr -d ' ')
  echo "push range      : ${BASE:0:12}...HEAD   (via $RANGE_SOURCE)"
  echo "changed PHP     : $COUNT file(s)"

  if [[ "$COUNT" -eq 0 ]]; then
    echo ""
    echo "No PHP files in this push — nothing for Pint to check."
    exit 0
  fi
  SCOPED=1
else
  echo "push range      : unresolved (no upstream, no origin/HEAD)"
  echo "falling back to a whole-backend scan; the baseline classification is unchanged."
fi

# ── 3. Scan ─────────────────────────────────────────────────────────────────
cd "$BACKEND" || exit 2

if [[ "$SCOPED" -eq 1 ]]; then
  # Pint is invoked per batch to stay within the OS argument-length limit.
  # Each batch emits its own JSON report; ratchet.js merges them.
  : > "$TMP_REPORT"
  BATCH=()
  BATCHES=0
  SCANNED=0

  # `< /dev/null` matters: php drains whatever stdin it is given. Without it the
  # child consumes the rest of the file feeding the read loop below, the loop
  # ends after the first batch, and the gate passes having scanned ~150 of
  # several thousand files — a silent under-scan that looks exactly like a pass.
  flush_batch() {
    [[ ${#BATCH[@]} -eq 0 ]] && return 0
    php vendor/bin/pint --test "${BATCH[@]}" </dev/null 2>/dev/null >> "$TMP_REPORT"
    printf '\n' >> "$TMP_REPORT"
    BATCHES=$((BATCHES + 1))
    SCANNED=$((SCANNED + ${#BATCH[@]}))
    BATCH=()
  }

  # Read on FD 3 so nothing a child does to stdin can truncate this loop.
  while IFS= read -r f <&3; do
    # Paths are repo-relative (backend/...); Pint runs from $BACKEND.
    BATCH+=("${f#backend/}")
    [[ ${#BATCH[@]} -ge 150 ]] && flush_batch
  done 3< "$TMP_CHANGED"
  flush_batch

  echo "scanned         : $SCANNED file(s) in $BATCHES batch(es)"

  # Refuse to pass on a partial scan — a gate that under-scans is worse than one
  # that fails, because it is indistinguishable from a clean result.
  if [[ "$SCANNED" -ne "$COUNT" ]]; then
    echo ""
    echo "INCOMPLETE SCAN: $SCANNED of $COUNT changed file(s) were scanned."
    echo "Refusing to report a result from a partial scan."
    exit 1
  fi
else
  php vendor/bin/pint --test > "$TMP_REPORT" 2>/dev/null
fi
# Pint exits 1 when violations exist. That is expected input to the ratchet, not
# a failure in itself, so its status is deliberately not propagated.

# ── 4. Classify against the baseline ────────────────────────────────────────
node "$GUARDIAN/lib/ratchet.js" compare-pint "$BASELINE" "$TMP_REPORT" "$TMP_CHANGED"
exit $?
