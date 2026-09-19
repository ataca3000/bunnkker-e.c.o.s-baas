/**
 * Logica de Sincronizacion Local P2P para Electron
 * Permite que las PCs se encuentren en la misma red Wi-Fi/LAN.
 */

import { enqueueSync, getPendingSyncItems, markSyncSent, markSyncFailed, getSyncQueueCount } from './idb/idb-service';


const isNode = typeof window === 'undefined' || !!(window as any).electronAPI;

// Cargamos multicast-dns de forma dinámica para que Next.js no intente empaquetarlo en el cliente web
const getMdnsBrowser = () => {
    if (isNode) {
        try {
            // Usamos globalThis.require para evitar eval y silenciar Webpack
            const req = (globalThis as any).require;
            if (req) {
                const mdns = req('multicast-dns');
                return (mdns.default || mdns)();
            }
        } catch (e) { return null; }
    }
    return null;
};

const browser = getMdnsBrowser() || { on: () => {}, query: () => {}, respond: () => {} };
const SERVICE_NAME = 'bunkker-master.local';
const LEGACY_SERVICE_NAME = 'admin-com-master.local'; // Solo referencia, no se usa en código activo
const PORT = 3001;
let localSocket: WebSocket | null = null;
let _masterIp: string | null = null;         // última IP conocida del maestro
let _wsBackoffMs = 1_000;                    // backoff inicial 1s
const WS_MAX_BACKOFF = 30_000;              // máximo 30s entre reintentos
let _wsRetryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Estado global de la red para el UI
 */
export const networkStatus = {
    connected: false,
    masterIp: null as string | null,
    isMaster: !isNode ? false : false // Se define al iniciar
};

interface SyncNode {
    ip: string;
    isMaster: boolean;
    lastSeen: number;
}

/**
 * EL MAESTRO: Anuncia su presencia en la red local.
 */
export function startMasterBroadcast() {
    networkStatus.isMaster = true;
    browser.on('query', (query: { questions: any[] }) => {
        if (query.questions && query.questions.some((q) => q.name === SERVICE_NAME)) {
            browser.respond({
                answers: [{
                    name: SERVICE_NAME,
                    type: 'A',
                    ttl: 300,
                    data: getLocalIP()
                }]
            });
        }
    });
}

/**
 * EL CLIENTE: Busca al maestro en la red local.
 */
export function findMasterNode(onFound: (ip: string) => void) {
    browser.on('response', (response: { answers: any[] }) => {
        const answer = response.answers?.find((a) => a.name === SERVICE_NAME);
        if (answer && answer.type === 'A') {
            const masterIp = answer.data;
            
            // Estilo ShareIt: Si encontramos al maestro, guardamos su IP para Firebase
            if (typeof window !== 'undefined') {
                const currentSaved = localStorage.getItem('FIREBASE_MASTER_IP');
                if (currentSaved !== masterIp) {
                    localStorage.setItem('FIREBASE_MASTER_IP', masterIp);
                    console.log("¡Maestro encontrado! IP guardada:", masterIp);
                }
            }
            
            networkStatus.connected = true;
            networkStatus.masterIp = masterIp;
            onFound(masterIp);
            connectToMaster(masterIp);
        }
    });

    triggerManualDiscovery();
}

/**
 * Fuerza una búsqueda inmediata del servidor en la red
 */
export function triggerManualDiscovery() {
    console.log("[P2P] Buscando servidor maestro...");
    browser.query({
        questions: [{ name: SERVICE_NAME, type: 'A' }]
    });
}

/**
 * CONEXIÓN: Establece el túnel de WebSockets con el Maestro.
 * Reintenta automáticamente con backoff exponencial si se corta.
 */
function connectToMaster(ip: string) {
    if (localSocket && localSocket.readyState === WebSocket.OPEN) return;

    _masterIp = ip;
    localSocket = new WebSocket(`ws://${ip}:${PORT}`);

    localSocket.onopen = () => {
        _wsBackoffMs = 1_000; // reset al conectar
        if (_wsRetryTimer) { clearTimeout(_wsRetryTimer); _wsRetryTimer = null; }
        console.log(`✅ [P2P] Conectado al maestro ${ip}:${PORT}`);
        flushOfflineQueue();
    };

    localSocket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        console.log("Cambio recibido desde el Maestro:", payload);
        // Aquí llamarías a electronAPI.inventory.updateLocalStock(payload.data)
    };

    localSocket.onclose = () => {
        localSocket = null;
        if (!_masterIp) return;
        _wsBackoffMs = Math.min(_wsBackoffMs * 2, WS_MAX_BACKOFF);
        console.warn(`⚠️  [P2P] Conexión perdida. Reconectando en ${_wsBackoffMs / 1000}s...`);
        _wsRetryTimer = setTimeout(() => connectToMaster(_masterIp!), _wsBackoffMs);
    };

    localSocket.onerror = () => {
        // El evento onclose se dispara después — allí manejamos el retry
        localSocket?.close();
    };
}

/**
 * SINCRONIZACIÓN ATÓMICA: Envía un cambio al maestro. 
 * Si no hay conexión, se encola en localStorage y se reintenta automáticamente (WAL - ISO Standard).
 */
export function emitToMaster(type: string, data: any) {
    if (typeof window === 'undefined') return;

    // Generar un UUID (Transaction ID) para hacer la operación idempotente
    const txId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const timestamp = Date.now();
    
    const payload = { txId, timestamp, type, data };

    if (!localSocket || localSocket.readyState !== WebSocket.OPEN) {
        console.warn(`[P2P/WAL] Sin conexión activa. Encolando transacción: ${type} (${txId})`);
        queueOfflineTransaction(payload);
        return;
    }
    
    try {
        localSocket.send(JSON.stringify(payload));
        console.log(`[P2P] Transacción enviada: ${type} (${txId})`);
    } catch (err) {
        console.error("[P2P] Error al emitir mensaje, encolando:", err);
        queueOfflineTransaction(payload);
    }
}

// ─── ISO STANDARD: OFFLINE QUEUE (Write-Ahead Logging via IndexedDB) ──────────

/** Resuelve el storeId activo para la cola de sync */
function getQueueStoreId(): string {
    if (typeof window === 'undefined') return 'default';
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('s');
    if (fromUrl && fromUrl.length > 8) return fromUrl;
    return localStorage.getItem('_bunkker_active_store') ?? 'default';
}

/**
 * Encola una transaccion en IndexedDB (WAL).
 * Migrado de localStorage para mayor capacidad y atomicidad.
 */
function queueOfflineTransaction(payload: any) {
    if (typeof window === 'undefined') return;
    const storeId = getQueueStoreId();
    enqueueSync(storeId, payload.type, payload.data).catch((e) =>
        console.error('[P2P/WAL] Error al encolar en IDB:', e)
    );
}


/**
 * Vacia la cola de transacciones pendientes enviandolas al maestro via WebSocket.
 * Ahora lee de IndexedDB en lugar de localStorage.
 */
async function flushOfflineQueue() {
    if (typeof window === 'undefined') return;
    if (!localSocket || localSocket.readyState !== WebSocket.OPEN) return;

    const storeId = getQueueStoreId();
    try {
        const pending = await getPendingSyncItems(storeId);
        if (pending.length === 0) return;

        console.log(`[P2P/WAL] Sincronizando cola IDB... (${pending.length} transacciones pendientes)`);

        for (const item of pending) {
            if (!localSocket || localSocket.readyState !== WebSocket.OPEN) break;
            try {
                localSocket.send(JSON.stringify({
                    txId: item.txId,
                    timestamp: item.timestamp,
                    type: item.type,
                    data: item.data,
                }));
                await markSyncSent(item.txId);
                console.log(`[P2P/WAL] Enviado y confirmado: ${item.type} (${item.txId})`);
            } catch (sendErr) {
                await markSyncFailed(item.txId);
                console.error(`[P2P/WAL] Error al enviar ${item.txId}. Deteniendo flush.`, sendErr);
                break;
            }
        }
    } catch (e) {
        console.error('[P2P/WAL] Error al vaciar la cola IDB:', e);
    }
}


// Iniciar el Auto-Retry Loop en el cliente (singleton — evita intervalos duplicados)
declare global { var _bunkkerFlushInterval: ReturnType<typeof setInterval> | undefined; }
if (typeof window !== 'undefined' && !globalThis._bunkkerFlushInterval) {
    globalThis._bunkkerFlushInterval = setInterval(flushOfflineQueue, 3000);
}

// ─── Real-Time Sync Status & Server Monitoring ─────────────────────────────

export interface SyncState {
    status: 'online' | 'syncing' | 'offline';
    latencyMs: number | null;
    pendingQueue: number;
    lastSyncTime: number | null;
    serverName: string;
    serverIp: string;
    isMaster: boolean;
    lastChecked: number;
}

/**
 * Cuenta los items pendientes de sync (ahora desde IndexedDB).
 */
export async function getOfflineQueueCount(): Promise<number> {
    const storeId = getQueueStoreId();
    return getSyncQueueCount(storeId);
}


let currentSyncState: SyncState = {
    status: 'online',
    latencyMs: null,
    pendingQueue: 0,
    lastSyncTime: null,
    serverName: 'Servidor Principal ERP',
    serverIp: '127.0.0.1',
    isMaster: false,
    lastChecked: Date.now(),
};

const syncListeners = new Set<(state: SyncState) => void>();

function notifySyncListeners() {
    const stateCopy = { ...currentSyncState };
    syncListeners.forEach((listener) => {
        try {
            listener(stateCopy);
        } catch (e) {
            console.warn('[SyncStatus] Error en listener:', e);
        }
    });
}

export function getSyncState(): SyncState {
    return { ...currentSyncState, pendingQueue: getOfflineQueueCount() };
}

export function subscribeSyncStatus(listener: (state: SyncState) => void): () => void {
    syncListeners.add(listener);
    // Disparo inmediato con estado actual
    listener(getSyncState());
    return () => {
        syncListeners.delete(listener);
    };
}

/**
 * Mide en tiempo real la conectividad, latencia y respuesta con el Servidor Principal
 */
export async function pingMainServer(): Promise<SyncState> {
    if (typeof window === 'undefined') return currentSyncState;

    const queueCount = getOfflineQueueCount();
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
        const res = await fetch('/api/health?t=' + Date.now(), {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            const latency = Math.round(performance.now() - startTime);

            currentSyncState = {
                status: queueCount > 0 ? 'syncing' : 'online',
                latencyMs: latency,
                pendingQueue: queueCount,
                lastSyncTime: Date.now(),
                serverName: data.serverName || 'Servidor Principal ERP',
                serverIp: data.localIp || window.location.hostname || '127.0.0.1',
                isMaster: networkStatus.isMaster,
                lastChecked: Date.now(),
            };
        } else {
            currentSyncState = {
                ...currentSyncState,
                status: 'offline',
                latencyMs: null,
                pendingQueue: queueCount,
                lastChecked: Date.now(),
            };
        }
    } catch {
        clearTimeout(timeoutId);
        currentSyncState = {
            ...currentSyncState,
            status: 'offline',
            latencyMs: null,
            pendingQueue: queueCount,
            lastChecked: Date.now(),
        };
    }

    notifySyncListeners();
    return currentSyncState;
}

/**
 * Dispara una sincronización inmediata manual de la cola offline hacia el servidor
 */
export async function triggerManualSync(): Promise<{ success: boolean; queueRemaining: number }> {
    if (typeof window === 'undefined') return { success: false, queueRemaining: 0 };

    currentSyncState.status = 'syncing';
    notifySyncListeners();

    try {
        flushOfflineQueue();
        await pingMainServer();
        const remaining = getOfflineQueueCount();
        currentSyncState.pendingQueue = remaining;
        currentSyncState.status = remaining > 0 ? 'syncing' : (currentSyncState.latencyMs !== null ? 'online' : 'offline');
        if (currentSyncState.status === 'online') {
            currentSyncState.lastSyncTime = Date.now();
        }
        notifySyncListeners();
        return { success: currentSyncState.status === 'online', queueRemaining: remaining };
    } catch (err) {
        console.error('[SyncStatus] Error al forzar sincronización:', err);
        await pingMainServer();
        return { success: false, queueRemaining: getOfflineQueueCount() };
    }
}

// Iniciar monitoreo continuo en tiempo real en el cliente (singleton — evita intervalos duplicados)
declare global { var _bunkkerPingInterval: ReturnType<typeof setInterval> | undefined; }
if (typeof window !== 'undefined' && !globalThis._bunkkerPingInterval) {
    // Ping inicial diferido
    setTimeout(pingMainServer, 300);

    // Monitoreo periódico cada 10s (reducido de 4s para menor carga en servidor)
    // Se pausa automáticamente cuando la pestaña no está visible
    globalThis._bunkkerPingInterval = setInterval(() => {
        if (!document.hidden) pingMainServer();
    }, 10_000);

    // Reaccionar a cambios en conexión de red del navegador
    window.addEventListener('online', () => {
        pingMainServer();
        flushOfflineQueue();
    });

    window.addEventListener('offline', () => {
        currentSyncState = {
            ...currentSyncState,
            status: 'offline',
            latencyMs: null,
            pendingQueue: getOfflineQueueCount(),
            lastChecked: Date.now(),
        };
        notifySyncListeners();
    });

    // Ping inmediato al volver a visibilidad (tab en primer plano)
    window.addEventListener('visibilitychange', () => {
        if (!document.hidden) pingMainServer();
    });

    // Detectar cambios en la cola en local storage entre pestañas o módulos
    window.addEventListener('storage', (e) => {
        if (e.key === 'bunkker_offline_queue' || e.key === 'evo_offline_queue') {
            currentSyncState.pendingQueue = getOfflineQueueCount();
            notifySyncListeners();
        }
    });
}

function getLocalIP() {
    // Si estamos en el navegador (cliente), no podemos acceder a 'os'
    if (typeof window !== 'undefined' && !(window as any).electronAPI) return '127.0.0.1';
    
    let os: any;
    try {
        // Usamos globalThis.require para evitar eval
        const req = (globalThis as any).require;
        if (req) {
            os = req('os');
        } else {
            return '127.0.0.1';
        }
    } catch (e) { return '127.0.0.1'; }

    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        if (!iface) continue;
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}
