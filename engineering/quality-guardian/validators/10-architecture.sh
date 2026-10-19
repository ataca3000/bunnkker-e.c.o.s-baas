#!/usr/bin/env bash
# NAME: Architecture
#
# Enforces the frontend dependency-graph ratchet (EPIC-2 Platform Architecture).
#
# The graph carries real debt today — a 23-feature cycle and layer violations
# where shared layers import from features/. Failing outright on that debt would
# block every commit, and the gate would be switched off within a day. That is
# exactly how the i18n lint rules ended up permanently red and ignored.
#
# So this ratchets instead: it compares against engineering/baselines/
# architecture.json and fails ONLY when a metric gets worse. Debt can shrink
# freely; it cannot grow silently. When it shrinks, the validator says so and
# asks for the baseline to be re-recorded.
#
# Measured, not asserted — see frontend/scripts/analyze-architecture.mjs.
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
MODE="${2:-full}"
FRONTEND="$PROJECT_ROOT/frontend"

if ! command -v node &>/dev/null; then
  echo "node not in PATH — install Node.js 22+"
  exit 2
fi

if [[ ! -f "$FRONTEND/scripts/analyze-architecture.mjs" ]]; then
  echo "architecture analyzer not found — skipping"
  exit 2
fi

if [[ ! -f "$PROJECT_ROOT/engineering/baselines/architecture.json" ]]; then
  echo "no architecture baseline — run: node scripts/analyze-architecture.mjs --accept"
  exit 2
fi

cd "$FRONTEND"

# Static import parsing only: no compiler, no network. Measured at well under a
# second on 1,019 files, so this is safe to run on every commit.
node scripts/analyze-architecture.mjs --check 2>&1
