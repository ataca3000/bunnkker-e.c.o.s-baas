#!/usr/bin/env bash
# NAME: PHPStan
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"

if ! command -v php &>/dev/null; then
  echo "php not in PATH"
  exit 2
fi

PHPSTAN=""
for candidate in "$BACKEND/vendor/bin/phpstan" "$BACKEND/vendor/bin/phpstan.phar"; do
  [[ -f "$candidate" ]] && PHPSTAN="$candidate" && break
done

if [[ -z "$PHPSTAN" ]]; then
  echo "phpstan not found in vendor/bin — run: cd backend && composer install"
  exit 2
fi

if [[ ! -f "$BACKEND/.env" ]]; then
  echo "backend/.env not found — PHPStan needs the app environment to resolve facades"
  exit 2
fi

cd "$BACKEND"
# || exit 1 remaps any non-zero exit (including PHPStan's exit 2 for config errors)
# so the guardian treats all failures as FAIL rather than SKIP.
php "$PHPSTAN" analyse --no-progress --memory-limit=512M 2>&1 || exit 1
