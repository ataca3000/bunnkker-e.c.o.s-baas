@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: BUNKKER E.C.O.S ERP — Configurador de Modo de Red
:: Uso:
::   activar-modo-online.bat   → El .exe carga https://admin-erp-pro-1.web.app
::   activar-modo-local.bat    → El .exe carga localhost:3000 (default)
:: ─────────────────────────────────────────────────────────────────────────────
SETLOCAL

SET "CONFIG_DIR=%APPDATA%\BUNKKER ERP"
SET "CONFIG_FILE=%CONFIG_DIR%\network_config.json"

IF NOT EXIST "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

:: Detectar si el argumento es "online" o "local"
IF "%1"=="online" GOTO SET_ONLINE
IF "%1"=="local"  GOTO SET_LOCAL

:: Si se llamó sin argumento, preguntar
echo.
echo  BUNKKER E.C.O.S ERP — Modo de conexion
echo  ========================================
echo  1) Modo LOCAL   (SQLite local + WiFi LAN)    [default]
echo  2) Modo ONLINE  (Firebase Hosting en la nube)
echo.
SET /P OPCION="Selecciona [1/2]: "
IF "%OPCION%"=="2" GOTO SET_ONLINE
GOTO SET_LOCAL

:SET_ONLINE
echo { "mode": "online", "url": "https://admin-erp-pro-1.web.app" } > "%CONFIG_FILE%"
echo.
echo [OK] Modo ONLINE activado.
echo     El .exe cargara: https://admin-erp-pro-1.web.app
echo     Reinicia BUNKKER ERP para aplicar el cambio.
GOTO END

:SET_LOCAL
echo { "mode": "local" } > "%CONFIG_FILE%"
echo.
echo [OK] Modo LOCAL activado.
echo     El .exe cargara: http://localhost:3000
echo     Reinicia BUNKKER ERP para aplicar el cambio.
GOTO END

:END
echo.
pause
