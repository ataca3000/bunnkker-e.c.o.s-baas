const { app, BrowserWindow, screen, ipcMain, dialog, nativeTheme } = require('electron');
nativeTheme.themeSource = 'dark';
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const { fork } = require('child_process');
const fs = require('fs');
const { machineIdSync } = require('node-machine-id');

const isDev = !app.isPackaged;

let mainWindow;
let serverProcess;

// ─── Auto-updater config ────────────────────────────────────────────────────
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
    autoUpdater.on('checking-for-update', () => {
        console.log('[Updater] Buscando actualizaciones...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[Updater] Actualización disponible:', info.version);
        if (mainWindow) {
            mainWindow.webContents.send('update-available', info.version);
        }
    });

    autoUpdater.on('update-not-available', () => {
        console.log('[Updater] La app está al día.');
    });

    autoUpdater.on('download-progress', (progress) => {
        if (mainWindow) {
            mainWindow.webContents.send('update-progress', Math.round(progress.percent));
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[Updater] Actualización descargada:', info.version);
        if (mainWindow) {
            mainWindow.webContents.send('update-downloaded', info.version);
        }
        // Install after 5 seconds (let user see the notification)
        setTimeout(() => autoUpdater.quitAndInstall(false, true), 5000);
    });

    autoUpdater.on('error', (err) => {
        console.error('[Updater] Error:', err.message);
    });

    // Check for updates every 30 minutes
    if (!isDev) {
        autoUpdater.checkForUpdates();
        setInterval(() => autoUpdater.checkForUpdates(), 30 * 60 * 1000);
    }
}

// ─── Next.js standalone server ──────────────────────────────────────────────
const createServer = () => {
    // Lógica de Terreno para Multi-PC:
    // Si existe un archivo 'node_config.json', asumimos que esta PC es un NODO
    // y no levantamos el servidor local, solo apuntamos a la IP del Maestro.
    const configPath = path.join(app.getPath('userData'), 'network_config.json');
    let isNode = false;
    let masterIp = 'localhost';

    if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.role === 'node' && config.masterIp) {
            isNode = true;
            masterIp = config.masterIp;
            console.log(`[Network] Iniciando en MODO NODO. Conectando a Maestro: ${masterIp}`);
        }
    }

    return new Promise((resolve, reject) => {
        if (isNode) return resolve(masterIp); // No levantamos server si somos nodo

        const serverPath = isDev
            ? path.join(__dirname, '.next', 'standalone', 'server.js')
            : path.join(process.resourcesPath, 'server', 'server.js');

        console.log('[Server] Iniciando desde:', serverPath);
        const serverDir = path.dirname(serverPath);

        const logPath = path.join(app.getPath('userData'), 'server.log');
        fs.appendFileSync(logPath, '\n\n=== NUEVO INICIO DE SERVIDOR ===\n');
        
        // --- Asegurar persistencia de la Base de Datos SQLite ---
        const persistentDbPath = path.join(app.getPath('userData'), 'database.sqlite');
        const defaultDbPath = isDev
            ? path.join(__dirname, 'prisma', 'dev.db')
            : path.join(process.resourcesPath, 'server', 'prisma', 'dev.db');

        if (!fs.existsSync(persistentDbPath)) {
            console.log('[Server] Creando base de datos persistente...');
            fs.appendFileSync(logPath, `[INFO] No se encontró BD persistente en ${persistentDbPath}. Buscando por defecto...\n`);
            if (fs.existsSync(defaultDbPath)) {
                fs.copyFileSync(defaultDbPath, persistentDbPath);
                fs.appendFileSync(logPath, '[INFO] BD inicial copiada correctamente.\n');
                console.log('[Server] BD inicial copiada a:', persistentDbPath);
            } else {
                fs.appendFileSync(logPath, `[ERROR] No se halló BD por defecto en ${defaultDbPath}.\n`);
                console.error('[Server] ERROR: No hay BD inicial disponible.');
            }
        } else {
            console.log('[Server] Usando base de datos persistente en:', persistentDbPath);
        }
        
        // Restaurar node_modules si fue ocultado por copy-standalone.js
        const nmBackupPath = path.join(serverDir, 'node_modules_backup');
        const nmPath = path.join(serverDir, 'node_modules');
        if (fs.existsSync(nmBackupPath) && !fs.existsSync(nmPath)) {
            try {
                fs.renameSync(nmBackupPath, nmPath);
                fs.appendFileSync(logPath, '[INFO] node_modules restaurado exitosamente.\n');
            } catch (e) {
                fs.appendFileSync(logPath, '[ERROR] Falló restauración de node_modules: ' + e.message + '\n');
            }
        }

        serverProcess = fork(serverPath, [], {
            cwd: serverDir,
            env: {
                ...process.env,
                PORT: '3000',
                HOSTNAME: '0.0.0.0', // Permite conexiones externas (WiFi/LAN)
                NODE_ENV: 'production',
                MACHINE_HWID: machineIdSync(true), // Inyecta el HWID para que Next.js valide la licencia
                INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET || 'terraform-default-secret-key-123456789',
                DATABASE_URL: `file:${persistentDbPath}`
            },
            stdio: ['ignore', 'pipe', 'pipe', 'ipc']
        });
        
        // --- Iniciar Radio Server Local ---
        const radioServerPath = path.join(app.getAppPath(), 'radio-server.js');
        if (fs.existsSync(radioServerPath)) {
            console.log('[Radio] Iniciando radio-server.js...');
            fork(radioServerPath, [], { stdio: 'inherit' });
        }

        let serverLogs = '';

        serverProcess.stdout.on('data', (data) => {
            const txt = data.toString();
            serverLogs += txt;
            fs.appendFileSync(logPath, '[STDOUT] ' + txt);
            console.log(txt);
        });

        serverProcess.stderr.on('data', (data) => {
            const txt = data.toString();
            serverLogs += txt;
            fs.appendFileSync(logPath, '[STDERR] ' + txt);
            console.error(txt);
        });

        // Darle 5 segundos al servidor para arrancar bien
        setTimeout(resolve, 5000);

        serverProcess.on('error', (err) => {
            fs.appendFileSync(logPath, '[ERROR CRITICO] ' + err.message);
            dialog.showErrorBox('Error al iniciar Motor Interno', `Detalles:\n${err.message}\n\nLogs:\n${serverLogs}`);
            reject(err);
        });

        serverProcess.on('exit', (code, signal) => {
            if (code !== 0) {
                fs.appendFileSync(logPath, `[EXIT] Code: ${code}, Signal: ${signal}\n`);
                dialog.showErrorBox('Motor Interno (Next.js) Detenido', `El servidor se cerró inesperadamente con código ${code}.\n\nLogs:\n${serverLogs.substring(serverLogs.length - 1000)}`);
            }
        });
    });
};

// ─── Main window ────────────────────────────────────────────────────────────
const createWindow = (urlHost = 'localhost') => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width,
        height,
        title: 'BUNKKER E.C.O.S ERP',
        autoHideMenuBar: true,
        show: false, // Ocultar hasta que esté maximizada
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
    });

    // Detectar modo de carga: local o online
    // Si network_config.json tiene { mode: 'online' } → Firebase Hosting
    // Si el servidor local no levanta en 10s         → fallback a Firebase Hosting
    const ONLINE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://admin-erp-pro-1.web.app';
    const localUrl   = `http://${urlHost}:3000`;

    const configPath = path.join(app.getPath('userData'), 'network_config.json');
    let useOnline = false;
    if (fs.existsSync(configPath)) {
        try {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (cfg.mode === 'online') useOnline = true;
        } catch { }
    }

    const targetUrl = useOnline ? ONLINE_URL : localUrl;
    console.log(`[Electron] Cargando: ${targetUrl} (modo ${useOnline ? 'ONLINE' : 'LOCAL'})`);
    mainWindow.loadURL(targetUrl);

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        // Ignorar ERR_ABORTED (-3), que ocurre normalmente al hacer clic rápido en enlaces o redirecciones
        if (errorCode === -3) return;

        console.log(`[Electron] Error cargando ${validatedURL}: ${errorDescription}. Reintentando...`);

        // Si falla el servidor local, hacer fallback a Firebase Hosting (modo online)
        const ONLINE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://admin-erp-pro-1.web.app';
        const isLocalUrl = validatedURL.includes('localhost') || validatedURL.includes('127.0.0.1');

        if (isLocalUrl) {
            console.log('[Electron] Servidor local no disponible. Intentando de nuevo en 3s...');
            setTimeout(() => {
                if (mainWindow) mainWindow.loadURL(validatedURL);
            }, 3000);
        } else {
            setTimeout(() => {
                if (mainWindow) mainWindow.loadURL(validatedURL);
            }, 2000);
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => { mainWindow = null; });
};

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-machine-id', () => machineIdSync(true));
ipcMain.handle('get-rni-url', () => global.rniUrl || null);
ipcMain.handle('restore-backup', async (event, fileContent) => {
    try {
        if (!fileContent.startsWith('BUNKKER_SECURE_V1\n')) {
            return { success: false, message: 'Formato de backup inválido o corrupto.' };
        }
        
        const content = fileContent.substring('BUNKKER_SECURE_V1\n'.length);
        const [ivHex, encryptedBase64] = content.split(':');
        if (!ivHex || !encryptedBase64) {
            return { success: false, message: 'Formato de encriptación inválido.' };
        }
        
        const iv = Buffer.from(ivHex, 'hex');
        const encrypted = Buffer.from(encryptedBase64, 'base64');
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, iv);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        const tempZipPath = path.join(app.getPath('temp'), 'restore_temp.zip');
        fs.writeFileSync(tempZipPath, decrypted);
        
        const { exec } = require('child_process');
        const destFolder = app.getPath('userData');
        const firebaseDest = isDev ? __dirname : process.resourcesPath;
        
        const tempExtractDir = path.join(app.getPath('temp'), 'restore_extract');
        if (fs.existsSync(tempExtractDir)) {
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempExtractDir, { recursive: true });
        
        await new Promise((res, rej) => {
            exec(`powershell -Command "Expand-Archive -Path '${tempZipPath}' -DestinationPath '${tempExtractDir}' -Force"`, (err) => {
                if (err) rej(err);
                else res();
            });
        });
        
        const extractedDb = path.join(tempExtractDir, 'database.sqlite');
        if (fs.existsSync(extractedDb)) {
            const finalDbPath = path.join(app.getPath('userData'), 'database.sqlite');
            fs.copyFileSync(extractedDb, finalDbPath);
        }
        
        const extractedFirebase = path.join(tempExtractDir, 'firebase_data');
        if (fs.existsSync(extractedFirebase)) {
            const finalFirebasePath = path.join(firebaseDest, 'firebase_data');
            if (fs.existsSync(finalFirebasePath)) {
                fs.rmSync(finalFirebasePath, { recursive: true, force: true });
            }
            fs.mkdirSync(finalFirebasePath, { recursive: true });
            
            await new Promise((res, rej) => {
                exec(`powershell -Command "Copy-Item -Path '${extractedFirebase}\\*' -DestinationPath '${finalFirebasePath}' -Recurse -Force"`, (err) => {
                    if (err) rej(err);
                    else res();
                });
            });
        }
        
        fs.unlinkSync(tempZipPath);
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
        
        return { success: true, message: 'Base de datos restaurada con éxito. Reinicia la aplicación.' };
    } catch (e) {
        console.error('[Restore Error]', e);
        return { success: false, message: `Error de desencriptación o restauración: ${e.message}` };
    }
});

/**
 * Abre la configuración de red para que el admin vea su IP
 */
ipcMain.handle('open-network-settings', () => {
    if (mainWindow) mainWindow.loadURL(`http://localhost:3000/dashboard/setup/network`);
});

/**
 * Crea un respaldo .zip de la base de datos local
 */
ipcMain.handle('create-local-backup', async () => {
    const { exec } = require('child_process');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupFolder = path.join(app.getPath('documents'), 'AdminCom_Backups');
    const sourceFolder = isDev 
        ? path.join(__dirname, 'firebase_data')
        : path.join(process.resourcesPath, 'firebase_data');
    
    const zipPath = path.join(backupFolder, `DB_RESPALDO_${timestamp}.zip`);

    if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder, { recursive: true });

    // Comando de PowerShell para comprimir (Nativo en Windows)
    const cmd = `Compress-Archive -Path "${sourceFolder}\\*" -DestinationPath "${zipPath}" -Force`;

    return new Promise((resolve) => {
        exec(`powershell -Command "${cmd}"`, (error) => {
            if (error) {
                resolve({ success: false, message: error.message });
            } else {
                resolve({ success: true, path: zipPath });
            }
        });
    });
});

/**
 * Manejador de Impresión Silenciosa para Tickets
 */
ipcMain.handle('print-silent', async (event, htmlContent) => {
    const tempWindow = new BrowserWindow({ show: false });
    tempWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    
    return new Promise((resolve) => {
        tempWindow.webContents.on('did-finish-load', () => {
            tempWindow.webContents.print({ silent: true, printBackground: true });
            setTimeout(() => { tempWindow.close(); resolve(true); }, 2000);
        });
    });
});


ipcMain.handle('check-for-updates', () => {
    if (!isDev) autoUpdater.checkForUpdates();
});

/**
 * Escanea la red local y los puertos USB físicos buscando la Bóveda NAS/Física.
 */
ipcMain.handle('scan-for-vault-drive', async () => {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
        // En Windows usamos wmic para encontrar discos extraíbles o de red (DriveType 2 o 4)
        exec(`powershell -Command "Get-WmiObject Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 -or $_.DriveType -eq 4 } | Select-Object -ExpandProperty DeviceID"`, (err, stdout) => {
            if (err) {
                console.error('[NAS] Error escaneando bóvedas:', err);
                resolve({ success: false, message: 'No se encontraron memorias USB ni Módems.' });
                return;
            }
            
            const drives = stdout.trim().split('\n').map(d => d.trim()).filter(Boolean);
            if (drives.length === 0) {
                resolve({ success: false, message: 'No se detectó ninguna Bóveda conectada (USB o Módem).' });
                return;
            }
            
            // Tomamos la primera unidad extraíble que encontremos para enlazarla
            const targetDrive = drives[0];
            
            // Guardamos la configuración silenciosamente (persistente en appData)
            try {
                const configPath = path.join(app.getPath('userData'), 'nas_config.json');
                fs.writeFileSync(configPath, JSON.stringify({ vaultDrive: targetDrive }));
                resolve({ success: true, target: targetDrive, message: `Bóveda NAS Enlazada con éxito en la unidad ${targetDrive}:\\` });
            } catch (fsErr) {
                resolve({ success: false, message: 'Bóveda encontrada pero falló el enlace persistente.' });
            }
        });
    });
});

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
    try {
        const urlHost = await createServer();
        createWindow(urlHost);
        setupAutoUpdater();

        // ─── LocalTunnel / Cloudflared RNI (Red de Nodos Independientes) ───
        const startTunnel = async () => {
            try {
                // TODO: Si isNube() o License === PRO, invocar binario de 'cloudflared' en su lugar.
                // Por ahora, usamos localtunnel con BUCLE DE RECONEXIÓN para nodos gratuitos.
                const localtunnel = require('localtunnel');
                let tunnel = await localtunnel({ port: 3000, subdomain: 'camalion-erp-node' });
                
                console.log(`[P2P Enjambre] Nodo RNI activo en: ${tunnel.url}`);
                global.rniUrl = tunnel.url;
                
                tunnel.on('close', () => {
                    console.warn('[P2P Enjambre] Túnel cerrado. Reconectando en 5 segundos (Modo Zombie)...');
                    setTimeout(startTunnel, 5000); // Bucle infinito de reconexión
                });
                
                tunnel.on('error', (err) => {
                    console.error('[P2P Enjambre] Error en el túnel:', err);
                    tunnel.close();
                });
                
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('rni-url-ready', tunnel.url);
                }
            } catch (err) {
                console.error('Error al iniciar el Túnel RNI:', err);
                setTimeout(startTunnel, 10000);
            }
        };
        startTunnel();

    } catch (err) {
        console.error('[App] Error fatal:', err);
        dialog.showErrorBox('Error de inicio', `No se pudo iniciar Admin.com ERP.\n\n${err.message}`);
        app.quit();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // ─── USB Master Key & Encrypted Backup ───
    let wasKeyFound = true;
    let lastKnownKeyDrive = null;
    
    const crypto = require('crypto');
    const SECRET_KEY = crypto.createHash('sha256').update(process.env.INTERNAL_API_SECRET || 'terraform-default-secret-key-123456789').digest();
    
    async function performEncryptedBackup(usbDrive = null) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const tempZipPath = path.join(app.getPath('temp'), `BUNKKER_${timestamp}.zip`);
            const { exec } = require('child_process');
            
            const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
            const firebasePath = isDev ? path.join(__dirname, 'firebase_data') : path.join(process.resourcesPath, 'firebase_data');
            
            let pathsToZip = [];
            if (fs.existsSync(dbPath)) pathsToZip.push(dbPath);
            if (fs.existsSync(firebasePath)) pathsToZip.push(firebasePath);
            
            if (pathsToZip.length === 0) return;
            
            const pathsArg = pathsToZip.map(p => `"${p}"`).join(',');
            await new Promise((res) => exec(`powershell -Command "Compress-Archive -Path ${pathsArg} -DestinationPath '${tempZipPath}' -Force"`, res));
            
            if (!fs.existsSync(tempZipPath)) return;
            
            const fileBuffer = fs.readFileSync(tempZipPath);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
            let encrypted = cipher.update(fileBuffer);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            
            const backupContent = "BUNKKER_SECURE_V1\n" + iv.toString('hex') + ':' + encrypted.toString('base64');
            
            if (usbDrive) {
                fs.writeFileSync(`${usbDrive}:\\BUNKKER_SECURE_BACKUP.txt`, backupContent);
                console.log('[BUNKKER] Respaldo Militar USB Creado');
            }
            
            // --- NAS / USB AUTOMÁTICO (Descubierto por el script) ---
            try {
                const configPath = path.join(app.getPath('userData'), 'nas_config.json');
                if (fs.existsSync(configPath)) {
                    const nasConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    if (nasConfig.vaultDrive) {
                        const nasTarget = path.join(nasConfig.vaultDrive + '\\', 'BUNKKER_SECURE_BACKUP.txt');
                        fs.writeFileSync(nasTarget, backupContent);
                        console.log(`[BUNKKER-NAS] Respaldo en Módem/USB completado en ${nasTarget}`);
                    }
                }
            } catch (nasErr) {
                console.error('[BUNKKER-NAS] Error guardando en Bóveda NAS (Posiblemente desconectada):', nasErr.message);
            }
            
            const driveFolder = path.join(app.getPath('documents'), 'AdminCom_Backups');
            if (!fs.existsSync(driveFolder)) fs.mkdirSync(driveFolder, { recursive: true });
            fs.writeFileSync(path.join(driveFolder, 'BUNKKER_SECURE_BACKUP.txt'), backupContent);
            console.log('[BUNKKER] Respaldo Militar Local Creado');
            
            fs.unlinkSync(tempZipPath);

            // --- EDGE COMPUTING CLOUD SYNC ---
            // Le preguntamos al cerebro local si tenemos licencia PRO y nuestras llaves.
            try {
                // Importamos node-fetch dinámicamente o usamos el nativo de Node 18+
                const fetchAPI = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
                const statusRes = await fetchAPI('http://localhost:3000/api/pairing/status');
                const config = await statusRes.json();

                if (config.isPro && config.tenantId && config.cloudToken) {
                    console.log(`[BUNKKER-EDGE] Licencia PRO detectada. Subiendo snapshot encriptado de ${config.tenantId} a la Nube...`);
                    
                    const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL || 'https://us-central1-admin-erp-pro-1.cloudfunctions.net';
                    const uploadRes = await fetchAPI(`${CLOUD_URL}/uploadBackup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            tenantId: config.tenantId,
                            token: config.cloudToken,
                            payload: backupContent
                        })
                    });

                    const uploadData = await uploadRes.json();
                    if (uploadData.success) {
                        console.log('[BUNKKER-EDGE] Sincronización Edge exitosa. Snapshot almacenado en Firebase Storage.');
                    } else {
                        console.error('[BUNKKER-EDGE] Error de sincronización Edge:', uploadData.error);
                    }
                }
            } catch (syncErr) {
                console.error('[BUNKKER-EDGE] No se pudo conectar a la Nube para el Edge Sync:', syncErr.message);
            }

        } catch (e) {
            console.error('[BUNKKER] Error en respaldo:', e);
        }
    }

    // Ejecutar respaldo automático cada 2 horas a la nube y USB si está presente
    setInterval(() => performEncryptedBackup(lastKnownKeyDrive), 2 * 60 * 60 * 1000);
    
    setInterval(() => {
        const drives = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        let keyFound = false;
        let keyDrive = null;
        
        for (const drive of drives) {
            const keyPath = `${drive}:\\BUNKKER_MASTER.key`;
            try {
                if (fs.existsSync(keyPath)) {
                    keyFound = true;
                    keyDrive = drive;
                    break;
                }
            } catch (e) {}
        }

        lastKnownKeyDrive = keyDrive;

        if (keyFound !== wasKeyFound) {
            wasKeyFound = keyFound;
            if (mainWindow) {
                mainWindow.webContents.send('usb-key-status', keyFound);
                
                // Si la llave se conectó, hacer backup silencioso INMEDIATO
                if (keyFound && keyDrive) {
                    performEncryptedBackup(keyDrive);
                }
            }
        }
    }, 2000); // Revisar cada 2 segundos
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
    if (serverProcess) serverProcess.kill();
});
