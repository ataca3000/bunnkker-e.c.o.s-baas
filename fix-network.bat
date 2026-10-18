@echo off
chcp 65001 >nul
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c `\"%~f0`\"' -Verb RunAs"
    exit /b
)

echo ========================================================
echo Configurando IP estatica no duplicada para ERP BUNKKER...
echo ========================================================
echo.
echo Asignando IP fija: 192.168.1.188 / Gateway: 192.168.1.254...
netsh interface ipv4 set address name="Ethernet" static 192.168.1.188 255.255.255.0 192.168.1.254 1
netsh interface ipv4 set dnsservers name="Ethernet" static 1.1.1.1 primary
netsh interface ipv4 add dnsservers name="Ethernet" 8.8.8.8 index=2

echo.
echo ========================================================
echo Verificando conectividad IPv4 e IPv6...
echo ========================================================
ping -n 2 192.168.1.254
ping -n 2 8.8.8.8
ping -n 2 github.com

echo.
echo ========================================================
echo Red configurada con exito.
echo ========================================================
timeout /t 5
