#!/usr/bin/env bash
# Path configuration. Override any value via the matching environment variable.
# Sourced by guardian.sh — PROJECT_ROOT must be set before sourcing this file.

BACKEND_DIR="${GUARDIAN_BACKEND_DIR:-$PROJECT_ROOT/backend}"
FRONTEND_DIR="${GUARDIAN_FRONTEND_DIR:-$PROJECT_ROOT/frontend}"
DOCKER_COMPOSE_FILE="${GUARDIAN_COMPOSE_FILE:-$PROJECT_ROOT/docker-compose.yml}"
