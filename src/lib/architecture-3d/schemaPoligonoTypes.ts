/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BUNKKER E.C.O.S. — Modelo de Esquema Poligonal 3D por Capas de Software
 * ═══════════════════════════════════════════════════════════════════════════
 * Define la topología circulatoria del sistema dividida en 5 capas isométricas
 * tridimensionales, sus nodos poligonales, compuertas lógicas y paquetes de flujo.
 * Basado en el Protocolo N3 de Fontanería Sistémica.
 */

export type NodeStatus = 'IMPLEMENTADO' | 'PARCIAL' | 'PENDIENTE' | 'ROTO_DUDOSO';

export interface PlumbingQuestionnaire {
    queAccionOcurre: string;
    deQueDatoDepende: string;
    caminoExitoYRechazo: string;
    mutacionDatos: string;
    partesAfectadas: string;
    quienRecibeResultado: string;
    queFallaEnCorteRed: string;
    recuperacionIdempotencia: string;
}

export interface PolygonNode {
    id: string;
    name: string;
    layerIndex: number; // 0 (Superior / UI) a 4 (Base / Salidas)
    x: number; // Coordenada X normalizada (-2 a +2)
    y: number; // Coordenada Y normalizada (-1.5 a +1.5)
    role: string;
    color: string;
    accentColor: string;
    polygonShape: 'hexagon' | 'diamond' | 'shield' | 'octagon' | 'square';
    status: NodeStatus;
    tags: string[];
    plumbing: PlumbingQuestionnaire;
}

export interface ArchitectureLayer {
    index: number;
    name: string;
    category: 'RAICES' | 'ARTERIAS' | 'COMPUERTAS' | 'CORAZON' | 'SALIDAS';
    description: string;
    color: string;
    wireframeColor: string;
    nodes: PolygonNode[];
}

export interface InterLayerPipe {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    protocol: 'HTTP_JSON' | 'SOCKET_IO' | 'SQLITE_WAL' | 'PRISMA' | 'ESC_POS' | 'WEBRTC';
    status: 'ACTIVE' | 'SYNCING' | 'IDLE';
    latencyMs: number;
}

export interface SoftwareFlowSimulation {
    id: string;
    name: string;
    description: string;
    color: string;
    steps: {
        stepIndex: number;
        nodeId: string;
        actionLabel: string;
        layerName: string;
        durationMs: number;
    }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. DEFINICIÓN DE CAPAS ISOMÉTRICAS 3D (TOPOLOGÍA SISTÉMICA)
// ═══════════════════════════════════════════════════════════════════════════

export const ARCHITECTURE_LAYERS: ArchitectureLayer[] = [
    {
        index: 0,
        name: "CAPA 1: RAÍCES & TERMINALES (FRONTEND / CLIENTS)",
        category: "RAICES",
        description: "Puntos de captura física y táctil distribuidos en la tienda y exteriores.",
        color: "#38bdf8", // Sky blue
        wireframeColor: "rgba(56, 189, 248, 0.25)",
        nodes: [
            {
                id: "terminal_pos",
                name: "Terminal Caja / POS",
                layerIndex: 0,
                x: -1.4,
                y: -0.6,
                role: "Cajero",
                color: "#0284c7",
                accentColor: "#38bdf8",
                polygonShape: "hexagon",
                status: "IMPLEMENTADO",
                tags: ["React 19", "Zustand", "Atajos Teclado"],
                plumbing: {
                    queAccionOcurre: "Escaneo de código de barras o búsqueda rápida y cobro directo.",
                    deQueDatoDepende: "Turno de caja abierto y autenticación por PIN con RBAC.",
                    caminoExitoYRechazo: "Éxito: Emite venta directa. Rechazo: Stock insuficiente o sin fondos.",
                    mutacionDatos: "Genera draft en IndexedDB local y emite evento HTTP POST /api/sales.",
                    partesAfectadas: "Pizarras de Almacén, inventario físico deducido y cierre de turno.",
                    quienRecibeResultado: "Cajero (ticket en pantalla) y cliente en mostrador.",
                    queFallaEnCorteRed: "Si no hay LAN, el commit se guarda en cola SQLite local.",
                    recuperacionIdempotencia: "UUID idempotente por orden previene cobros dobles."
                }
            },
            {
                id: "catalogo_pwa",
                name: "Catálogo Móvil PWA",
                layerIndex: 0,
                x: -0.4,
                y: 0.8,
                role: "Cliente Final",
                color: "#0ea5e9",
                accentColor: "#7dd3fc",
                polygonShape: "diamond",
                status: "IMPLEMENTADO",
                tags: ["Next.js PWA", "ServiceWorker", "LocalStorage"],
                plumbing: {
                    queAccionOcurre: "Cliente navega productos, arma carrito y solicita pedido QR/Delivery.",
                    deQueDatoDepende: "Catálogo público sincronizado en caché local y geolocalización.",
                    caminoExitoYRechazo: "Éxito: Genera pedido 'pending_payment'. Rechazo: Carrito vacío.",
                    mutacionDatos: "Guarda carrito en cliente y envía POST /api/orders.",
                    partesAfectadas: "Cola de ventas en caja y pantalla de despacho.",
                    quienRecibeResultado: "Cliente recibe QR único con código de seguimiento.",
                    queFallaEnCorteRed: "Permite navegación offline mediante caché estático PWA.",
                    recuperacionIdempotencia: "Hash único de sesión cliente evita duplicar carritos."
                }
            },
            {
                id: "tablet_patio",
                name: "Tablet Patio / Carga",
                layerIndex: 0,
                x: 0.6,
                y: -0.5,
                role: "Despachador Patio",
                color: "#0369a1",
                accentColor: "#38bdf8",
                polygonShape: "shield",
                status: "IMPLEMENTADO",
                tags: ["Touch UI", "Pebble Offline", "Audio VOX"],
                plumbing: {
                    queAccionOcurre: "Confirmación de carga de materiales pesados (varilla, cemento).",
                    deQueDatoDepende: "Orden en estado 'paid' con bandera deliveryType='PATIO'.",
                    caminoExitoYRechazo: "Éxito: Marca isLoaded=true. Rechazo: Orden sin liquidar.",
                    mutacionDatos: "Mutación en orden: `isLoaded: true, loadedAt: Timestamp`.",
                    partesAfectadas: "Stock en patio y estado del pedido en caja.",
                    quienRecibeResultado: "Vigilancia de salida y cliente en vehículo.",
                    queFallaEnCorteRed: "Sincroniza mediante Radio Local PTT o buffer SQLite.",
                    recuperacionIdempotencia: "Comprobación de estado previo `if(isLoaded) return`."
                }
            },
            {
                id: "app_repartidor",
                name: "App Repartidor GPS",
                layerIndex: 0,
                x: 1.4,
                y: 0.6,
                role: "Repartidor",
                color: "#0284c7",
                accentColor: "#67e8f9",
                polygonShape: "octagon",
                status: "IMPLEMENTADO",
                tags: ["Leaflet", "GPS Polígonos", "Firma PoD"],
                plumbing: {
                    queAccionOcurre: "Recepción de ruta, navegación GPS y captura de firma/foto de entrega.",
                    deQueDatoDepende: "Orden en 'OUT_FOR_DELIVERY' asignada al repartidor autenticado.",
                    caminoExitoYRechazo: "Éxito: Marca 'DELIVERED' con PoD. Rechazo: 'rejected' con motivo.",
                    mutacionDatos: "Actualiza `status='DELIVERED', podSignature, podPhotoUrl`.",
                    partesAfectadas: "Pizarra de auditoría, panel admin y balance de cobranza.",
                    quienRecibeResultado: "Cliente recibe comprobante y administrador ve entrega cerrada.",
                    queFallaEnCorteRed: "La firma y fotos se guardan en IndexedDB y se retransmiten al reconectar.",
                    recuperacionIdempotencia: "La orden se sella criptográficamente al pasar a estado terminal."
                }
            }
        ]
    },
    {
        index: 1,
        name: "CAPA 2: ARTERIAS & TRANSPORTE (GATEWAY / BUS)",
        category: "ARTERIAS",
        description: "Canales de transmisión en tiempo real, mallas de radio y APIs seguras.",
        color: "#06b6d4", // Cyan
        wireframeColor: "rgba(6, 182, 212, 0.22)",
        nodes: [
            {
                id: "next_api_routes",
                name: "Next.js Edge & API Routes",
                layerIndex: 1,
                x: -1.0,
                y: 0.0,
                role: "Controlador REST",
                color: "#0891b2",
                accentColor: "#22d3ee",
                polygonShape: "hexagon",
                status: "IMPLEMENTADO",
                tags: ["Next 15", "App Router", "Fail-Closed"],
                plumbing: {
                    queAccionOcurre: "Recepción, deserialización y validación estricta de payloads entrantes.",
                    deQueDatoDepende: "Cookies de sesión firmadas y tokens de dispositivo de confianza.",
                    caminoExitoYRechazo: "Éxito: Despacha al servicio transaccional. Rechazo: 401/403/422.",
                    mutacionDatos: "No persiste directamente; enruta hacia Prisma y SQLite WAL.",
                    partesAfectadas: "Todas las capas de negocio subyacentes.",
                    quienRecibeResultado: "El cliente HTTP emisor.",
                    queFallaEnCorteRed: "En modo desktop local, el servidor interno 0.0.0.0 atiende sin internet.",
                    recuperacionIdempotencia: "Header `x-idempotency-key` verificado en memoria volátil."
                }
            },
            {
                id: "radio_socket_mesh",
                name: "Malla Radio Local (Socket.IO)",
                layerIndex: 1,
                x: 0.2,
                y: -0.6,
                role: "Telemetría PTT",
                color: "#0e7490",
                accentColor: "#67e8f9",
                polygonShape: "diamond",
                status: "IMPLEMENTADO",
                tags: ["WebSocket", "Multicast LAN", "PTT VOX"],
                plumbing: {
                    queAccionOcurre: "Transmisión de voz walkie-talkie y pulsos de sincronización entre terminales.",
                    deQueDatoDepende: "Puerto 3001 abierto en red Wi-Fi local sin necesidad de internet.",
                    caminoExitoYRechazo: "Éxito: Retransmite a todos los terminales en 12ms. Rechazo: Buffer drop.",
                    mutacionDatos: "Transmite eventos volátiles en memoria sin llenar disco.",
                    partesAfectadas: "Altavoces de tablets y panel de estado en vivo.",
                    quienRecibeResultado: "Toda la cuadrilla de la ferretería en tiempo real.",
                    queFallaEnCorteRed: "Continúa operando 100% autónomo dentro de la red local.",
                    recuperacionIdempotencia: "Los paquetes de audio expiran en 5 segundos (no acumulables)."
                }
            },
            {
                id: "sync_broadcast_channel",
                name: "BroadcastChannel & Sync Worker",
                layerIndex: 1,
                x: 1.1,
                y: 0.5,
                role: "Sincronizador PWA",
                color: "#155e75",
                accentColor: "#a5f3fc",
                polygonShape: "square",
                status: "IMPLEMENTADO",
                tags: ["Web Worker", "BackgroundSync", "PWA Cache"],
                plumbing: {
                    queAccionOcurre: "Coordina pestañas abiertas en el mismo dispositivo y cola offline.",
                    deQueDatoDepende: "Soporte de BroadcastChannel del navegador o Electron.",
                    caminoExitoYRechazo: "Éxito: Sincroniza estado de inventario entre pestañas.",
                    mutacionDatos: "Propaga eventos 'STOCK_UPDATED' al estado en memoria de React.",
                    partesAfectadas: "Componentes UI activos.",
                    quienRecibeResultado: "Listeners suscritos en Zustand.",
                    queFallaEnCorteRed: "Inmune a cortes de red: opera a nivel de proceso del navegador.",
                    recuperacionIdempotencia: "Marcas de tiempo monotónicas para descartar eventos viejos."
                }
            }
        ]
    },
    {
        index: 2,
        name: "CAPA 3: COMPUERTAS LÓGICAS & FSM (ENGINE & MOTOR)",
        category: "COMPUERTAS",
        description: "Máquinas de estado finitas, cálculo atómico de stock y reglas de negocio.",
        color: "#10b981", // Emerald
        wireframeColor: "rgba(16, 185, 129, 0.22)",
        nodes: [
            {
                id: "fsm_order_machine",
                name: "OrderStateMachine (FSM)",
                layerIndex: 2,
                x: -1.2,
                y: -0.4,
                role: "Autómata de Órdenes",
                color: "#059669",
                accentColor: "#34d399",
                polygonShape: "hexagon",
                status: "IMPLEMENTADO",
                tags: ["FSM Determinista", "16 Estados", "Vitest 100%"],
                plumbing: {
                    queAccionOcurre: "Transición determinista de estados: pending -> paid -> PREPARANDO -> DELIVERED.",
                    deQueDatoDepende: "Estado actual de la orden y permisos del rol emisor.",
                    caminoExitoYRechazo: "Éxito: Aplica transición y sella timestamp. Rechazo: Error de transición inválida.",
                    mutacionDatos: "Mutación atómica de estado en tabla `Order`.",
                    partesAfectadas: "Flujo de despacho, cobranza y almacén.",
                    quienRecibeResultado: "El orquestador de pedidos y la pizarra pública.",
                    queFallaEnCorteRed: "La máquina valida sobre el archivo SQLite local sin dependencias cloud.",
                    recuperacionIdempotencia: "Las transiciones repetidas al mismo estado son no-op seguras."
                }
            },
            {
                id: "stock_mutex_gate",
                name: "StockMutex & Concurrencia",
                layerIndex: 2,
                x: 0.0,
                y: 0.6,
                role: "Árbitro de Inventario",
                color: "#047857",
                accentColor: "#6ee7b7",
                polygonShape: "shield",
                status: "IMPLEMENTADO",
                tags: ["Mutex Lock", "Race Condition Safe", "WAL Atomicity"],
                plumbing: {
                    queAccionOcurre: "Bloqueo secuencial durante ventas simultáneas para impedir sobreventa.",
                    deQueDatoDepende: "Existencia disponible (stockFisico - stockReservado - arrendadoEnRAM).",
                    caminoExitoYRechazo: "Éxito: Deduce stock de forma atómica. Rechazo: Rechaza venta por stock agotado.",
                    mutacionDatos: "Resta cantidad en `Product.stock` y registra auditoría en `StockMovement`.",
                    partesAfectadas: "Todas las terminales que consultan disponibilidad del SKU.",
                    quienRecibeResultado: "El proceso de checkout que solicitó la reserva.",
                    queFallaEnCorteRed: "Garantizado en SQLite mediante transacciones `IMMEDIATE`.",
                    recuperacionIdempotencia: "Transacciones reversibles mediante Rollback automático."
                }
            },
            {
                id: "freemium_license_guard",
                name: "Freemium & RBAC Guard",
                layerIndex: 2,
                x: 1.2,
                y: -0.4,
                role: "Guardián de Acceso",
                color: "#065f46",
                accentColor: "#a7f3d0",
                polygonShape: "octagon",
                status: "IMPLEMENTADO",
                tags: ["Contador Monotónico", "Fail-Closed", "300 Ventas"],
                plumbing: {
                    queAccionOcurre: "Auditoría de tope freemium (300 ventas máx sin licencia) y validación de roles.",
                    deQueDatoDepende: "Archivo firmado de licencia de máquina o contador de ventas activas.",
                    caminoExitoYRechazo: "Éxito: Permite paso transaccional. Rechazo: Abre FreemiumLockModal.",
                    mutacionDatos: "Incrementa contador de ventas monotónico local.",
                    partesAfectadas: "Caja registradora y carrito de compras.",
                    quienRecibeResultado: "Cajero o usuario administrador.",
                    queFallaEnCorteRed: "Evaluado localmente mediante hash criptográfico de máquina.",
                    recuperacionIdempotencia: "El contador es de sólo incremento con sello SHA-256."
                }
            }
        ]
    },
    {
        index: 3,
        name: "CAPA 4: CORAZÓN & PERSISTENCIA (DATA AUTHORITY)",
        category: "CORAZON",
        description: "Almacenamiento de autoridad local-first con replicación asíncrona hacia la nube.",
        color: "#8b5cf6", // Purple
        wireframeColor: "rgba(139, 92, 246, 0.22)",
        nodes: [
            {
                id: "sqlite_wal_engine",
                name: "SQLite WAL Engine (Local-First)",
                layerIndex: 3,
                x: -0.9,
                y: 0.3,
                role: "Autoridad Primaria",
                color: "#7c3aed",
                accentColor: "#a78bfa",
                polygonShape: "hexagon",
                status: "IMPLEMENTADO",
                tags: ["PRAGMA wal", "ACID", "Zero-Latency LAN"],
                plumbing: {
                    queAccionOcurre: "Escritura duradera de transacciones en disco local con lectura concurrente.",
                    deQueDatoDepende: "Bloqueos del sistema de archivos local y consistencia de schemas Prisma.",
                    caminoExitoYRechazo: "Éxito: Commit en WAL y checkpoint. Rechazo: Error de E/S o disco lleno.",
                    mutacionDatos: "Escribe registros binarios en `prisma/dev.db` y `dev.db-wal`.",
                    partesAfectadas: "Todo el sistema operativo del negocio.",
                    quienRecibeResultado: "ORM Prisma y servicios locales.",
                    queFallaEnCorteRed: "Totalmente inmune: no requiere internet ni nube para transaccionar.",
                    recuperacionIdempotencia: "WAL replay automático en el arranque del servidor."
                }
            },
            {
                id: "prisma_orm_bridge",
                name: "Prisma ORM Client",
                layerIndex: 3,
                x: 0.1,
                y: -0.5,
                role: "Capa de Abstracción",
                color: "#6d28d9",
                accentColor: "#c4b5fd",
                polygonShape: "square",
                status: "IMPLEMENTADO",
                tags: ["Prisma 5", "Dual Schemas", "Type-Safe"],
                plumbing: {
                    queAccionOcurre: "Mapeo relacional de tipos entre TypeScript y el motor de base de datos.",
                    deQueDatoDepende: "Sincronía verificada entre `schema.prisma` y `schema.sqlite.prisma`.",
                    caminoExitoYRechazo: "Éxito: Queries fuertemente tipadas. Rechazo: P2002 violación única.",
                    mutacionDatos: "Serialización/deserialización de modelos.",
                    partesAfectadas: "Servicios de negocio.",
                    quienRecibeResultado: "Controladores de API.",
                    queFallaEnCorteRed: "Usa el pool de conexión local SQLite.",
                    recuperacionIdempotencia: "Upserts con cláusula `where: { id }`."
                }
            },
            {
                id: "cloud_sync_replicator",
                name: "Replicador Cloud Asíncrono",
                layerIndex: 3,
                x: 1.1,
                y: 0.2,
                role: "Espejo en Nube",
                color: "#5b21b6",
                accentColor: "#ddd6fe",
                polygonShape: "octagon",
                status: "IMPLEMENTADO",
                tags: ["PostgreSQL", "Outbox Pattern", "Reconexión"],
                plumbing: {
                    queAccionOcurre: "Envío en lotes de los registros locales hacia el backend central en nube.",
                    deQueDatoDepende: "Conectividad a internet y clave API del tenant.",
                    caminoExitoYRechazo: "Éxito: Marca commits como 'SYNCED'. Rechazo: Reintento exponencial.",
                    mutacionDatos: "Actualiza `lastSyncedAt` y purga colas confirmadas.",
                    partesAfectadas: "Dashboard web del dueño y respaldo histórico remoto.",
                    quienRecibeResultado: "Servidor cloud BUNKKER.",
                    queFallaEnCorteRed: "Acumula commits en la tabla Outbox hasta que vuelva la conexión.",
                    recuperacionIdempotencia: "Upsert por UUID con control de versión vectorial."
                }
            }
        ]
    },
    {
        index: 4,
        name: "CAPA 5: SALIDAS & ÓRGANOS VIVOS (DELIVERY & POD)",
        category: "SALIDAS",
        description: "Manifestación física y digital del resultado observable del sistema.",
        color: "#f59e0b", // Amber
        wireframeColor: "rgba(245, 158, 11, 0.22)",
        nodes: [
            {
                id: "impresora_termica",
                name: "Impresora Térmica ESC/POS",
                layerIndex: 4,
                x: -1.2,
                y: 0.4,
                role: "Ticket Físico",
                color: "#d97706",
                accentColor: "#fcd34d",
                polygonShape: "square",
                status: "IMPLEMENTADO",
                tags: ["ESC/POS 80mm", "Corte Automático", "QR Ticket"],
                plumbing: {
                    queAccionOcurre: "Generación e impresión física del comprobante de venta o remisión de patio.",
                    deQueDatoDepende: "Orden confirmada en estado 'paid' y puerto USB/RawBT accesible.",
                    caminoExitoYRechazo: "Éxito: Expulsa papel con QR. Rechazo: Error 'Sin papel' / reintento.",
                    mutacionDatos: "No altera DB; emite stream de bytes binarios a la impresora.",
                    partesAfectadas: "Salida física de caja.",
                    quienRecibeResultado: "El cliente en sus manos.",
                    queFallaEnCorteRed: "Totalmente local por USB o puerto COM en Windows.",
                    recuperacionIdempotencia: "Botón de 'Reimprimir ticket' con folio fijo."
                }
            },
            {
                id: "pod_digital_seal",
                name: "Prueba de Entrega (PoD)",
                layerIndex: 4,
                x: 0.0,
                y: -0.5,
                role: "Sello Digital",
                color: "#b45309",
                accentColor: "#fde68a",
                polygonShape: "shield",
                status: "IMPLEMENTADO",
                tags: ["Firma Canvas", "Foto Domicilio", "Georreferencia"],
                plumbing: {
                    queAccionOcurre: "Captura de firma táctil y fotografía georreferenciada del cliente.",
                    deQueDatoDepende: "Repartidor en coordenadas de entrega dentro de la geocerca.",
                    caminoExitoYRechazo: "Éxito: Cierra la orden con PoD sellado. Rechazo: Falta firma.",
                    mutacionDatos: "Guarda PNG vectorial de firma y coordenadas en tabla de auditoría.",
                    partesAfectadas: "Pizarra de auditoría legal y estado del cliente.",
                    quienRecibeResultado: "Auditoría interna y cliente por WhatsApp/SMS.",
                    queFallaEnCorteRed: "Se conserva en almacenamiento local del móvil hasta sincronizar.",
                    recuperacionIdempotencia: "Una orden con PoD sellado queda inmutable permanentemente."
                }
            },
            {
                id: "sat_facturapi",
                name: "Facturación SAT / FacturAPI",
                layerIndex: 4,
                x: 1.2,
                y: 0.4,
                role: "Comprobante Fiscal",
                color: "#92400e",
                accentColor: "#fef3c7",
                polygonShape: "diamond",
                status: "IMPLEMENTADO",
                tags: ["CFDI 4.0", "PAC Timbrado", "XML + PDF"],
                plumbing: {
                    queAccionOcurre: "Timbrado fiscal de factura electrónica con desglose de impuestos IVA.",
                    deQueDatoDepende: "RFC verificado, uso de CFDI y pago completado.",
                    caminoExitoYRechazo: "Éxito: Genera UUID fiscal del SAT. Rechazo: Error de validación fiscal.",
                    mutacionDatos: "Guarda UUID fiscal, XML y PDF en la orden.",
                    partesAfectadas: "Libro de contabilidad fiscal.",
                    quienRecibeResultado: "Cliente por correo y portal SAT.",
                    queFallaEnCorteRed: "Si no hay internet, la orden queda en 'pendiente_factura' para timbrar después.",
                    recuperacionIdempotencia: "Clave de timbrado ligada al número de folio fiscal previene doble factura."
                }
            }
        ]
    }
];

// ═══════════════════════════════════════════════════════════════════════════
// 2. TUBERÍAS Y ARTERIAS DE CONEXIÓN ENTRE CAPAS
// ═══════════════════════════════════════════════════════════════════════════

export const INTER_LAYER_PIPES: InterLayerPipe[] = [
    // De Capa 1 (Raíces) a Capa 2 (Transporte)
    { id: "p1", fromNodeId: "terminal_pos", toNodeId: "next_api_routes", protocol: "HTTP_JSON", status: "ACTIVE", latencyMs: 4 },
    { id: "p2", fromNodeId: "catalogo_pwa", toNodeId: "next_api_routes", protocol: "HTTP_JSON", status: "ACTIVE", latencyMs: 12 },
    { id: "p3", fromNodeId: "tablet_patio", toNodeId: "radio_socket_mesh", protocol: "SOCKET_IO", status: "ACTIVE", latencyMs: 8 },
    { id: "p4", fromNodeId: "app_repartidor", toNodeId: "next_api_routes", protocol: "HTTP_JSON", status: "ACTIVE", latencyMs: 25 },

    // De Capa 2 (Transporte) a Capa 3 (Compuertas)
    { id: "p5", fromNodeId: "next_api_routes", toNodeId: "freemium_license_guard", protocol: "HTTP_JSON", status: "ACTIVE", latencyMs: 2 },
    { id: "p6", fromNodeId: "freemium_license_guard", toNodeId: "fsm_order_machine", protocol: "HTTP_JSON", status: "ACTIVE", latencyMs: 1 },
    { id: "p7", fromNodeId: "fsm_order_machine", toNodeId: "stock_mutex_gate", protocol: "HTTP_JSON", status: "ACTIVE", latencyMs: 3 },
    { id: "p8", fromNodeId: "radio_socket_mesh", toNodeId: "fsm_order_machine", protocol: "SOCKET_IO", status: "ACTIVE", latencyMs: 6 },

    // De Capa 3 (Compuertas) a Capa 4 (Persistencia)
    { id: "p9", fromNodeId: "stock_mutex_gate", toNodeId: "prisma_orm_bridge", protocol: "PRISMA", status: "ACTIVE", latencyMs: 2 },
    { id: "p10", fromNodeId: "prisma_orm_bridge", toNodeId: "sqlite_wal_engine", protocol: "SQLITE_WAL", status: "ACTIVE", latencyMs: 1 },
    { id: "p11", fromNodeId: "sqlite_wal_engine", toNodeId: "cloud_sync_replicator", protocol: "HTTP_JSON", status: "ACTIVE", latencyMs: 45 },

    // De Capa 4 (Persistencia) a Capa 5 (Salidas)
    { id: "p12", fromNodeId: "sqlite_wal_engine", toNodeId: "impresora_termica", protocol: "ESC_POS", status: "ACTIVE", latencyMs: 5 },
    { id: "p13", fromNodeId: "sqlite_wal_engine", toNodeId: "pod_digital_seal", protocol: "HTTP_JSON", status: "ACTIVE", latencyMs: 10 },
    { id: "p14", fromNodeId: "cloud_sync_replicator", toNodeId: "sat_facturapi", protocol: "HTTP_JSON", status: "ACTIVE", latencyMs: 180 }
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. FLUJOS DE SIMULACIÓN EN VIVO (ANIMADOS PASO A PASO)
// ═══════════════════════════════════════════════════════════════════════════

export const SOFTWARE_FLOWS: SoftwareFlowSimulation[] = [
    {
        id: "flujo_venta_caja",
        name: "Venta Mostrador en Caja (Local Directo)",
        description: "Transacción rápida en ventanilla con cobro, deducción atómica de inventario y expulsión de ticket.",
        color: "#38bdf8",
        steps: [
            { stepIndex: 1, nodeId: "terminal_pos", actionLabel: "1. Cajero escanea producto y presiona Cobrar F10", layerName: "Raíces", durationMs: 600 },
            { stepIndex: 2, nodeId: "next_api_routes", actionLabel: "2. POST /api/sales con validación de PIN de turno", layerName: "Arterias", durationMs: 400 },
            { stepIndex: 3, nodeId: "freemium_license_guard", actionLabel: "3. Verificación de límite de ventas y licencia activa", layerName: "Compuertas", durationMs: 300 },
            { stepIndex: 4, nodeId: "stock_mutex_gate", actionLabel: "4. Bloqueo atómico de stock disponible", layerName: "Compuertas", durationMs: 400 },
            { stepIndex: 5, nodeId: "sqlite_wal_engine", actionLabel: "5. Commit atómico en SQLite WAL local", layerName: "Corazón", durationMs: 500 },
            { stepIndex: 6, nodeId: "impresora_termica", actionLabel: "6. Impresión de ticket térmico ESC/POS con QR", layerName: "Salidas", durationMs: 700 }
        ]
    },
    {
        id: "flujo_delivery_geofence",
        name: "Pedido Móvil & Despacho Delivery (Geocerca)",
        description: "Cliente solicita desde catálogo PWA, se valida geocerca de cobertura y repartidor cierra con PoD.",
        color: "#10b981",
        steps: [
            { stepIndex: 1, nodeId: "catalogo_pwa", actionLabel: "1. Cliente confirma carrito dentro del polígono de entrega", layerName: "Raíces", durationMs: 600 },
            { stepIndex: 2, nodeId: "next_api_routes", actionLabel: "2. API valida coordenadas contra el polígono GeoJSON", layerName: "Arterias", durationMs: 450 },
            { stepIndex: 3, nodeId: "fsm_order_machine", actionLabel: "3. FSM pasa orden a 'PREPARANDO' para almacén", layerName: "Compuertas", durationMs: 400 },
            { stepIndex: 4, nodeId: "app_repartidor", actionLabel: "4. Repartidor toma orden 'OUT_FOR_DELIVERY' con GPS", layerName: "Raíces", durationMs: 700 },
            { stepIndex: 5, nodeId: "pod_digital_seal", actionLabel: "5. Captura de firma digital y foto de fachada (PoD)", layerName: "Salidas", durationMs: 800 },
            { stepIndex: 6, nodeId: "sqlite_wal_engine", actionLabel: "6. Orden sellada como 'DELIVERED' en base de datos", layerName: "Corazón", durationMs: 500 }
        ]
    },
    {
        id: "flujo_offline_radio",
        name: "Operación de Patio & Radio LAN Offline",
        description: "Despacho de bultos pesados en patio mediante tablet y radio PTT sin necesidad de internet.",
        color: "#f59e0b",
        steps: [
            { stepIndex: 1, nodeId: "tablet_patio", actionLabel: "1. Despachador de patio abre orden por código QR", layerName: "Raíces", durationMs: 600 },
            { stepIndex: 2, nodeId: "radio_socket_mesh", actionLabel: "2. Notificación por voz VOX PTT en canal 146.520 MHz", layerName: "Arterias", durationMs: 500 },
            { stepIndex: 3, nodeId: "fsm_order_machine", actionLabel: "3. Transición de orden a 'isLoaded: true'", layerName: "Compuertas", durationMs: 400 },
            { stepIndex: 4, nodeId: "sqlite_wal_engine", actionLabel: "4. Registro en SQLite local sin depender de nube", layerName: "Corazón", durationMs: 450 },
            { stepIndex: 5, nodeId: "cloud_sync_replicator", actionLabel: "5. Cola Outbox programada para reconexión futura", layerName: "Corazón", durationMs: 600 }
        ]
    }
];
