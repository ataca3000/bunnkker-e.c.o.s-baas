@echo off
title Servidor 
cd /d "%~dp0"

echo ==========================================
echo    SERVIDOR 
echo ==========================================
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%i
    goto :found_ip
)
:found_ip
echo Tu IP Local es:%IP%
echo Las demas PCs deben conectarse a esta IP.
echo ==========================================

:: Validar puertos. Si fallan (están libres), arrancar emuladores.
call npm run validate:ports >null 2>&1
if %errorlevel% neq 0 (
  echo [!] La infraestructura no responde. Iniciando servicios locales...
  npm run emulate:local
) else (
  echo [OK] Servicios locales activos y funcionando.
)
