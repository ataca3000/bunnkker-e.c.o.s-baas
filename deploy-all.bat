@echo off
SETLOCAL EnableDelayedExpansion

echo ===================================================
echo 🚀 INICIANDO DESPLIEGUE A GITHUB Y DOCKER HUB
echo ===================================================
echo.

:: 1. Compilar Next.js en modo Standalone
echo [1/4] Compilando Next.js localmente para Docker...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ ERROR: Fallo la compilacion de Next.js. Abortando despliegue.
    exit /b %ERRORLEVEL%
)
echo.
echo ✅ Compilacion exitosa.
echo.

:: 2. Construir la imagen de Docker
echo [2/4] Construyendo imagen de Docker para terraform98/terraform-erp:latest...
docker build -t terraform98/terraform-erp:latest .
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ ERROR: Fallo la construccion de la imagen Docker. Abortando despliegue.
    exit /b %ERRORLEVEL%
)
echo.
echo ✅ Imagen de Docker construida correctamente.
echo.

:: 3. Subir imagen a Docker Hub
echo [3/4] Subiendo imagen a Docker Hub (terraform98)...
docker push terraform98/terraform-erp:latest
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ ERROR: Fallo al subir la imagen a Docker Hub. Verifica que iniciaste sesion con 'docker login'.
    exit /b %ERRORLEVEL%
)
echo.
echo ✅ Imagen subida exitosamente a Docker Hub.
echo.

:: 4. Actualizar GitHub
echo [4/4] Actualizando GitHub (ataca3000)...
git add .
git commit -m "feat: core security fixes, clean sequential seed PINs, WAL transaction queues, and dockerignore improvements"
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ⚠️ ADVERTENCIA: Fallo el push a GitHub. Verifica tus credenciales o conexion.
) else (
    echo.
    echo ✅ Cambios subidos exitosamente a GitHub.
)

echo.
echo ===================================================
echo 🎉 PROCESO DE DESPLIEGUE COMPLETADO
echo ===================================================
pause
