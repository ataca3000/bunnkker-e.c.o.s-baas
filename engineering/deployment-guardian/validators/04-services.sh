#!/usr/bin/env bash
# NAME: Services Health
# Checks the health status of all Docker services.
# Reports which containers are running, healthy, or degraded.
# Does NOT start containers — only inspects current state.
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

if ! command -v docker &>/dev/null; then
  echo "docker not in PATH"
  exit 2
fi

if ! docker info &>/dev/null 2>&1; then
  echo "Docker daemon is not running"
  exit 2
fi

FAILURES=0
DEGRADED=0

fail()    { echo "FAIL: $*";    FAILURES=$((FAILURES + 1)); }
degraded(){ echo "DEGRADED: $*"; DEGRADED=$((DEGRADED + 1)); }
ok()      { echo "  OK: $*"; }
info()    { echo "INFO: $*"; }

# ── Required containers ────────────────────────────────────────────────────────
declare -A REQUIRED_CONTAINERS=(
  [ecos-app]="app"
  [ecos-nginx]="nginx"
  [ecos-mysql]="mysql"
  [ecos-redis]="redis"
)

all_running=1

for container in "${!REQUIRED_CONTAINERS[@]}"; do
  service="${REQUIRED_CONTAINERS[$container]}"

  # Check if container exists
  state=$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null || echo "missing")

  if [[ "$state" == "missing" ]]; then
    fail "Container '$container' ($service) does not exist — run: docker compose up -d"
    all_running=0
    continue
  fi

  if [[ "$state" != "running" ]]; then
    fail "Container '$container' is in state '$state' (expected: running)"
    all_running=0
    continue
  fi

  # Check health status (for containers with healthcheck)
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' \
    "$container" 2>/dev/null || echo "unknown")

  case "$health" in
    healthy)
      ok "$container ($service): running and healthy"
      ;;
    starting)
      info "$container ($service): running, health check still starting"
      ;;
    unhealthy)
      degraded "$container ($service): running but UNHEALTHY"
      # Print last health log
      last_log=$(docker inspect --format \
        '{{if .State.Health}}{{range .State.Health.Log}}{{.Output}}{{end}}{{end}}' \
        "$container" 2>/dev/null | tail -1 | tr -d '\n')
      [[ -n "$last_log" ]] && echo "       Last health log: $last_log"
      ;;
    no-healthcheck)
      info "$container ($service): running (no healthcheck configured)"
      ;;
    *)
      info "$container ($service): running (health=$health)"
      ;;
  esac
done

# ── Check queue workers and scheduler are running inside app container ───────
#
# These read /proc rather than calling pgrep. pgrep lives in procps, which is
# not installed in the runtime image, so the previous checks reported both
# processes as absent on every run (TASK-CUTOVER-001, finding C-4). A queue
# worker check that always fails is a check nobody reads.
_proc_count() {
  docker exec ecos-app sh -c '
    n=0
    for f in /proc/[0-9]*/cmdline; do
      [ -r "$f" ] || continue
      if tr "\0" " " < "$f" 2>/dev/null | grep -q -- "'"$1"'"; then n=$((n+1)); fi
    done
    echo "$n"
  ' 2>/dev/null || echo "0"
}

if [[ $all_running -eq 1 ]]; then
  queue_running=$(_proc_count "artisan queue:work")
  if [[ "$queue_running" -gt 0 ]]; then
    ok "Queue workers are running (process count: $queue_running)"
  else
    fail "Queue workers are NOT running inside ecos-app — check Supervisor config"
  fi

  # Every queue the application dispatches to must have a consumer. A queue with
  # no worker fails silently: the job sits in Redis with no error anywhere.
  for q in finance-posting engineering health default; do
    if [[ "$(_proc_count "--queue=[^ ]*${q}")" -gt 0 ]]; then
      ok "Queue '${q}' has a consumer"
    else
      fail "Queue '${q}' has NO consumer — jobs dispatched to it will never run"
    fi
  done

  scheduler_running=$(_proc_count "artisan schedule")
  if [[ "$scheduler_running" -gt 0 ]]; then
    ok "Scheduler is running (process count: $scheduler_running)"
  else
    degraded "Scheduler is NOT running inside ecos-app — check Supervisor config"
  fi
fi

# ── Docker compose ps summary ─────────────────────────────────────────────────
printf '\n'
docker compose -f "$PROJECT_ROOT/docker-compose.yml" ps 2>/dev/null || true
printf '\n'

# ── Summary ───────────────────────────────────────────────────────────────────
if [[ $FAILURES -gt 0 ]]; then
  printf '%d service failure(s), %d degraded\n' "$FAILURES" "$DEGRADED"
  exit 1
fi

if [[ $DEGRADED -gt 0 ]]; then
  printf '0 failures, %d degraded service(s)\n' "$DEGRADED"
  exit 1
fi

exit 0
