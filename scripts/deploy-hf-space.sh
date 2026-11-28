#!/usr/bin/env bash
set -euo pipefail

SPACE_ID="${HF_SPACE_ID:-Elcalarmar/Bunkker-e-c-o-s}"
STAGE_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

if [[ -z "${HF_TOKEN:-}" ]]; then
  echo "ERROR: Exporta HF_TOKEN con permisos de escritura (write) antes de ejecutar este script."
  echo "Ejemplo: export HF_TOKEN=hf_xxx && bash scripts/deploy-hf-space.sh"
  exit 1
fi

echo "==> Cambiando hardware del Space $SPACE_ID a cpu-basic (evita error ZeroGPU)..."
curl -fsSL -X POST \
  -H "Authorization: Bearer $HF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flavor":"cpu-basic"}' \
  "https://huggingface.co/api/spaces/${SPACE_ID}/hardware" >/dev/null || echo "Aviso: verifica el hardware manualmente en Settings si no se actualizó."

echo "==> Clonando repo del Space en $STAGE_DIR..."
git clone "https://user:${HF_TOKEN}@huggingface.co/spaces/${SPACE_ID}" "$STAGE_DIR/repo"

echo "==> Limpiando plantilla anterior (run.py / workflow.json) y copiando aplicación Next.js..."
find "$STAGE_DIR/repo" -mindepth 1 -maxdepth 1 ! -name '.git' ! -name '.gitattributes' -exec rm -rf {} +

rsync -a \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='build' \
  --exclude='dist' \
  --exclude='dist-build-win' \
  --exclude='dist_electron' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.playwright-cli' \
  --exclude='playwright-report' \
  --exclude='test-results' \
  --exclude='android-app' \
  --exclude='mobile-app' \
  --exclude='build-resources' \
  --exclude='functions' \
  --exclude='obsoleto' \
  --exclude='public/assets/aistudio' \
  --exclude='google-services*.json' \
  --exclude='*.db' \
  --exclude='*.db-*' \
  --exclude='*.log' \
  ./ "$STAGE_DIR/repo/"

cp hf-space/README.md "$STAGE_DIR/repo/README.md"
cp hf-space/Dockerfile "$STAGE_DIR/repo/Dockerfile"
cp hf-space/.dockerignore "$STAGE_DIR/repo/.dockerignore"

cd "$STAGE_DIR/repo"
git config user.name "${GIT_AUTHOR_NAME:-BUNKKER Deploy}"
git config user.email "${GIT_AUTHOR_EMAIL:-deploy@bunkker.local}"
git add -A
if git diff --cached --quiet; then
  echo "No hay cambios nuevos para subir a $SPACE_ID."
else
  git commit -m "Deploy BUNKKER E.C.O.S Next.js Docker demo to Hugging Face Space"
  git push origin main
  echo "==> Despliegue enviado a https://huggingface.co/spaces/${SPACE_ID}"
fi
