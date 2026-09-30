@echo off
echo ============================================================
echo   BUNKKER E.C.O.S - HABILITAR ACCESO LAN (WINDOWS FIREWALL)
echo ============================================================
echo Verificando permisos de administrador...

net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Permisos de Administrador detectados.
) else (
    echo.
    echo [AVISO] Por favor ejecuta este archivo dando clic derecho:
    echo         "Ejecutar como Administrador"
    echo.
    pause
    exit /b 1
)

echo Abriendo puertos 3000 (POS/Web), 3001 (Sync Datos) y 3002 (Radio Personal)...
netsh advfirewall firewall delete rule name="BUNKKER ERP LAN" >nul 2>&1
netsh advfirewall firewall add rule name="BUNKKER ERP LAN" dir=in action=allow protocol=TCP localport=3000,3001,3002 profile=any

echo.
echo ============================================================
echo  LISTO! Los puertos 3000, 3001 y 3002 ya estan permitidos.
echo  Tus dispositivos en la misma red Wi-Fi ya pueden entrar.
echo ============================================================
pause
