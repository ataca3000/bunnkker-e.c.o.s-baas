# ECOS ERP — one-shot environment bootstrap (Windows / PowerShell)
# Usage:  ./scripts/setup.ps1
$ErrorActionPreference = "Stop"

Write-Host "==> ECOS ERP environment setup" -ForegroundColor Cyan

# Resolve repo root (parent of this script's directory)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path "backend/.env")) {
    Write-Host "==> Creating backend/.env from .env.example"
    Copy-Item "backend/.env.example" "backend/.env"
}

if (-not (Test-Path "docker-compose.override.yml")) {
    Write-Host "==> Creating docker-compose.override.yml from docker-compose.override.yml.example"
    Copy-Item "docker-compose.override.yml.example" "docker-compose.override.yml"
}

Write-Host "==> Building images"
docker compose build

Write-Host "==> Starting services"
docker compose up -d

Write-Host "==> Generating application key"
docker compose exec app php artisan key:generate --force

Write-Host "==> Running migrations"
docker compose exec app php artisan migrate --force

Write-Host ""
Write-Host "Done. Application:  http://localhost:8080" -ForegroundColor Green
Write-Host "      Mailpit UI:   http://localhost:8025" -ForegroundColor Green
docker compose ps
