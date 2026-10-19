#!/usr/bin/env bash
# NAME: PHP Syntax
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"

if ! command -v php &>/dev/null; then
  echo "php not in PATH — install PHP 8.4+"
  exit 2
fi

# php -l accepts multiple filenames in one invocation; xargs batches them to
# avoid spawning a new process per file, which is the main cost on NTFS.
output=$(find "$BACKEND" -name "*.php" \
  -not -path "*/vendor/*" \
  -not -path "*/storage/*" \
  -not -path "*/bootstrap/cache/*" \
  -print0 | xargs -0 php -l 2>&1)
exit_code=$?

if [[ "$exit_code" -ne 0 ]]; then
  # Print only the error lines, not the noise for clean files
  printf '%s\n' "$output" | grep -v "^No syntax errors detected"
  exit 1
fi

exit 0
