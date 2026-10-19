#!/usr/bin/env bash
# NAME: Docker Compose
# Validates docker-compose.yml structure:
#   - YAML is syntactically valid
#   - All required services are defined
#   - Every service has a healthcheck
#   - Networks and volumes are declared
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "docker-compose.yml not found at $PROJECT_ROOT"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "docker not in PATH — install Docker Desktop"
  exit 2
fi

# ── Validate YAML structure via docker compose config ────────────────────────
if ! docker compose -f "$COMPOSE_FILE" config --quiet 2>/tmp/compose-validate-err; then
  echo "docker-compose.yml has validation errors:"
  cat /tmp/compose-validate-err
  exit 1
fi

# ── Check required services ──────────────────────────────────────────────────
REQUIRED_SERVICES=(app nginx mysql redis)
DEFINED=$(docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null)

for svc in "${REQUIRED_SERVICES[@]}"; do
  if ! echo "$DEFINED" | grep -qx "$svc"; then
    echo "Required service '$svc' is not defined in docker-compose.yml"
    exit 1
  fi
done

# ── Check healthchecks ───────────────────────────────────────────────────────
# Check the raw YAML (not resolved config) to avoid env-var expansion bloating
# the output and breaking the grep-A window.
HEALTH_SERVICES=(app nginx mysql redis)

for svc in "${HEALTH_SERVICES[@]}"; do
  # awk: enter block on "  svc:" (2-space), exit on next 2-space key, look for healthcheck
  if ! awk "
    /^  ${svc}:/{in_svc=1; next}
    in_svc && /^  [a-z]/{in_svc=0}
    in_svc && /healthcheck:/{found=1; exit}
    END{exit !found}
  " "$COMPOSE_FILE"; then
    echo "Service '$svc' has no healthcheck defined — required for depends_on condition: service_healthy"
    exit 1
  fi
done

# ── Check network declared ───────────────────────────────────────────────────
if ! grep -q "^networks:" "$COMPOSE_FILE"; then
  echo "No networks section found in docker-compose.yml"
  exit 1
fi

# ── Check named volumes declared ────────────────────────────────────────────
REQUIRED_VOLUMES=(app-storage mysql-data redis-data)
for vol in "${REQUIRED_VOLUMES[@]}"; do
  if ! grep -q "^  ${vol}:" "$COMPOSE_FILE"; then
    echo "Required named volume '$vol' is not declared in the volumes section"
    exit 1
  fi
done

echo "docker-compose.yml is valid — services: $(echo "$DEFINED" | tr '\n' ' ')"
exit 0
