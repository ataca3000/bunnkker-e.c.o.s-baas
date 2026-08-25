/**
 * UNIFIED SYNC ENGINE (WAL - Write-Ahead Logging & Event Driven Dispatcher)
 * Fusión simbiótica entre el motor P2P local (WebSockets) y el motor Cloud (AES-256 Cloud Push).
 * Reemplaza el polling incondicional por despachos reactivos a eventos de red e inmutabilidad atómica.
 */

import { CloudSyncEngine } from './cloudSyncEngine';

export interface SyncPayload {
  txId: string;
  timestamp: number;
  type: string;
  data: any;
  retryCount?: number;
}

const QUEUE_KEY = 'bunkker_offline_queue';
const MAX_QUEUE_SIZE = 500;

class UnifiedSyncEngine {
  private cloudEngine: CloudSyncEngine | null = null;
  private isFlushing = false;
  private listenersAttached = false;

  constructor() {
    this.initCloudEngine();
    this.attachEventListeners();
  }

  private initCloudEngine() {
    if (typeof window !== 'undefined') {
      const machineId = localStorage.getItem('BUNKKER_MACHINE_ID') || 'node-local';
      const pairingSecret = localStorage.getItem('BUNKKER_PAIRING_SECRET') || 'ecos-default-secret';
      this.cloudEngine = new CloudSyncEngine(machineId, pairingSecret);
    }
  }

  /**
   * Adjunta escuchadores de eventos reactivos (Online/Offline/DOM Sync)
   */
  private attachEventListeners() {
    if (typeof window === 'undefined' || this.listenersAttached) return;

    // 1. Escuchar la reconexión de la red a nivel de navegador
    window.addEventListener('online', () => {
      console.log('⚡ [UnifiedSync] Conexión a Internet detectada. Procesando cola pendiente...');
      this.triggerFlush();
    });

    // 2. Escuchar eventos internos de sincronización
    window.addEventListener('bunkker_sync_event', () => {
      this.triggerFlush();
    });

    this.listenersAttached = true;
  }

  /**
   * Obtiene la cola actual de transacciones pendientes
   */
  public getQueue(): SyncPayload[] {
    if (typeof window === 'undefined') return [];
    try {
      const queueStr = localStorage.getItem(QUEUE_KEY) ?? localStorage.getItem('evo_offline_queue');
      if (!queueStr) return [];
      
      // Limpiar clave legacy si existe
      if (localStorage.getItem('evo_offline_queue')) {
        localStorage.removeItem('evo_offline_queue');
      }

      return JSON.parse(queueStr);
    } catch (e) {
      console.error('[UnifiedSync] Error leyendo la cola offline:', e);
      return [];
    }
  }

  /**
   * Guarda la cola transaccional de forma atómica
   */
  private saveQueue(queue: SyncPayload[]) {
    if (typeof window === 'undefined') return;
    try {
      if (queue.length === 0) {
        localStorage.removeItem(QUEUE_KEY);
      } else {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      }
    } catch (e) {
      console.error('[UnifiedSync] Error guardando la cola offline:', e);
    }
  }

  /**
   * Encola una nueva transacción de forma atómica e idempotente
   */
  public enqueue(payload: Omit<SyncPayload, 'txId' | 'timestamp'> & { txId?: string; timestamp?: number }) {
    if (typeof window === 'undefined') return;

    const fullPayload: SyncPayload = {
      txId: payload.txId || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
      timestamp: payload.timestamp || Date.now(),
      type: payload.type,
      data: payload.data,
      retryCount: 0
    };

    const queue = this.getQueue();

    // Evitar duplicados por txId
    if (queue.some((item) => item.txId === fullPayload.txId)) {
      console.warn(`[UnifiedSync] Transacción ${fullPayload.txId} ya existe en cola. Omitiendo.`);
      return;
    }

    if (queue.length >= MAX_QUEUE_SIZE) {
      console.warn(`[UnifiedSync] Límite de cola (${MAX_QUEUE_SIZE}) alcanzado. Descartando más antigua.`);
      queue.shift();
    }

    queue.push(fullPayload);
    this.saveQueue(queue);

    console.log(`📥 [UnifiedSync] Transacción encolada: ${fullPayload.type} (${fullPayload.txId})`);

    // Intentar despacho inmediato
    this.triggerFlush();
  }

  /**
   * Despacha la cola transaccional usando la mejor ruta disponible (P2P LAN -> Cloud)
   */
  public async triggerFlush(socketInstance?: WebSocket | null) {
    if (typeof window === 'undefined' || this.isFlushing) return;

    const queue = this.getQueue();
    if (queue.length === 0) return;

    this.isFlushing = true;
    console.log(`🔄 [UnifiedSync] Iniciando flush de ${queue.length} transacciones pendientes...`);

    const remainingQueue: SyncPayload[] = [];

    for (const item of queue) {
      let dispatched = false;

      // --- RUTA 1: WebSocket P2P LAN (PC Maestra) ---
      if (socketInstance && socketInstance.readyState === WebSocket.OPEN) {
        try {
          socketInstance.send(JSON.stringify(item));
          console.log(`✅ [UnifiedSync/P2P] Transacción enviada a Maestro: ${item.type} (${item.txId})`);
          dispatched = true;
        } catch (err) {
          console.warn(`⚠️ [UnifiedSync/P2P] Fallo al enviar a Maestro P2P:`, err);
        }
      }

      // --- RUTA 2: Cloud Sync Engine (AES-256 Push) ---
      if (!dispatched && navigator.onLine && this.cloudEngine) {
        try {
          const success = await this.cloudEngine.pushToCloud({
            txId: item.txId,
            type: item.type,
            data: item.data,
            timestamp: item.timestamp
          });
          if (success) {
            console.log(`☁️ [UnifiedSync/Cloud] Transacción enviada a la Nube: ${item.type} (${item.txId})`);
            dispatched = true;
          }
        } catch (err) {
          console.warn(`⚠️ [UnifiedSync/Cloud] Fallo al sincronizar con la nube:`, err);
        }
      }

      if (!dispatched) {
        item.retryCount = (item.retryCount || 0) + 1;
        remainingQueue.push(item);
      }
    }

    this.saveQueue(remainingQueue);
    this.isFlushing = false;

    if (remainingQueue.length === 0) {
      console.log('✨ [UnifiedSync] Cola transaccional 100% sincronizada.');
    } else {
      console.log(`⏳ [UnifiedSync] ${remainingQueue.length} transacciones retenidas para la próxima reconexión.`);
    }
  }
}

export const unifiedSync = new UnifiedSyncEngine();
