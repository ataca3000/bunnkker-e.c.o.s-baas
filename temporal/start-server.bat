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

echo [OK] Servicios locales iniciados correctamente.
