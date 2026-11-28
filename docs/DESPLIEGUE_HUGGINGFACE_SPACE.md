# Despliegue en Hugging Face Space (`Elcalarmar/Bunkker-e-c-o-s`)

## Diagnóstico actual del Space

Al consultar `https://huggingface.co/api/spaces/Elcalarmar/Bunkker-e-c-o-s`, el Space presenta actualmente:
- **Estado**: `RUNTIME_ERROR`
- **Error**: `No @spaces.GPU function detected during startup`
- **Causa**: el Space tiene configurado `sdk: gradio`, `app_file: run.py` y `hardware: zero-a10g` (ZeroGPU), mientras que **BUNKKER E.C.O.S.** es una aplicación **Next.js 15 (puerto 3000)** que no requiere GPU ni Gradio.

## Archivos preparados en el repositorio

Para desplegar la aplicación completa con **Modo Demo de 1 clic** en Hugging Face sin afectar tu configuración local/Electron, se prepararon:

- `hf-space/README.md` — Cabecera YAML de Hugging Face con `sdk: docker` y `app_port: 3000` (en reemplazo de `sdk: gradio` y `app_file: run.py`).
- `hf-space/Dockerfile` — Imagen multi-stage `node:20-slim` que ejecuta `npm run build:demo` y arranca `server.js` en el puerto `3000` con usuario no-root (`uid 1000`).
- `hf-space/.dockerignore` — Excluye artefactos pesados, secretos locales (`.env*`), carpetas Android/Electron y archivos temporales, manteniendo `src/`, `prisma/`, `scripts/`, `public/` y `firebase-applet-config.json`.
- `scripts/deploy-hf-space.sh` — Script automatizado para cambiar el hardware a `cpu-basic`, limpiar `run.py` / `workflow.json`, copiar los archivos del proyecto + la configuración de `hf-space/` y hacer `git push` al Space.

## Pasos para publicarlo sin PC (directo desde Android / GitHub)

En este contenedor no existe ningún `HF_TOKEN` ni sesión iniciada de Hugging Face. Si trabajas solo desde tu celular Android (sin PC y sin tener que subir carpetas una por una en el navegador):

### Opción 1 (Recomendada): Directo desde GitHub con 1 toque (`GitHub Actions`)

Ya quedó incluido el flujo automático `.github/workflows/deploy-hf-space.yml` dentro del proyecto:

1. Entra a tu repositorio en GitHub desde el navegador de tu Android (o app de GitHub) → **Settings → Secrets and variables → Actions → New repository secret**.
2. Crea el secreto llamado **`HF_TOKEN`** pegando tu token de Hugging Face con permiso **Write** (`https://huggingface.co/settings/tokens`).
3. Ve a la pestaña **Actions → "Deploy BUNKKER Demo to Hugging Face Space" → Run workflow** (o haz `push` a `main`).
4. GitHub enviará automáticamente el proyecto completo, cambiará el hardware a `cpu-basic`, reemplazará `run.py` / `workflow.json` por `Dockerfile` + `README.md` de Docker (`port 3000`) y actualizará `Elcalarmar/Bunkker-e-c-o-s`.

### Opción 2: Desde Termux en tu celular Android

Si prefieres subirlo directo desde el teléfono sin pasar por GitHub Actions:

1. Instala **Termux** en Android y ejecuta:
   ```bash
   pkg update && pkg install -y git curl rsync
   ```
2. Clona el repo, exporta tu token y corre el script:
   ```bash
   export HF_TOKEN=hf_tu_token_con_permiso_write
   bash scripts/deploy-hf-space.sh
   ```

### Monitorear compilación en vivo

Una vez enviado el push (por Actions o Termux), revisa los logs en vivo con:

```bash
curl -N \
  -H "Authorization: Bearer $HF_TOKEN" \
  "https://huggingface.co/api/spaces/Elcalarmar/Bunkker-e-c-o-s/logs/build"
```

