// Helper global para sincronizacion instantanea en tiempo real (0ms Multi-Tab / Multi-Rol)
import { useEffect } from 'react';

let tabChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  tabChannel = new BroadcastChannel('bunkker_tab_sync');
}

export function broadcastSync() {
  if (typeof window === 'undefined') return;

  // 1. Multi-Tab local (BroadcastChannel)
  try {
    if (!tabChannel && typeof BroadcastChannel !== 'undefined') {
      tabChannel = new BroadcastChannel('bunkker_tab_sync');
    }
    tabChannel?.postMessage({ type: 'SYNC_REFETCH' });
  } catch (err) {
    console.warn('BroadcastChannel sync error:', err);
  }

  // 2. Multi-Dispositivo LAN (Socket.IO)
  try {
    const socket = (window as any).__inventorySocket;
    if (socket && socket.connected) {
      socket.emit('inventory_updated');
    }
  } catch (err) {
    console.warn('Socket sync error:', err);
  }

  // 3. Evento DOM Local
  try {
    window.dispatchEvent(new CustomEvent('bunkker_sync_event'));
  } catch (err) {}
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
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('bunkker_tab_sync');
        channel.onmessage = (event) => {
          if (event.data?.type === 'SYNC_REFETCH') {
            onSync();
          }
        };
      }
    } catch (err) {
      console.warn('[SyncListener] BroadcastChannel init error:', err);
    }

    const handleCustomEvent = () => {
      onSync();
    };

    window.addEventListener('bunkker_sync_event', handleCustomEvent);

    return () => {
      try {
        channel?.close();
      } catch {}
      window.removeEventListener('bunkker_sync_event', handleCustomEvent);
    };
  }, [onSync]);
}
