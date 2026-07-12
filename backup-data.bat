@echo off
setlocal
:: Configura tu ruta de destino aqui (ejemplo: Google Drive)
set DESTINO="%USERPROFILE%\Documents\Backups_ERP"
set ORIGEN="%~dp0prisma"

echo Creando respaldo de base de datos local (SQLite)...
if not exist %DESTINO% mkdir %DESTINO%

:: Copia dev.db y dev.db-wal
copy /Y "%~dp0prisma\dev.db" %DESTINO%\erp_db_backup.sqlite
copy /Y "%~dp0prisma\dev.db-wal" %DESTINO%\erp_db_backup.sqlite-wal

echo Respaldo completado en %DESTINO%
timeout /t 5