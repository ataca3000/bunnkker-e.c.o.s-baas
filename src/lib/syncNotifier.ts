// Helper global para sincronizacion instantanea en tiempo real (0ms Multi-Tab / Multi-Rol)

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
