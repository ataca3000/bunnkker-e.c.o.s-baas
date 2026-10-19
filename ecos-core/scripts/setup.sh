#!/usr/bin/env bash
# ECOS ERP — one-shot environment bootstrap (Linux / macOS)
# Usage:  ./scripts/setup.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> ECOS ERP environment setup"

if [ ! -f backend/.env ]; then
    echo "==> Creating backend/.env from .env.example"
    cp backend/.env.example backend/.env
fi

if [ ! -f docker-compose.override.yml ]; then
    echo "==> Creating docker-compose.override.yml from docker-compose.override.yml.example"
    cp docker-compose.override.yml.example docker-compose.override.yml
fi

echo "==> Building images"
docker compose build

echo "==> Starting services"
docker compose up -d

echo "==> Generating application key"
docker compose exec app php artisan key:generate --force

echo "==> Running migrations"
docker compose exec app php artisan migrate --force

echo "==> Seeding administrator account"
docker compose exec app php artisan db:seed --class=AdminUserSeeder --force

echo ""
echo "Done. Application:  http://localhost:8080"
echo "      Mailpit UI:   http://localhost:8025"
echo ""
echo "Default admin credentials:"
echo "  Email:    admin@ecos.local"
echo "  Password: Admin@123456"
echo ""
echo "To reset admin password at any time:"
echo "  docker compose exec app php artisan ecos:reset-dev-admin"
docker compose ps
