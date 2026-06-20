const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
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

        serverProcess = fork(serverPath, [], {
            env: {
                ...process.env,
                PORT: '3000',
                HOSTNAME: '0.0.0.0', // Permite conexiones externas (WiFi/LAN)
                NODE_ENV: 'production',
                MACHINE_HWID: machineIdSync(true) // Inyecta el HWID para que Next.js valide la licencia
            },
            stdio: 'inherit',
        });

        // Wait for server to boot
        setTimeout(resolve, 3000);

        serverProcess.on('error', (err) => {
            console.error('[Server] Error:', err);
            reject(err);
        });
    });
};

// ─── Main window ────────────────────────────────────────────────────────────
const createWindow = (urlHost = 'localhost') => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width,
        height,
        title: 'Admin.com ERP',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    mainWindow.loadURL(`http://${urlHost}:3000`);

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => { mainWindow = null; });
};

// ─── IPC Handlers ───────────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

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

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
    try {
        const urlHost = await createServer();
        createWindow(urlHost);
        setupAutoUpdater();
    } catch (err) {
        console.error('[App] Error fatal:', err);
        dialog.showErrorBox('Error de inicio', `No se pudo iniciar Admin.com ERP.\n\n${err.message}`);
        app.quit();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
    if (serverProcess) serverProcess.kill();
});
