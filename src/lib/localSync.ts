/**
 * Lógica de Sincronización Local P2P para Electron
 * Permite que las PCs se encuentren en la misma red Wi-Fi/LAN.
 */

const isNode = typeof window === 'undefined' || !!(window as any).electronAPI;

// Cargamos multicast-dns de forma dinámica para que Next.js no intente empaquetarlo en el cliente web
const getMdnsBrowser = () => {
    if (isNode) {
        try {
            // Usamos eval('require') para que Webpack ignore esta dependencia durante el build
            const mdns = eval('require')('multicast-dns');
            return (mdns.default || mdns)();
        } catch (e) { return null; }
    }
    return null;
};

const browser = getMdnsBrowser() || { on: () => {}, query: () => {}, respond: () => {} };
const SERVICE_NAME = 'admin-com-master.local';
const PORT = 3001;
let localSocket: WebSocket | null = null;

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
 * CONEXIÓN: Establece el túnel de WebSockets con el Maestro
 */
function connectToMaster(ip: string) {
    if (localSocket) return;

    localSocket = new WebSocket(`ws://${ip}:${PORT}`);

    localSocket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        console.log("Cambio recibido desde el Maestro:", payload);
        // Aquí llamarías a electronAPI.inventory.updateLocalStock(payload.data)
    };

    localSocket.onclose = () => {
        localSocket = null;
        console.warn("Conexión perdida con el Maestro local. Reintentando...");
    };
}

/**
 * SINCRONIZACIÓN: Envía un cambio al maestro para que lo guarde y difunda
 */
export function emitToMaster(type: string, data: any) {
    if (!localSocket || localSocket.readyState !== WebSocket.OPEN) {
        console.warn(`[P2P] No se pudo enviar ${type}: Sin conexión activa con el Maestro.`);
        return;
    }
    
    try {
        localSocket.send(JSON.stringify({ type, data }));
    } catch (err) {
        console.error("[P2P] Error al emitir mensaje:", err);
    }
}

function getLocalIP() {
    // Si estamos en el navegador (cliente), no podemos acceder a 'os'
    if (typeof window !== 'undefined' && !(window as any).electronAPI) return '127.0.0.1';
    
    let os: any;
    try {
        // Ocultamos el módulo nativo 'os' del análisis estático de Webpack
        os = eval('require')('os');
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
