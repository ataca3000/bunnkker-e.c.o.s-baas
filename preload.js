const { contextBridge, ipcRenderer } = require('electron');

// Expone APIs seguras al renderer (Next.js) via window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
    getVersion: () => ipcRenderer.invoke('get-app-version'),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    getMachineId: () => ipcRenderer.invoke('get-machine-id'),
    getRniUrl: () => ipcRenderer.invoke('get-rni-url'),
    restoreBackup: (fileContent) => ipcRenderer.invoke('restore-backup', fileContent),

    onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, version) => cb(version)),
    onUpdateProgress: (cb) => ipcRenderer.on('update-progress', (_, percent) => cb(percent)),
    onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, version) => cb(version)),
    onUsbStatus: (cb) => ipcRenderer.on('usb-key-status', (_, hasKey) => cb(hasKey)),
    onRniUrlReady: (cb) => ipcRenderer.on('rni-url-ready', (_, url) => cb(url)),

    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
