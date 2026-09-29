@echo off
title BUNKKER E.C.O.S - Instalador Seguro (Version 1.0)
color 0A

echo ==============================================================================
echo              THE BRECHA SOLUTIONS COMPANY S.A. DE C.V.
echo ==============================================================================
echo.
echo Bienvenido al Instalador Seguro de BUNKKER E.C.O.S (Version Offline).
echo.
echo NOTA DE SEGURIDAD: 
echo Por proteccion contra pirateria, este archivo de instalacion se
echo AUTODESTRUIRA del equipo una vez que la instalacion haya finalizado.
echo.
echo Presione cualquier tecla para comenzar la instalacion de BUNKKER E.C.O.S...
pause >nul

echo.
echo Extrayendo e instalando el sistema. Por favor espere, esto puede tomar unos minutos...
echo (Aparecera la ventana del instalador, siga las instrucciones)

:: Buscamos cualquier ejecutable .exe en la misma carpeta que empiece con "BUNKKER" o sea el setup
:: Para este script, asumimos que el setup compilado se llama "BUNKKER_Setup.exe"
:: Si tienes otro nombre, asegúrate de renombrar tu .exe a BUNKKER_Setup.exe o ajusta la línea de abajo.

if exist "BUNKKER_Setup.exe" (
    start /wait BUNKKER_Setup.exe
) else (
    echo [ERROR] No se encontro el archivo "BUNKKER_Setup.exe" en esta carpeta.
    echo Asegurate de que el instalador y este archivo .bat esten en la misma carpeta.
    timeout /t 10 >nul
    exit
)

echo.
echo ==============================================================================
echo INSTALACION FINALIZADA. El sistema ya esta instalado en tu equipo.
echo ==============================================================================
echo.
echo PROTOCOLO DE SEGURIDAD INICIADO...
echo Eliminando archivos de instalacion (Anti-Pirateria)...

:: Esperamos 3 segundos antes de borrar para liberar archivos
timeout /t 3 /nobreak >nul

:: Borra el instalador principal
del /f /q "BUNKKER_Setup.exe"

echo Archivos eliminados exitosamente.
echo.
echo Ya puedes iniciar BUNKKER E.C.O.S desde el acceso directo en tu escritorio.
echo.
echo Presione cualquier tecla para cerrar esta ventana...
pause >nul

:: El script se borra a si mismo
(goto) 2>nul & del "%~f0"
