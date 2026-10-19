#!/usr/bin/env bash
# NAME: ADR Validator
# Enforces ECOS Architecture Decision Records:
#
#   Backend (DDD Module structure):
#     - Every Module must have Domain/, Application/, Infrastructure/, Presentation/
#     - Domain layer must NOT import from Infrastructure layer
#     - No DB::table() / DB::statement() in Domain models
#
#   Frontend (Feature-slice structure):
#     - Every feature with components/ must have types/ dir or types.ts
#     - Hooks must live in hooks/ not directly in components/
#     - No direct axios imports outside of *-service.ts files
#     - Components must not import pages from OTHER features (router exempt)
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"
FRONTEND="$PROJECT_ROOT/frontend/src"
MODULES="$BACKEND/Modules"

source "$(dirname "${BASH_SOURCE[0]}")/../lib/emit.sh"

# ── Backend: Module DDD Layer Structure ───────────────────────────────────────
# A directory is a "module" if it directly contains a Domain/ subdirectory.
# This handles both Modules/IAM/ (1-level) and Modules/Inventory/Products/ (2-level).
if [[ -d "$MODULES" ]]; then
  while IFS= read -r domain_path; do
    module_dir="${domain_path%/Domain}"
    rel="${module_dir#$PROJECT_ROOT/}"
    module_name="$(basename "$module_dir")"

    for layer in Domain Application Infrastructure Presentation; do
      if [[ ! -d "$module_dir/$layer" ]]; then
        emit_finding "MEDIUM" "adr-ddd-structure" "backend/${rel#backend/}" "0" \
          "Module '$module_name' is missing the $layer layer" \
          "Create $layer/ with required sub-directories (Domain→Models/Contracts/Exceptions, Application→Actions, Infrastructure→Providers, Presentation→Http)"
      fi
    done
  done < <(find "$MODULES" -mindepth 2 -maxdepth 3 -type d -name "Domain" 2>/dev/null)

  # Domain → Infrastructure import violation (single grep pass over all Domain PHP files)
  if grep -rlE 'use [A-Za-z\\]+\\Infrastructure\\' "$MODULES" \
       --include="*.php" \
       --exclude-dir=vendor 2>/dev/null | \
     grep "/Domain/" | \
     while IFS= read -r file; do
       rel="${file#$PROJECT_ROOT/}"
       violating=$(grep -E 'use [A-Za-z\\]+\\Infrastructure\\' "$file" | head -1 | xargs)
       emit_finding "HIGH" "adr-layer-violation" "$rel" "0" \
         "Domain layer imports Infrastructure: $violating" \
         "Depend on a Contract/Interface in Domain instead; bind the implementation in Infrastructure via a ServiceProvider"
     done
  then
    :
  fi

  # DB query builder calls in Domain models
  grep -rnE 'DB::(table|statement|select|insert|update|delete)\(' \
    "$MODULES" --include="*.php" 2>/dev/null | \
  grep "/Domain/Models/" | \
  while IFS=: read -r file line match; do
    rel="${file#$PROJECT_ROOT/}"
    emit_finding "HIGH" "adr-domain-db-query" "$rel" "$line" \
      "Direct DB query builder call in Domain model violates DDD encapsulation: $match" \
      "Move the query to an Eloquent model scope or an Infrastructure repository"
  done
fi

# ── Frontend: Feature Structure ───────────────────────────────────────────────
FEATURES_DIR="$FRONTEND/features"

if [[ ! -d "$FEATURES_DIR" ]]; then
  exit 0
fi

# Every feature with components/ should have a types/ directory OR types.ts
for feat_dir in "$FEATURES_DIR"/*/; do
  [[ -d "$feat_dir" ]] || continue
  feat_name="$(basename "$feat_dir")"
  rel="frontend/src/features/$feat_name"

  if [[ -d "$feat_dir/components" ]] || [[ -d "$feat_dir/pages" ]]; then
    has_types=0
    [[ -d "$feat_dir/types" ]] && has_types=1
    [[ -f "$feat_dir/types.ts" ]] && has_types=1
    [[ -f "$feat_dir/types.tsx" ]] && has_types=1

    if [[ $has_types -eq 0 ]]; then
      emit_finding "MEDIUM" "adr-feature-structure" "$rel" "0" \
        "Feature '$feat_name' has no types/ directory or types.ts" \
        "Create frontend/src/features/$feat_name/types/${feat_name}.ts for domain type definitions"
    fi

    if [[ ! -d "$feat_dir/services" ]]; then
      # Only warn if there are multiple component/page files (single-component features may be fine)
      component_count=$(find "$feat_dir" \( -name "*.tsx" -o -name "*.ts" \) -type f 2>/dev/null | wc -l)
      if [[ $component_count -gt 3 ]]; then
        emit_finding "LOW" "adr-feature-structure" "$rel" "0" \
          "Feature '$feat_name' has no services/ directory ($component_count source files)" \
          "Create frontend/src/features/$feat_name/services/${feat_name}-service.ts for API calls"
      fi
    fi
  fi
done

# Hooks defined inside components/ files (use grep -r for speed)
grep -rlE '^export (const|function) use[A-Z]' \
  "$FEATURES_DIR" --include="*.ts" 2>/dev/null | \
grep "/components/" | \
grep -v "\.d\.ts$" | \
while IFS= read -r file; do
  rel="${file#$PROJECT_ROOT/}"
  hook_name=$(grep -E '^export (const|function) use[A-Z]' "$file" | head -1 | \
              grep -oE 'use[A-Za-z]+' | head -1)
  emit_finding "MEDIUM" "adr-hook-location" "$rel" "0" \
    "Hook '$hook_name' is defined in components/ — hooks must live in hooks/" \
    "Move to frontend/src/features/.../hooks/${hook_name}.ts"
done

# Direct axios imports outside service files (single grep pass)
grep -rlE "from ['\"]axios['\"]" \
  "$FEATURES_DIR" \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | \
grep -v "\-service\.ts$" | \
grep -v "api-client" | \
while IFS= read -r file; do
  rel="${file#$PROJECT_ROOT/}"
  emit_finding "HIGH" "adr-direct-http" "$rel" "0" \
    "Direct axios import in a non-service file" \
    "Move all HTTP calls to a *-service.ts file and call the service from the component/hook"
done

# Cross-feature page imports (router/layout files are exempt)
# Single grep pass: find all files that import from a different feature's pages/
grep -rnE "from ['\"]@/features/[^/]+/pages/" \
  "$FEATURES_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | \
grep -v "/router" | grep -v "/routes" | grep -v "App\." | \
while IFS=: read -r file line match; do
  rel="${file#$PROJECT_ROOT/}"
  src_feat=$(echo "$rel" | grep -oP 'features/\K[^/]+' | head -1)
  dst_feat=$(echo "$match" | grep -oP '(?<=features/)[^/]+' | head -1)
  [[ "$src_feat" == "$dst_feat" ]] && continue
  emit_finding "MEDIUM" "adr-cross-feature-import" "$rel" "$line" \
    "Feature '$src_feat' imports page from '$dst_feat' — cross-feature page imports are forbidden" \
    "Use named routes and the router to navigate; never import page components from another feature"
done
