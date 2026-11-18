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

export interface FcmIntegrationCheckResult {
  ok: boolean;
  serviceWorkerSupported: boolean;
  fcmSwActive: boolean;
  fcmSwState: string | null;
  fcmSwScriptUrl: string | null;
  notificationPermission: NotificationPermission | 'unsupported';
  fcmSupported: boolean;
  hasFirebaseWebConfig: boolean;
  token: string | null;
  tokenSource: 'firebase_getToken' | 'localStorage' | 'none';
  reason?: string;
}

/**
 * Función de prueba / diagnóstico para verificar si el Service Worker de
 * Firebase Cloud Messaging (`firebase-messaging-sw.js`) está activo en el
 * dispositivo actual y registrar en consola el token FCM del dispositivo.
 */
export async function verifyFcmServiceWorkerIntegration(options?: {
  registerIfMissing?: boolean;
}): Promise<FcmIntegrationCheckResult> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    const serverResult: FcmIntegrationCheckResult = {
      ok: false,
      serviceWorkerSupported: false,
      fcmSwActive: false,
      fcmSwState: null,
      fcmSwScriptUrl: null,
      notificationPermission: 'unsupported',
      fcmSupported: false,
      hasFirebaseWebConfig: false,
      token: null,
      tokenSource: 'none',
      reason: 'Esta verificación debe ejecutarse en el navegador del dispositivo.',
    };
    console.warn('[FCM Verify] Entorno sin navegador:', serverResult.reason);
    return serverResult;
  }

  const serviceWorkerSupported = 'serviceWorker' in navigator;
  const notificationPermission: NotificationPermission | 'unsupported' =
    'Notification' in window ? Notification.permission : 'unsupported';

  if (!serviceWorkerSupported) {
    const unsupportedSw: FcmIntegrationCheckResult = {
      ok: false,
      serviceWorkerSupported: false,
      fcmSwActive: false,
      fcmSwState: null,
      fcmSwScriptUrl: null,
      notificationPermission,
      fcmSupported: false,
      hasFirebaseWebConfig: false,
      token: null,
      tokenSource: 'none',
      reason: 'Service Worker API no soportada en este navegador.',
    };
    console.warn('[FCM Verify] Service Worker no soportado.', unsupportedSw);
    return unsupportedSw;
  }

  const findFcmRegistration = async (): Promise<ServiceWorkerRegistration | undefined> => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.find((reg) => {
      const urls = [reg.active?.scriptURL, reg.waiting?.scriptURL, reg.installing?.scriptURL].filter(
        Boolean
      ) as string[];
      return urls.some((u) => u.includes('firebase-messaging-sw.js'));
    });
  };

  let fcmRegistration = await findFcmRegistration();

  const { app, firebasePublicConfig, hasRealCredentials } = await import('@/lib/firebase');

  if (!fcmRegistration && options?.registerIfMissing && hasRealCredentials) {
    try {
      const params = new URLSearchParams({
        apiKey: firebasePublicConfig.apiKey || '',
        authDomain: firebasePublicConfig.authDomain || '',
        projectId: firebasePublicConfig.projectId || '',
        storageBucket: firebasePublicConfig.storageBucket || '',
        messagingSenderId: firebasePublicConfig.messagingSenderId || '',
        appId: firebasePublicConfig.appId || '',
      });
      fcmRegistration = await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?${params.toString()}`,
        { scope: '/' }
      );
    } catch (regErr) {
      console.warn('[FCM Verify] No se pudo registrar firebase-messaging-sw.js:', regErr);
    }
  }

  const activeWorker = fcmRegistration?.active || null;
  const candidateWorker = activeWorker || fcmRegistration?.waiting || fcmRegistration?.installing || null;
  const fcmSwActive = Boolean(activeWorker && activeWorker.state === 'activated');
  const fcmSwState = candidateWorker?.state || null;
  const fcmSwScriptUrl = candidateWorker?.scriptURL || null;

  let fcmSupported = false;
  let token: string | null = null;
  let tokenSource: FcmIntegrationCheckResult['tokenSource'] = 'none';
  let reason: string | undefined;

  try {
    const { isSupported, getMessaging, getToken } = await import('firebase/messaging');
    fcmSupported = await isSupported();

    if (fcmSwActive && fcmSupported && hasRealCredentials && notificationPermission === 'granted') {
      const messaging = getMessaging(app);
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
      const fetchedToken = await getToken(messaging, {
        ...(vapidKey ? { vapidKey } : {}),
        serviceWorkerRegistration: fcmRegistration,
      });

      if (fetchedToken) {
        token = fetchedToken;
        tokenSource = 'firebase_getToken';
      }
    }
  } catch (err) {
    reason = err instanceof Error ? err.message : 'Error consultando token FCM en firebase/messaging.';
  }

  if (!token) {
    try {
      const cachedToken = window.localStorage.getItem('bunkker_android_fcm_token');
      if (cachedToken && cachedToken.trim()) {
        token = cachedToken.trim();
        tokenSource = 'localStorage';
      }
    } catch {}
  }

  if (!fcmSwActive && !reason) {
    reason = fcmRegistration
      ? `Service Worker FCM encontrado en estado "${fcmSwState}", aún no activo.`
      : 'Service Worker firebase-messaging-sw.js no está registrado todavía.';
  } else if (notificationPermission !== 'granted' && !reason) {
    reason = `Permiso de notificaciones en estado "${notificationPermission}".`;
  } else if (!token && !reason) {
    reason = 'Service Worker FCM activo, pero no se obtuvo token (verifica NEXT_PUBLIC_FIREBASE_VAPID_KEY).';
  }

  const result: FcmIntegrationCheckResult = {
    ok: fcmSwActive && Boolean(token),
    serviceWorkerSupported,
    fcmSwActive,
    fcmSwState,
    fcmSwScriptUrl,
    notificationPermission,
    fcmSupported,
    hasFirebaseWebConfig: hasRealCredentials,
    token,
    tokenSource,
    ...(reason ? { reason } : {}),
  };

  console.info('[FCM Verify] Estado Service Worker FCM:', {
    activo: result.fcmSwActive,
    estado: result.fcmSwState,
    scriptURL: result.fcmSwScriptUrl,
    permisoNotificaciones: result.notificationPermission,
    soporteFCM: result.fcmSupported,
    origenToken: result.tokenSource,
  });

  if (result.token) {
    console.log('[FCM Verify] Token de registro del dispositivo actual:', result.token);
  } else {
    console.warn('[FCM Verify] Sin token de registro FCM:', result.reason);
  }

  return result;
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__verifyBunkkerFcm = verifyFcmServiceWorkerIntegration;
}

