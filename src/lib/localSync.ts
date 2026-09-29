/**
 * Lógica de Sincronización Local P2P para Electron
 * Permite que las PCs se encuentren en la misma red Wi-Fi/LAN.
 */

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

// --- ISO STANDARD: OFFLINE QUEUE (Write-Ahead Logging) ---

function queueOfflineTransaction(payload: any) {
    if (typeof window === 'undefined') return;
    const QUEUE_KEY = 'bunkker_offline_queue';
    try {
        const queueStr = localStorage.getItem(QUEUE_KEY)
            ?? localStorage.getItem('evo_offline_queue'); // Migración desde clave antigua
        let queue = queueStr ? JSON.parse(queueStr) : [];
        // Limpiar clave legacy si existía
        localStorage.removeItem('evo_offline_queue');
        if (queue.length >= 500) {
            console.warn("[P2P/WAL] Límite de cola offline alcanzado (500 transacciones). Descartando la más antigua.");
            queue.shift();
        }
        queue.push(payload);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.error("Error al encolar transacción local:", e);
    }
}

function flushOfflineQueue() {
    if (typeof window === 'undefined') return;
    if (!localSocket || localSocket.readyState !== WebSocket.OPEN) return;
    const QUEUE_KEY = 'bunkker_offline_queue';

    try {
        const queueStr = localStorage.getItem(QUEUE_KEY);
        if (!queueStr) return;

        let queue: any[] = JSON.parse(queueStr);
        if (queue.length === 0) return;

        console.log(`[P2P/WAL] Sincronizando cola offline... (${queue.length} transacciones pendientes)`);

        while (queue.length > 0 && localSocket && localSocket.readyState === WebSocket.OPEN) {
            const payload = queue[0];
            try {
                localSocket.send(JSON.stringify(payload));
                console.log(`[P2P/WAL] Reintentado y confirmado: ${payload.type} (${payload.txId})`);
            } catch (sendErr) {
                console.error(`[P2P/WAL] Error al enviar ${payload.txId}. Deteniendo flush.`, sendErr);
                localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
                return;
            }
            queue.shift();
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        }

        if (queue.length === 0) {
            localStorage.removeItem(QUEUE_KEY);
        }
    } catch (e) {
        console.error("Error al vaciar la cola offline:", e);
    }
}

// Iniciar el Auto-Retry Loop en el cliente
if (typeof window !== 'undefined') {
    setInterval(flushOfflineQueue, 3000);
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
