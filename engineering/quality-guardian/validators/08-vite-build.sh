#!/usr/bin/env bash
# NAME: Vite Production Build
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
FRONTEND="$PROJECT_ROOT/frontend"

if ! command -v node &>/dev/null; then
  echo "node not in PATH — install Node.js 22+"
  exit 2
fi

if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo "frontend/node_modules not found — run: cd frontend && npm install"
  exit 2
fi

cd "$FRONTEND"
# `vite build`, NOT `npm run build`.
#
# The npm script is `tsc -b && vite build`, so calling it here would run a second,
# UNRATCHETED whole-repo type-check and fail on the certified TypeScript baseline —
# silently undoing validator 07's ratchet no matter how 07 is configured. Type
# safety is 07's job and is fully enforced there, against the baseline and
# per-file so a new error cannot hide behind a fixed one.
#
# This validator's job is the one thing tsc cannot tell us: does the bundler
# resolve every import and produce a build? That is what `vite build` checks.
#
# The same split already exists in docker/php/Dockerfile (`npx vite build`) and in
# CI, for the same reason — running `npm run build` in the image is what made the
# platform unbuildable in BUG-GL-009. The Guardian now matches them, so all three
# paths build the application the same way.
npx vite build 2>&1
