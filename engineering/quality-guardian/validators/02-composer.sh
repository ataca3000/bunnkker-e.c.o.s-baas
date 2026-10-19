#!/usr/bin/env bash
# NAME: Composer Validate
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"

if ! command -v composer &>/dev/null; then
  if command -v php &>/dev/null && [[ -f "$BACKEND/composer.phar" ]]; then
    COMPOSER_CMD="php $BACKEND/composer.phar"
  else
    echo "composer not in PATH and no composer.phar found in backend/"
    exit 2
  fi
else
  COMPOSER_CMD="composer"
fi

cd "$BACKEND"
$COMPOSER_CMD validate --no-interaction --no-check-all 2>&1
