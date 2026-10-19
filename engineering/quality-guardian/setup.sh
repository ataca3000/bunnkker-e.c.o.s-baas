#!/usr/bin/env bash
# Installs git hooks from engineering/quality-guardian/hooks/ into .git/hooks/.
# Safe to re-run — backs up any existing non-guardian hook before replacing it.
set -euo pipefail

GUARDIAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$GUARDIAN_DIR/../.." && pwd)"
GIT_HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
SOURCE_HOOKS_DIR="$GUARDIAN_DIR/hooks"

if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
  printf 'Error: not a git repository: %s\n' "$PROJECT_ROOT" >&2
  exit 1
fi

printf 'Installing ECOS Engineering Guardian hooks...\n\n'

for hook in pre-commit pre-push; do
  src="$SOURCE_HOOKS_DIR/$hook"
  dest="$GIT_HOOKS_DIR/$hook"

  if [[ ! -f "$src" ]]; then
    printf '  [WARN] source hook not found: %s\n' "$src"
    continue
  fi

  if [[ -f "$dest" ]] && ! grep -q 'ECOS Engineering Guardian' "$dest" 2>/dev/null; then
    backup="${dest}.bak.$(date +%Y%m%d%H%M%S)"
    printf '  Backing up existing %s → %s\n' "$hook" "$(basename "$backup")"
    cp "$dest" "$backup"
  fi

  cp "$src" "$dest"
  chmod +x "$dest"
  printf '  [OK] .git/hooks/%s\n' "$hook"
done

printf '\nDone. Run %s to verify your setup:\n' "engineering/quality-guardian/guardian.sh"
printf '  bash engineering/quality-guardian/guardian.sh full\n\n'
