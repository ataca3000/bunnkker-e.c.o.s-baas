'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Loader2,
  Send,
  ShieldAlert,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/toast';
import {
  ALL_EARLY_WARNING_CATEGORIES,
  EARLY_WARNING_CATEGORIES,
  detectClientPlatform,
  type EarlyWarningAlertRecord,
  type EarlyWarningCategory,
  type PublicFcmDeviceView,
} from '@/lib/fcmPushTypes';

interface PushStatusSummary {
  hasFirebaseWebConfig: boolean;
  hasAdminMessagingCredentials: boolean;
  vapidConfigured: boolean;
  activeDeviceCount: number;
  totalDeviceCount: number;
}

interface AndroidPushManagerProps {
  variant?: 'toolbar' | 'panel';
}

const LOCAL_FCM_TOKEN_KEY = 'bunkker_android_fcm_token';
const LOCAL_FCM_DEVICE_ID_KEY = 'bunkker_android_fcm_device_id';

function buildFcmSwUrl(): string {
  // Se leen claves públicas ya provisionadas en firebasePublicConfig para inicializar SW compat
  if (typeof window === 'undefined') return '/firebase-messaging-sw.js';
  return '/firebase-messaging-sw.js';
}

async function getOrRegisterFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  const { firebasePublicConfig } = await import('@/lib/firebase');
  const params = new URLSearchParams({
    apiKey: firebasePublicConfig.apiKey || '',
    authDomain: firebasePublicConfig.authDomain || '',
    projectId: firebasePublicConfig.projectId || '',
    storageBucket: firebasePublicConfig.storageBucket || '',
    messagingSenderId: firebasePublicConfig.messagingSenderId || '',
    appId: firebasePublicConfig.appId || '',
  });
  const swScriptUrl = `${buildFcmSwUrl()}?${params.toString()}`;
  const registration = await navigator.serviceWorker.register(swScriptUrl, { scope: '/' });
  await navigator.serviceWorker.ready.catch(() => registration);
  return registration;
}

async function showSystemNotificationViaSw(payload: {
  id: string;
  title: string;
  body: string;
  url: string;
  category: string;
  severity: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    if ('serviceWorker' in navigator) {
      const reg =
        (await navigator.serviceWorker.getRegistration('/')) ||
        (await navigator.serviceWorker.ready.catch(() => undefined));
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(payload.title, {
          body: payload.body,
          icon: '/icon-192x192.png',
          badge: '/icon-maskable-192x192.png',
          tag: `bunkker-${payload.category}-${payload.id}`,
          requireInteraction: payload.severity === 'critical',
          data: {
            url: payload.url || '/dashboard/audit',
            category: payload.category,
            severity: payload.severity,
            alertId: payload.id,
          },
        });
        return true;
      }
    }
    new Notification(payload.title, {
      body: payload.body,
      icon: '/icon-192x192.png',
      tag: `bunkker-${payload.category}-${payload.id}`,
    });
    return true;
  } catch {
    return false;
  }
}

export default function AndroidPushManager({ variant = 'panel' }: AndroidPushManagerProps) {
  const { profile } = useAuth();
  const isAuthorizedAdmin = profile?.role === 'superadmin' || profile?.role === 'admin';

  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [pushSupported, setPushSupported] = useState<boolean>(true);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  const [devices, setDevices] = useState<PublicFcmDeviceView[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<EarlyWarningAlertRecord[]>([]);
  const [status, setStatus] = useState<PushStatusSummary | null>(null);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [deviceLabel, setDeviceLabel] = useState<string>('Android Admin');
  const [selectedCategories, setSelectedCategories] = useState<EarlyWarningCategory[]>([
    ...ALL_EARLY_WARNING_CATEGORIES,
  ]);

  const [testCategory, setTestCategory] = useState<EarlyWarningCategory>('TEST_ALERT');
  const [testTitle, setTestTitle] = useState<string>('🚨 Alerta Temprana Android — Verificación');
  const [testBody, setTestBody] = useState<string>(
    'Prueba de notificación crítica fuera de la app para administración BUNKKER.'
  );

  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const roleRef = useRef<string | undefined>(profile?.role);

  useEffect(() => {
    roleRef.current = profile?.role;
  }, [profile?.role]);

  const fetchRegistryStatus = useCallback(async () => {
    if (!isAuthorizedAdmin) return;
    setIsLoadingData(true);
    try {
      const res = await fetch('/api/push/register', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (json?.success && json.data) {
        setDevices(Array.isArray(json.data.devices) ? json.data.devices : []);
        setRecentAlerts(Array.isArray(json.data.recentAlerts) ? json.data.recentAlerts : []);
        setStatus(json.data.status || null);
      }
    } catch {
      // Silencio en desconexión temporal
    } finally {
      setIsLoadingData(false);
    }
  }, [isAuthorizedAdmin]);

  useEffect(() => {
    if (!isAuthorizedAdmin || typeof window === 'undefined') return;

    const supported =
      'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setPushSupported(supported);
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    try {
      const storedId = window.localStorage.getItem(LOCAL_FCM_DEVICE_ID_KEY) || '';
      if (storedId) setCurrentDeviceId(storedId);
      const isStandalone =
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      const detected = detectClientPlatform(navigator.userAgent, isStandalone);
      setDeviceLabel(
        detected === 'android-pwa'
          ? 'Android App (PWA)'
          : detected === 'android-web'
          ? 'Android Chrome'
          : 'Terminal Admin'
      );
    } catch {}

    void fetchRegistryStatus();
  }, [isAuthorizedAdmin, fetchRegistryStatus]);

  // Escucha foreground FCM + fallback SSE EARLY_WARNING_PUSH sin duplicar alertas
  useEffect(() => {
    if (!isAuthorizedAdmin || typeof window === 'undefined') return;

    let unsubscribeOnMessage: (() => void) | null = null;
    let cancelled = false;

    const handleIncomingAlert = async (alertPayload: {
      id: string;
      category: string;
      severity: string;
      title: string;
      body: string;
      url: string;
    }) => {
      if (roleRef.current !== 'superadmin' && roleRef.current !== 'admin') return;
      if (!alertPayload.id || seenAlertIdsRef.current.has(alertPayload.id)) return;
      if (seenAlertIdsRef.current.size >= 200) {
        const oldest = seenAlertIdsRef.current.values().next().value;
        if (oldest) seenAlertIdsRef.current.delete(oldest);
      }
      seenAlertIdsRef.current.add(alertPayload.id);

      if (alertPayload.severity === 'critical') {
        toast.error(alertPayload.body, alertPayload.title, 8000);
      } else {
        toast.warning(alertPayload.body, alertPayload.title, 6500);
      }

      if (document.visibilityState !== 'visible' || Notification.permission === 'granted') {
        await showSystemNotificationViaSw(alertPayload);
      }

      if (variant === 'panel') {
        void fetchRegistryStatus();
      }
    };

    const bindForegroundFcm = async () => {
      try {
        const [{ isSupported, getMessaging, onMessage }, { app, hasRealCredentials }] =
          await Promise.all([import('firebase/messaging'), import('@/lib/firebase')]);

        if (!hasRealCredentials || !(await isSupported()) || cancelled) return;
        const messaging = getMessaging(app);
        unsubscribeOnMessage = onMessage(messaging, (payload) => {
          const data = payload.data || {};
          const notif = payload.notification || {};
          void handleIncomingAlert({
            id: data.alertId || `fcm-${Date.now()}`,
            category: data.category || 'SECURITY_ALERT',
            severity: data.severity || 'critical',
            title: notif.title || data.title || 'BUNKKER — Alerta Temprana',
            body: notif.body || data.body || 'Evento crítico detectado.',
            url: data.url || '/dashboard/audit',
          });
        });
      } catch {
        // Fallback SSE permanece activo
      }
    };

    if (variant === 'toolbar') {
      void bindForegroundFcm();
    }

    const handleSyncEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<Record<string, unknown>>).detail;
      if (!detail || detail.action !== 'EARLY_WARNING_PUSH') return;
      const alertObj =
        (detail.payload as { alert?: EarlyWarningAlertRecord } | undefined)?.alert ||
        (detail.alert as EarlyWarningAlertRecord | undefined);
      if (!alertObj) return;

      void handleIncomingAlert({
        id: alertObj.id,
        category: alertObj.category,
        severity: alertObj.severity,
        title: alertObj.title,
        body: alertObj.body,
        url: alertObj.url,
      });
    };

    window.addEventListener('bunkker_sync_event', handleSyncEvent);

    return () => {
      cancelled = true;
      if (unsubscribeOnMessage) unsubscribeOnMessage();
      window.removeEventListener('bunkker_sync_event', handleSyncEvent);
    };
  }, [isAuthorizedAdmin, variant, fetchRegistryStatus]);

  if (!isAuthorizedAdmin) {
    return null;
  }

  const handleActivatePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Este navegador no soporta notificaciones push.', 'No compatible');
      return;
    }

    setIsRegistering(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.warning(
          'Permiso denegado en el navegador. Actívalo en Ajustes del sitio para recibir alertas en Android.',
          'Permiso Requerido'
        );
        return;
      }

      const [{ isSupported, getMessaging, getToken }, { app, hasRealCredentials }] =
        await Promise.all([import('firebase/messaging'), import('@/lib/firebase')]);

      if (!hasRealCredentials || !(await isSupported())) {
        toast.warning(
          'Push nativo local activado. Para FCM en segundo plano con app cerrada se requiere navegador compatible.',
          'Modo Local Activo'
        );
        return;
      }

      const swRegistration = await getOrRegisterFcmServiceWorker();
      if (!swRegistration) {
        throw new Error('No se pudo registrar el Service Worker de FCM.');
      }

      const messaging = getMessaging(app);
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();

      let fcmToken = '';
      try {
        fcmToken = await getToken(messaging, {
          ...(vapidKey ? { vapidKey } : {}),
          serviceWorkerRegistration: swRegistration,
        });
      } catch (tokenErr) {
        console.warn('[FCM TOKEN WARN]:', tokenErr);
        throw new Error(
          vapidKey
            ? 'No se pudo obtener token FCM. Verifica conexión y permisos en Android.'
            : 'Falta NEXT_PUBLIC_FIREBASE_VAPID_KEY en variables de entorno para emitir token Web Push FCM.'
        );
      }

      if (!fcmToken) {
        throw new Error('Firebase Messaging no devolvió un token válido.');
      }

      const isStandalone =
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

      const res = await fetch('/api/push/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: fcmToken,
          deviceId: currentDeviceId || undefined,
          userName: profile?.displayName || 'Administrador',
          deviceLabel,
          userAgent: navigator.userAgent,
          isStandalone,
          enabled: true,
          categories: selectedCategories,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Error registrando dispositivo en el servidor.');
      }

      const savedDevice = json.data as PublicFcmDeviceView;
      setCurrentDeviceId(savedDevice.deviceId);
      try {
        window.localStorage.setItem(LOCAL_FCM_TOKEN_KEY, fcmToken);
        window.localStorage.setItem(LOCAL_FCM_DEVICE_ID_KEY, savedDevice.deviceId);
      } catch {}

      toast.success(
        `Dispositivo "${savedDevice.deviceLabel}" vinculado para alertas tempranas.`,
        'Push Android Activo'
      );
      await fetchRegistryStatus();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Error activando alertas push.',
        'Error Push FCM'
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const handleToggleDeviceEnabled = async (device: PublicFcmDeviceView) => {
    try {
      const res = await fetch('/api/push/register', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.deviceId,
          enabled: !device.enabled,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setDevices((prev) => prev.map((d) => (d.deviceId === device.deviceId ? json.data : d)));
        toast.info(
          !device.enabled ? 'Alertas activadas en dispositivo.' : 'Dispositivo silenciado temporalmente.'
        );
      }
    } catch {}
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const res = await fetch(`/api/push/register?deviceId=${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
        if (deviceId === currentDeviceId) {
          setCurrentDeviceId('');
          try {
            window.localStorage.removeItem(LOCAL_FCM_DEVICE_ID_KEY);
            window.localStorage.removeItem(LOCAL_FCM_TOKEN_KEY);
          } catch {}
        }
        toast.info('Dispositivo desvinculado de alertas push.');
      }
    } catch {}
  };

  const handleToggleCategory = (cat: EarlyWarningCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSendTestAlert = async () => {
    setIsSendingTest(true);
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: testCategory,
          severity: EARLY_WARNING_CATEGORIES[testCategory].defaultSeverity,
          title: testTitle,
          body: testBody,
          url: EARLY_WARNING_CATEGORIES[testCategory].defaultUrl,
          actorName: profile?.displayName || 'Administrador',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudo enviar la alerta.');
      }

      const alert = json.data as EarlyWarningAlertRecord;
      if (alert.deliveryMode === 'fcm_and_realtime') {
        toast.success(
          `Push FCM entregado a ${alert.sentCount} dispositivo(s) Android.`,
          'Alerta Enviada'
        );
      } else {
        await showSystemNotificationViaSw({
          id: alert.id,
          title: alert.title,
          body: alert.body,
          url: alert.url,
          category: alert.category,
          severity: alert.severity,
        });
        toast.info(
          'Alerta emitida por canal PWA local y registrada en historial de emergencia.',
          'Alerta Emitida'
        );
      }
      await fetchRegistryStatus();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error enviando alerta.', 'Error');
    } finally {
      setIsSendingTest(false);
    }
  };

  if (variant === 'toolbar') {
    const activeLinked = permission === 'granted' && (status?.activeDeviceCount || 0) > 0;
    return (
      <Link
        href="/dashboard/setup?step=8"
        title={
          activeLinked
            ? 'Alertas Push Android activas — Configurar dispositivos'
            : 'Configurar Alertas Push Tempranas en Android (FCM)'
        }
        className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 ${
          activeLinked
            ? 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300 hover:bg-cyan-500/25'
            : permission === 'denied'
            ? 'bg-rose-500/15 border-rose-500/35 text-rose-300 hover:bg-rose-500/25'
            : 'bg-amber-500/15 border-amber-500/35 text-amber-300 hover:bg-amber-500/25'
        }`}
      >
        <Smartphone size={14} className="shrink-0" />
        <span className="hidden lg:inline whitespace-nowrap">
          {activeLinked ? 'Push Android' : 'Activar Push'}
        </span>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2.5 text-cyan-400 font-bold text-lg sm:text-xl tracking-wide">
            <ShieldAlert size={22} /> Alertas Tempranas Push Android (FCM)
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Recibe avisos críticos (stock en cero, botón de pánico, mermas, seguridad y fallos) directamente en la barra de Android incluso con la app cerrada.
          </p>
        </div>

        <button
          type="button"
          onClick={handleActivatePush}
          disabled={isRegistering || !pushSupported}
          className="px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 shrink-0 cursor-pointer"
        >
          {isRegistering ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
          {isRegistering
            ? 'Vinculando...'
            : currentDeviceId
            ? 'Actualizar Dispositivo'
            : 'Vincular Este Android'}
        </button>
      </div>

      {/* Estado de permisos y requisitos del entorno */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
            Permiso del Navegador
          </span>
          <div className="mt-1.5 flex items-center gap-2 text-sm font-bold">
            {permission === 'granted' ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span className="text-emerald-300">Autorizado</span>
              </>
            ) : permission === 'denied' ? (
              <>
                <BellOff size={16} className="text-rose-400" />
                <span className="text-rose-300">Bloqueado en Navegador</span>
              </>
            ) : (
              <>
                <Bell size={16} className="text-amber-400" />
                <span className="text-amber-300">Pendiente de Activar</span>
              </>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
            Dispositivos Admin Activos
          </span>
          <div className="mt-1.5 flex items-center gap-2 text-sm font-bold text-white">
            <Smartphone size={16} className="text-cyan-400" />
            <span>
              {status?.activeDeviceCount ?? 0} activos de {status?.totalDeviceCount ?? devices.length}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
            Canal Firebase Cloud Messaging
          </span>
          <div className="mt-1.5 flex items-center gap-2 text-sm font-bold">
            {status?.hasAdminMessagingCredentials && status?.vapidConfigured ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span className="text-emerald-300">FCM Nube Completo</span>
              </>
            ) : (
              <>
                <AlertTriangle size={16} className="text-amber-400" />
                <span className="text-amber-300">PWA / Push Parcial</span>
              </>
            )}
          </div>
        </div>
      </div>

      {(!status?.vapidConfigured || !status?.hasAdminMessagingCredentials) && (
        <div className="p-4 rounded-xl bg-amber-950/25 border border-amber-500/30 text-amber-200 text-xs leading-relaxed">
          <p className="font-bold text-amber-300 mb-1">
            Nota para entrega en segundo plano en Android cuando la app está completamente cerrada:
          </p>
          <p>
            Instala la PWA desde Chrome Android (&quot;Agregar a la pantalla principal&quot;) y configura en el servidor{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300">NEXT_PUBLIC_FIREBASE_VAPID_KEY</code> y las credenciales de{' '}
            <code className="px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300">FIREBASE_SERVICE_ACCOUNT_KEY</code>. Mientras tanto, el Service Worker y el canal en tiempo real siguen mostrando alertas nativas en sesiones activas.
          </p>
        </div>
      )}

      {/* Preferencias de este dispositivo */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Nombre identificador de este teléfono / terminal
            </label>
            <input
              type="text"
              value={deviceLabel}
              onChange={(e) => setDeviceLabel(e.target.value)}
              placeholder="Ej. Celular Gerencia Android"
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500"
            />
          </div>
          <p className="text-xs text-slate-400">
            Selecciona qué alertas críticas desea recibir este dispositivo antes de vincular o actualizar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {ALL_EARLY_WARNING_CATEGORIES.map((catId) => {
            const meta = EARLY_WARNING_CATEGORIES[catId];
            const active = selectedCategories.includes(catId);
            return (
              <button
                key={catId}
                type="button"
                onClick={() => handleToggleCategory(catId)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  active
                    ? 'bg-cyan-950/35 border-cyan-500/40 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{meta.label}</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      active ? 'bg-cyan-400' : 'bg-slate-700'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{meta.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Enviar alerta de prueba */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Send size={16} className="text-cyan-400" /> Enviar Alerta Temprana de Prueba
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Categoría
            </label>
            <select
              value={testCategory}
              onChange={(e) => setTestCategory(e.target.value as EarlyWarningCategory)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-cyan-500"
            >
              {ALL_EARLY_WARNING_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {EARLY_WARNING_CATEGORIES[cat].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Título
            </label>
            <input
              type="text"
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Mensaje
            </label>
            <input
              type="text"
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              className="w-full bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSendTestAlert}
            disabled={isSendingTest}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSendingTest ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Disparar Alerta Crítica
          </button>
        </div>
      </div>

      {/* Dispositivos vinculados */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Smartphone size={16} className="text-cyan-400" /> Dispositivos Admin Vinculados
          </h4>
          {isLoadingData && <Loader2 size={15} className="animate-spin text-slate-400" />}
        </div>

        {devices.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">
            Aún no hay dispositivos Android o navegadores registrados para este negocio. Pulsa &quot;Vincular Este Android&quot; desde tu teléfono administrador.
          </p>
        ) : (
          <div className="space-y-2">
            {devices.map((dev) => (
              <div
                key={dev.deviceId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white truncate">{dev.deviceLabel}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                      {dev.platform}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {dev.role}
                    </span>
                    {dev.deviceId === currentDeviceId && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        Este dispositivo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {dev.userName} · Token {dev.tokenMasked} · {dev.categories.length} categorías activas
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleDeviceEnabled(dev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      dev.enabled
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {dev.enabled ? 'Activo' : 'Silenciado'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDevice(dev.deviceId)}
                    title="Desvincular dispositivo"
                    aria-label={`Desvincular ${dev.deviceLabel}`}
                    className="p-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial reciente de alertas tempranas */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
        <h4 className="text-sm font-bold text-white">Últimas Alertas Tempranas Emitidas</h4>
        {recentAlerts.length === 0 ? (
          <p className="text-xs text-slate-400">Sin alertas críticas registradas aún.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {recentAlerts.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="text-xs font-bold text-white">{item.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.body}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300 block">
                    {item.deliveryMode === 'fcm_and_realtime'
                      ? `FCM (${item.sentCount} env.)`
                      : item.deliveryMode === 'realtime_sw_only'
                      ? 'PWA Local / SSE'
                      : 'Solo Registro'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {new Date(item.createdAt).toLocaleString('es-MX')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
