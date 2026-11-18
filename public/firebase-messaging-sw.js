/* eslint-disable */
/**
 * Service Worker dedicado a Firebase Cloud Messaging (FCM) para alertas tempranas
 * en dispositivos Android (PWA / Chrome Android) y escritorio aun con la app cerrada.
 */

let firebaseSwInitialized = false;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function buildNotificationFromPayload(payload) {
  const notif = (payload && payload.notification) || {};
  const data = (payload && payload.data) || {};

  const severity = data.severity || 'warning';
  const category = data.category || 'EARLY_WARNING';
  const title = notif.title || data.title || 'BUNKKER — Alerta Temprana';
  const body = notif.body || data.body || 'Se detectó un evento crítico que requiere atención.';
  const targetUrl =
    (data.url && String(data.url).startsWith('/'))
      ? String(data.url)
      : '/dashboard/audit';

  return {
    title,
    options: {
      body,
      icon: '/icon-192x192.png',
      badge: '/icon-maskable-192x192.png',
      tag: `bunkker-${category}-${data.alertId || Date.now()}`,
      renotify: true,
      requireInteraction: severity === 'critical',
      vibrate: [250, 120, 250, 120, 400],
      data: {
        url: targetUrl,
        category,
        severity,
        alertId: data.alertId || '',
      },
      actions: [
        { action: 'open_alert', title: 'Abrir Panel' },
        { action: 'dismiss_alert', title: 'Descartar' },
      ],
    },
  };
}

try {
  const params = new URL(self.location.href).searchParams;
  const firebaseConfig = {
    apiKey: params.get('apiKey') || '',
    authDomain: params.get('authDomain') || '',
    projectId: params.get('projectId') || '',
    storageBucket: params.get('storageBucket') || '',
    messagingSenderId: params.get('messagingSenderId') || '',
    appId: params.get('appId') || '',
  };

  if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
    importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js');

    if (typeof firebase !== 'undefined') {
      if (!firebase.apps || firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }
      const messaging = firebase.messaging();
      firebaseSwInitialized = true;

      messaging.onBackgroundMessage((payload) => {
        const { title, options } = buildNotificationFromPayload(payload);
        return self.registration.showNotification(title, options);
      });
    }
  }
} catch (err) {
  console.warn('[FCM SW] Modo fallback nativo push activo:', err);
}

// Fallback nativo Web Push si el SDK compat no pudo inicializarse (offline o LAN sin CDN)
self.addEventListener('push', (event) => {
  if (firebaseSwInitialized) return;
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      notification: {
        title: 'BUNKKER — Alerta Temprana',
        body: event.data ? event.data.text() : 'Evento crítico del sistema.',
      },
    };
  }
  const { title, options } = buildNotificationFromPayload(payload);
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss_alert') return;

  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.url) ||
    '/dashboard/audit';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            if ('navigate' in client && typeof client.navigate === 'function') {
              client.navigate(targetUrl).catch(() => {});
            }
            if ('focus' in client) {
              return client.focus();
            }
          }
        } catch {}
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
