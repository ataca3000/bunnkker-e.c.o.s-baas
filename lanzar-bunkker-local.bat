@echo off
setlocal
cd /d "%~dp0"
title BUNKKER E.C.O.S - Servidor local
color 0B

echo BUNKKER E.C.O.S - Lanzador local
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Instala Node.js LTS antes de continuar.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 goto :error
)

echo Iniciando radio LAN en puerto 3002 y aplicacion local en puerto 3000...
start "BUNKKER Radio 3002" cmd /k "cd /d "%~dp0" && node radio-server.js"
start "BUNKKER Web 3000" cmd /k "cd /d "%~dp0" && npm run dev:https"

timeout /t 4 /nobreak >nul
start "" "https://localhost:3000"
echo.
echo Radio LAN: http://IP-DE-ESTE-PC:3002/health
echo Aplicacion: https://localhost:3000
echo Mantén abiertas las dos ventanas del sistema.
pause
exit /b 0

:error
echo ERROR: No se pudieron instalar las dependencias.
pause
exit /b 1
