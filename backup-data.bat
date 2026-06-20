@echo off
setlocal
:: Configura tu ruta de destino aqui (ejemplo: una carpeta en D: o una USB)
set DESTINO="C:\Users\codem\Documents\Backups_ERP"
set ORIGEN="%~dp0..\firebase_data"

echo Creando respaldo de base de datos local...
if not exist %DESTINO% mkdir %DESTINO%

:: Robocopy copia solo lo modificado, es muy rapido
robocopy %ORIGEN% %DESTINO% /E /Z /R:3 /W:5 /MT:32 /LOG+:"%DESTINO%\log_backup.txt"

echo Respaldo completado en %DESTINO%
timeout /t 5