@echo off
SETLOCAL EnableDelayedExpansion

echo.
echo  ██████╗ ██╗   ██╗███╗   ██╗██╗  ██╗██╗  ██╗███████╗██████╗
echo  ██╔══██╗██║   ██║████╗  ██║██║ ██╔╝██║ ██╔╝██╔════╝██╔══██╗
echo  ██████╔╝██║   ██║██╔██╗ ██║█████╔╝ █████╔╝ █████╗  ██████╔╝
echo  ██╔══██╗██║   ██║██║╚██╗██║██╔═██╗ ██╔═██╗ ██╔══╝  ██╔══██╗
echo  ██████╔╝╚██████╔╝██║ ╚████║██║  ██╗██║  ██╗███████╗██║  ██║
echo  ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
echo.
echo  E.C.O.S ERP — Sistema de Despliegue Completo
echo  ================================================
echo.

:: ── PASO 1: Tests ─────────────────────────────────────────────────────────────
echo [1/6] Ejecutando tests antes de desplegar...
call npx vitest run --reporter=verbose
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Los tests fallaron. Corrige los errores antes de desplegar.
    exit /b %ERRORLEVEL%
)
echo [OK] Todos los tests pasaron.
echo.

:: ── PASO 2: Build Next.js para Web (Firebase Hosting) ─────────────────────────
echo [2/6] Compilando Next.js para Firebase Hosting (modo web)...
call npm run build:web
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Fallo la compilacion web. Abortando despliegue.
    exit /b %ERRORLEVEL%
)
echo [OK] Compilacion web exitosa.
echo.

:: ── PASO 3: Deploy a Firebase Hosting + Firestore Rules ───────────────────────
echo [3/6] Desplegando a Firebase Hosting y actualizando reglas de Firestore...
call firebase deploy --only hosting,firestore:rules
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Fallo el deploy a Firebase. Verifica que iniciaste sesion con 'firebase login'.
    exit /b %ERRORLEVEL%
)
echo [OK] Deploy a Firebase completado.
echo     URL publica: https://admin-erp-pro-1.web.app
echo.

:: ── PASO 4: Build Next.js Standalone para Electron (.exe) ─────────────────────
echo [4/6] Compilando Next.js en modo Standalone para el .exe...
call npm run build:standalone
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ADVERTENCIA] Fallo el build standalone. El .exe no se actualizara.
    echo     Continua con el resto del despliegue...
) else (
    echo [OK] Build standalone exitoso.
)
echo.

:: ── PASO 5: Construir y subir imagen Docker ────────────────────────────────────
echo [5/6] Construyendo imagen Docker y subiendo a Docker Hub...
docker build -t terraform98/terraform-erp:latest .
if %ERRORLEVEL% NEQ 0 (
    echo [ADVERTENCIA] Fallo la construccion Docker. Continuando...
) else (
    docker push terraform98/terraform-erp:latest
    if %ERRORLEVEL% NEQ 0 (
        echo [ADVERTENCIA] Fallo el push a Docker Hub. Verifica que iniciaste sesion con 'docker login'.
    ) else (
        echo [OK] Imagen Docker subida exitosamente.
    )
)
echo.

:: ── PASO 6: Commit y push a GitHub ────────────────────────────────────────────
echo [6/6] Subiendo cambios a GitHub...
git add .
git commit -m "deploy: BUNKKER E.C.O.S ERP — sync web + exe, bug fixes, security hardening"
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo [ADVERTENCIA] Fallo el push a GitHub. Verifica tus credenciales.
) else (
    echo [OK] Cambios subidos a GitHub exitosamente.
)
echo.

:: ── RESUMEN ────────────────────────────────────────────────────────────────────
echo  ================================================
echo  DESPLIEGUE COMPLETADO
echo.
echo  Web online:  https://admin-erp-pro-1.web.app
echo  Docker Hub:  terraform98/terraform-erp:latest
echo  GitHub:      main (actualizado)
echo.
echo  Para activar modo online en el .exe, crea el archivo:
echo    %%APPDATA%%\BUNKKER ERP\network_config.json
echo  Con contenido: { "mode": "online" }
echo  ================================================
echo.
pause
