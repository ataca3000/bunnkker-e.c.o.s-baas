// Helper global para sincronizacion instantanea en tiempo real (0ms Multi-Tab / Multi-Rol)
import { useEffect, useRef } from 'react';

let tabChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  tabChannel = new BroadcastChannel('bunkker_tab_sync');
}

export function broadcastSync(payload?: { action?: string; id?: string; [key: string]: any }) {
  if (typeof window === 'undefined') return;

  const syncPayload = payload || { action: 'GLOBAL_SYNC' };

  // 1. Multi-Tab local (BroadcastChannel)
  try {
    if (!tabChannel && typeof BroadcastChannel !== 'undefined') {
      tabChannel = new BroadcastChannel('bunkker_tab_sync');
    }
    tabChannel?.postMessage({ type: 'SYNC_REFETCH', payload: syncPayload });
  } catch (err) {
    console.warn('[SyncNotifier] BroadcastChannel sync error:', err);
  }

  // 2. Multi-Dispositivo LAN (Socket.IO)
  try {
    const socket = (window as any).__inventorySocket;
    if (socket && socket.connected) {
      socket.emit('sync_db_event', syncPayload);
      socket.emit('inventory_updated');
    }
  } catch (err) {
    console.warn('[SyncNotifier] Socket sync error:', err);
  }

  // 3. Evento DOM Local
  try {
    window.dispatchEvent(new CustomEvent('bunkker_sync_event', { detail: syncPayload }));
  } catch (err) {
    console.warn('[SyncNotifier] CustomEvent dispatch error:', err);
  }
}

/**
 * Hook para escuchar eventos de sincronización en tiempo real entre múltiples pantallas/pestañas:
 * - /dashboard/sales (Caja)
 * - /dashboard/inventory (Almacén / Order Picking)
 * - /dashboard/patio (Patio de Carga)
 * - /dashboard/pickup (Mostrador Pick Up)
 * - /carrito/checkout (Pedidos Web)
 */
export function useSyncListener(onSync: () => void) {
  const onSyncRef = useRef(onSync);

  useEffect(() => {
    onSyncRef.current = onSync;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. BroadcastChannel (Multitestaña en el mismo navegador)
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('bunkker_tab_sync');
        channel.onmessage = (event) => {
          if (event.data?.type === 'SYNC_REFETCH') {
            onSyncRef.current();
          }
        };
      }
    } catch (err) {
      console.warn('[SyncListener] BroadcastChannel init error:', err);
    }

    // 2. Evento DOM local (Misma pestaña / despacho inmediato)
    const handleCustomEvent = () => {
      onSyncRef.current();
    };
    window.addEventListener('bunkker_sync_event', handleCustomEvent);

    // 3. Socket.IO LAN (Multidispositivo en red Wi-Fi / LAN P2P)
    const handleSocketSync = () => {
      onSyncRef.current();
    };

    let socket = (window as any).__inventorySocket;
    if (socket) {
      socket.on('sync_db_event', handleSocketSync);
      socket.on('inventory_updated', handleSocketSync);
    }

    // Si el socket aún no está montado al primer render, vincularlo en cuanto se conecte
    let checkSocketTimer: NodeJS.Timeout | null = null;
    if (!socket) {
      checkSocketTimer = setInterval(() => {
        const s = (window as any).__inventorySocket;
        if (s) {
          socket = s;
          socket.on('sync_db_event', handleSocketSync);
          socket.on('inventory_updated', handleSocketSync);
          if (checkSocketTimer) {
            clearInterval(checkSocketTimer);
            checkSocketTimer = null;
          }
        }
      }, 1000);
    }

    return () => {
      if (checkSocketTimer) {
        clearInterval(checkSocketTimer);
      }
      try {
        channel?.close();
      } catch {}
      window.removeEventListener('bunkker_sync_event', handleCustomEvent);
      if (socket) {
        socket.off('sync_db_event', handleSocketSync);
        socket.off('inventory_updated', handleSocketSync);
      }
    };
  }, []);
}
