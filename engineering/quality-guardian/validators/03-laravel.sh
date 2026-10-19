#!/usr/bin/env bash
# NAME: Laravel Bootstrap
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"

if ! command -v php &>/dev/null; then
  echo "php not in PATH"
  exit 2
fi

if [[ ! -f "$BACKEND/.env" ]]; then
  echo "backend/.env not found — copy from .env.example and configure to run Laravel checks"
  exit 2
fi

cd "$BACKEND"
# Verify the framework boots. --version exits 0 even without a DB connection.
php artisan --version 2>&1

# optimize:clear purges config/route/view caches. It can fail when DB/Redis
# are unavailable locally (they run in Docker). Suppress failures here —
# the check is "does the framework load?", not "are services reachable?".
php artisan optimize:clear 2>&1 || true

echo "Laravel bootstrap OK."
