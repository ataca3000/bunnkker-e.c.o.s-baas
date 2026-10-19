#!/usr/bin/env bash
#
# ECOS Engineering Guardian V2 — pre-commit gate (TASK-ENG-V2-003)
#
# Blocks the commit unless the Engineering Guardian returns decision=allow.
# Fails CLOSED: if the Guardian is unreachable or the response is unparseable,
# the commit is blocked. There is no bypass flag by design (ADR-034).
#
# Install:
#   cp scripts/git-hooks/guardian-pre-commit.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# Required environment:
#   ECOS_API_URL   e.g. https://erp.example.com
#   ECOS_API_TOKEN a Sanctum bearer token
#
# Requires: curl, jq

set -u

if [ -z "${ECOS_API_URL:-}" ] || [ -z "${ECOS_API_TOKEN:-}" ]; then
    echo "Guardian: ECOS_API_URL / ECOS_API_TOKEN not set — failing closed." >&2
    exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
    echo "Guardian: jq is required — failing closed." >&2
    exit 1
fi

STAGED_FILES=$(git diff --cached --name-only)
if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
DIFF_JSON=$(git diff --cached | jq -Rs .)
FILES_JSON=$(printf '%s\n' "$STAGED_FILES" | jq -R . | jq -s .)

PAYLOAD=$(jq -n \
    --arg branch "$BRANCH" \
    --argjson files "$FILES_JSON" \
    --argjson diff "$DIFF_JSON" \
    '{trigger_source: "pre_commit", branch: $branch, changed_files: $files, diff_content: $diff}')

RESPONSE=$(curl -sS --max-time 120 \
    -H "Authorization: Bearer $ECOS_API_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -X POST "$ECOS_API_URL/api/system/engineering/guardian/runs" \
    -d "$PAYLOAD") || {
    echo "Guardian unreachable — failing closed. Commit blocked." >&2
    exit 1
}

ALLOWED=$(printf '%s' "$RESPONSE" | jq -r '.data.allowed // empty' 2>/dev/null)

if [ "$ALLOWED" = "true" ]; then
    echo "Guardian: commit allowed."
    exit 0
fi

REASON=$(printf '%s' "$RESPONSE" | jq -r '.data.run.decision_reason // "see guardian report"' 2>/dev/null)
RUN_ID=$(printf '%s' "$RESPONSE" | jq -r '.data.run.id // "unknown"' 2>/dev/null)

echo "" >&2
echo "Commit blocked by Engineering Guardian (run $RUN_ID)." >&2
echo "Reason: $REASON" >&2
echo "Review the guardian report and repair the change; there is no bypass flag." >&2
exit 1
