#!/usr/bin/env bash
# NAME: Docker Build
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

if ! command -v docker &>/dev/null; then
  echo "docker not in PATH"
  exit 2
fi

if ! docker info &>/dev/null 2>&1; then
  echo "Docker daemon is not running — start Docker Desktop and retry"
  exit 2
fi

if [[ ! -f "$PROJECT_ROOT/docker-compose.yml" ]]; then
  echo "docker-compose.yml not found at project root: $PROJECT_ROOT"
  exit 2
fi

cd "$PROJECT_ROOT"
docker compose build 2>&1
