// Helper global para sincronizacion instantanea en tiempo real (0ms Multi-Tab / Multi-Dispositivo HTTPS & LAN)
import { useEffect, useRef } from 'react';
import type { SyncScope } from '@/lib/realtimeBus';

export type { SyncScope };

export interface SyncBroadcastPayload {
  action?: string;
  id?: string;
  scope?: SyncScope;
  txId?: string;
  sourceTabId?: string;
  sourceDeviceId?: string;
  skipServerPost?: boolean;
  fromRemote?: boolean;
  [key: string]: any;
}

const SOURCE_TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let tabChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    tabChannel = new BroadcastChannel('bunkker_tab_sync');
  } catch {
    tabChannel = null;
  }
}

export function getSourceTabId(): string {
  return SOURCE_TAB_ID;
}

export function inferSyncScope(action?: string, explicitScope?: SyncScope): SyncScope {
  if (explicitScope) return explicitScope;
  if (!action) return 'all';
  if (action.includes('AUDIT') || action.includes('SECURITY')) return 'audit';
  if (action.includes('CONFIG') || action.includes('SETTING')) return 'settings';
  if (action.includes('DEVICE') || action.includes('PAIRING')) return 'devices';
  if (action.includes('PRODUCT') || action.includes('STOCK') || action.includes('INVENTORY')) return 'products';
  if (action.includes('ORDER') || action.includes('QUEUE')) return 'orders';
  return 'all';
}

export function broadcastSync(payload?: SyncBroadcastPayload) {
  if (typeof window === 'undefined') return;

  const action = payload?.action || 'GLOBAL_SYNC';
  const scope = inferSyncScope(action, payload?.scope);
  const txId =
    payload?.txId ||
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const syncPayload: SyncBroadcastPayload = {
    ...(payload || {}),
    action,
    scope,
    txId,
    sourceTabId: payload?.sourceTabId || SOURCE_TAB_ID,
  };

  // 1. Multi-Tab local (BroadcastChannel — solo si NO proviene de otro canal para evitar eco)
  if (!payload?.fromRemote) {
    try {
      if (!tabChannel && typeof BroadcastChannel !== 'undefined') {
        tabChannel = new BroadcastChannel('bunkker_tab_sync');
      }
      tabChannel?.postMessage({ type: 'SYNC_REFETCH', payload: syncPayload });
    } catch (err) {
      console.warn('[SyncNotifier] BroadcastChannel sync error:', err);
    }

    // 2. Multi-Dispositivo LAN opcional (Socket.IO, solo si existe y está conectado)
    try {
      const socket = (window as any).__inventorySocket;
      if (socket && socket.connected) {
        socket.emit('sync_db_event', syncPayload);
      }
    } catch {
      // Silencioso: canal web SSE actúa como primario en HTTPS/Nube
    }

    // 3. Publicación opcional al bus SSE del mismo origen cuando la acción no provino de una ruta API que ya publicó
    if (!payload?.skipServerPost && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      const sourceDeviceId =
        typeof localStorage !== 'undefined' ? localStorage.getItem('bunkker_device_uuid') || undefined : undefined;
      fetch('/api/sync/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action,
          scope,
          id: payload?.id,
          txId,
          sourceDeviceId,
        }),
      }).catch(() => {});
    }
  }

  // 4. Evento DOM Local (para listeners de la misma pestaña)
  try {
    window.dispatchEvent(new CustomEvent('bunkker_sync_event', { detail: syncPayload }));
  } catch (err) {
    console.warn('[SyncNotifier] CustomEvent dispatch error:', err);
  }
}

/**
 * Hook para escuchar eventos de sincronización en tiempo real entre múltiples pantallas/pestañas/dispositivos.
 * Deduplica por txId por instancia de listener y soporta filtrado opcional por scope.
 */
export function useSyncListener(
  onSync: (detail?: SyncBroadcastPayload) => void,
  scopes?: SyncScope[]
) {
  const onSyncRef = useRef(onSync);
  const scopesKey = scopes ? scopes.join(',') : 'all';

  useEffect(() => {
    onSyncRef.current = onSync;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const seenTx = new Set<string>();
    const allowedScopes = scopesKey === 'all' ? null : new Set(scopesKey.split(','));

    const dispatchIfRelevant = (detail?: SyncBroadcastPayload) => {
      const txId = detail?.txId;
      if (txId) {
        if (seenTx.has(txId)) return;
        if (seenTx.size >= 300) {
          const oldest = seenTx.values().next().value;
          if (oldest) seenTx.delete(oldest);
        }
        seenTx.add(txId);
      }

      if (allowedScopes) {
        const eventScope = inferSyncScope(detail?.action, detail?.scope);
        if (eventScope !== 'all' && !allowedScopes.has(eventScope)) {
          return;
        }
      }

      onSyncRef.current(detail);
    };

    // 1. BroadcastChannel (otras pestañas del mismo navegador)
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('bunkker_tab_sync');
        channel.onmessage = (event) => {
          if (event.data?.type === 'SYNC_REFETCH') {
            const payload = event.data.payload as SyncBroadcastPayload | undefined;
            if (payload?.sourceTabId === SOURCE_TAB_ID) return;
            dispatchIfRelevant(payload);
          }
        };
      }
    } catch (err) {
      console.warn('[SyncListener] BroadcastChannel init error:', err);
    }

    // 2. Evento DOM local (misma pestaña o puente SSE -> CustomEvent)
    const handleCustomEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<SyncBroadcastPayload>).detail;
      dispatchIfRelevant(detail);
    };
    window.addEventListener('bunkker_sync_event', handleCustomEvent);

    return () => {
      try {
        channel?.close();
      } catch {}
      window.removeEventListener('bunkker_sync_event', handleCustomEvent);
    };
  }, [scopesKey]);
}
