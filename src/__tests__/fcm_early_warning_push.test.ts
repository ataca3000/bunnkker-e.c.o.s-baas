import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { signRole } from '@/lib/apiAuth';
import { verifyFcmServiceWorkerIntegration } from '@/lib/syncNotifier';
import {
  buildFcmMulticastMessage,
  buildStableDeviceId,
  detectClientPlatform,
  dispatchCriticalAdminPush,
  isValidFcmToken,
  listAdminFcmDevicesSafe,
  maskFcmToken,
  normalizeSubscribedCategories,
  registerAdminFcmDevice,
  removeAdminFcmDevice,
  sanitizePushAlertInput,
  updateAdminFcmDevice,
} from '@/lib/fcmPush';
import {
  DELETE as deletePushRegister,
  GET as getPushRegister,
  PATCH as patchPushRegister,
  POST as postPushRegister,
} from '@/app/api/push/register/route';
import { POST as postPushSend } from '@/app/api/push/send/route';

function makeSignedRequest(
  url: string,
  options: {
    method?: string;
    role?: string;
    uid?: string;
    tenantId?: string;
    body?: unknown;
  } = {}
): NextRequest {
  const tenantId = options.tenantId || 'test-fcm-tenant';
  const uid = options.uid || 'user-admin-1';
  const headers: Record<string, string> = {
    'x-tenant-id': tenantId,
  };

  if (options.role) {
    const sig = signRole(options.role, uid, tenantId);
    headers.cookie = `msj-session=${uid}; msj-role=${options.role}; msj-role-sig=${sig}`;
  }

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  return new NextRequest(url, {
    method: options.method || 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

describe('Android FCM Early Warning Push System', () => {
  const sampleToken = 'dQw4w9WgXcQ:APA91bHun4MxP5egoKMwt2KZFBaFUH-1RYqxS0cR_android_sample_token_001';

  it('validates tokens, masks credentials, detects Android platforms, and builds Android high-priority payloads', () => {
    expect(isValidFcmToken(sampleToken)).toBe(true);
    expect(isValidFcmToken('short')).toBe(false);
    expect(isValidFcmToken('has spaces in token 1234567890')).toBe(false);

    expect(maskFcmToken(sampleToken)).toBe('dQw4w9Wg…en_001');
    expect(
      detectClientPlatform(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
        true
      )
    ).toBe('android-pwa');
    expect(
      detectClientPlatform(
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36',
        false
      )
    ).toBe('android-web');

    expect(normalizeSubscribedCategories(['STOCK_CRITICAL', 'INVALID_CAT'])).toEqual(['STOCK_CRITICAL']);
    const stableId = buildStableDeviceId(sampleToken);
    expect(stableId).toMatch(/^fcm_[0-9a-f]{8}_/);

    const clean = sanitizePushAlertInput({
      category: 'PANIC_ALERT',
      title: '  Emergencia en Ruta Norte  ',
      body: '  Repartidor solicitó ayuda urgente  ',
      url: '/dashboard/delivery',
      metadata: { driverId: 'drv-9', code: 911 },
    });
    expect(clean.severity).toBe('critical');
    expect(clean.title).toBe('Emergencia en Ruta Norte');
    expect(clean.metadata).toEqual({ driverId: 'drv-9', code: '911' });

    const multicast = buildFcmMulticastMessage([sampleToken], {
      id: 'ew_test_1',
      ...clean,
      createdAt: '2026-11-15T12:00:00.000Z',
    });
    expect(multicast.android?.priority).toBe('high');
    expect(multicast.android?.notification?.channelId).toBe('bunkker_critical_alerts');
    expect(multicast.webpush?.headers?.Urgency).toBe('high');
    expect(multicast.webpush?.notification?.requireInteraction).toBe(true);
    expect(multicast.webpush?.fcmOptions?.link).toBe('/dashboard/delivery');
  });

  it('registers, lists safely (without leaking raw tokens), updates, dispatches, and removes admin devices', async () => {
    const tenantId = `tenant_unit_${Date.now()}`;

    await expect(
      registerAdminFcmDevice({
        tenantId,
        userId: 'cashier-1',
        role: 'sales',
        token: sampleToken,
      })
    ).rejects.toThrow();

    const registered = await registerAdminFcmDevice({
      tenantId,
      userId: 'admin-1',
      userName: 'Supervisor Android',
      role: 'superadmin',
      token: sampleToken,
      deviceLabel: 'Pixel Admin',
      isStandalone: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      categories: ['STOCK_CRITICAL', 'PANIC_ALERT', 'SECURITY_ALERT'],
    });

    expect(registered.platform).toBe('android-pwa');
    expect(registered.tokenMasked).toContain('…');
    expect((registered as unknown as Record<string, unknown>).token).toBeUndefined();

    const list = listAdminFcmDevicesSafe(tenantId);
    expect(list.length).toBe(1);

    const updated = await updateAdminFcmDevice(tenantId, registered.deviceId, {
      enabled: false,
    });
    expect(updated?.enabled).toBe(false);

    await updateAdminFcmDevice(tenantId, registered.deviceId, { enabled: true });

    const dispatched = await dispatchCriticalAdminPush({
      tenantId,
      category: 'STOCK_CRITICAL',
      severity: 'critical',
      title: 'Stock en Cero',
      body: 'Generador 3500W llegó a 0 unidades.',
      url: '/dashboard/inventory',
      actorUid: 'admin-1',
      actorName: 'Supervisor Android',
    });

    expect(dispatched.success).toBe(true);
    expect(dispatched.alert.targetedDevices).toBe(1);
    expect(dispatched.alert.category).toBe('STOCK_CRITICAL');

    const removed = await removeAdminFcmDevice(tenantId, { deviceId: registered.deviceId });
    expect(removed).toBe(1);
    expect(listAdminFcmDevicesSafe(tenantId)).toHaveLength(0);
  });

  it('enforces RBAC (401 unauthenticated, 403 non-admin, 200 admin/superadmin) on /api/push/register and /api/push/send', async () => {
    const tenantId = `tenant_rbac_${Date.now()}`;

    // Unauthenticated -> 401
    const unauthGet = await getPushRegister(
      makeSignedRequest('http://localhost:3000/api/push/register', { tenantId })
    );
    expect(unauthGet.status).toBe(401);

    const unauthSend = await postPushSend(
      makeSignedRequest('http://localhost:3000/api/push/send', {
        method: 'POST',
        tenantId,
        body: { category: 'TEST_ALERT' },
      })
    );
    expect(unauthSend.status).toBe(401);

    // Non-admin role ('sales') -> 403
    const salesPost = await postPushRegister(
      makeSignedRequest('http://localhost:3000/api/push/register', {
        method: 'POST',
        role: 'sales',
        uid: 'sales-1',
        tenantId,
        body: { token: sampleToken },
      })
    );
    expect(salesPost.status).toBe(403);

    const salesSend = await postPushSend(
      makeSignedRequest('http://localhost:3000/api/push/send', {
        method: 'POST',
        role: 'sales',
        uid: 'sales-1',
        tenantId,
        body: { category: 'TEST_ALERT' },
      })
    );
    expect(salesSend.status).toBe(403);

    // Admin role -> full CRUD + send
    const adminPost = await postPushRegister(
      makeSignedRequest('http://localhost:3000/api/push/register', {
        method: 'POST',
        role: 'admin',
        uid: 'admin-99',
        tenantId,
        body: {
          token: sampleToken,
          deviceLabel: 'Moto Edge Admin',
          userName: 'Jefe Sucursal',
        },
      })
    );
    expect(adminPost.status).toBe(200);
    const createdJson = await adminPost.json();
    expect(createdJson.success).toBe(true);
    const deviceId = createdJson.data.deviceId;

    const patchRes = await patchPushRegister(
      makeSignedRequest('http://localhost:3000/api/push/register', {
        method: 'PATCH',
        role: 'superadmin',
        uid: 'super-1',
        tenantId,
        body: { deviceId, enabled: true },
      })
    );
    expect(patchRes.status).toBe(200);

    const sendRes = await postPushSend(
      makeSignedRequest('http://localhost:3000/api/push/send', {
        method: 'POST',
        role: 'superadmin',
        uid: 'super-1',
        tenantId,
        body: {
          category: 'SECURITY_ALERT',
          title: 'Prueba Seguridad Android',
          body: 'Verificación de entrega push para administradores.',
        },
      })
    );
    expect(sendRes.status).toBe(200);
    const sendJson = await sendRes.json();
    expect(sendJson.success).toBe(true);
    expect(sendJson.data.targetedDevices).toBe(1);

    const delRes = await deletePushRegister(
      makeSignedRequest(`http://localhost:3000/api/push/register?deviceId=${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
        role: 'admin',
        uid: 'admin-99',
        tenantId,
      })
    );
    expect(delRes.status).toBe(200);
    const delJson = await delRes.json();
    expect(delJson.removedCount).toBe(1);
  });

  it('ships valid Service Worker and Firebase Hosting headers for background FCM delivery', () => {
    const root = process.cwd();
    const swPath = path.join(root, 'public', 'firebase-messaging-sw.js');
    expect(fs.existsSync(swPath)).toBe(true);
    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain('onBackgroundMessage');
    expect(swContent).toContain('notificationclick');
    expect(swContent).toContain('showNotification');

    const fbJson = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
    expect(
      fbJson.hosting.headers.some(
        (h: { source: string }) => h.source === '/firebase-messaging-sw.js'
      )
    ).toBe(true);
  });

  describe('verifyFcmServiceWorkerIntegration diagnostic helper', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('reports non-browser environment cleanly when executed outside browser', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const res = await verifyFcmServiceWorkerIntegration();
      expect(res.ok).toBe(false);
      expect(res.serviceWorkerSupported).toBe(false);
      expect(res.tokenSource).toBe('none');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('detects active firebase-messaging-sw.js and logs current device FCM token from local cache fallback', async () => {
      const mockGetRegistrations = vi.fn().mockResolvedValue([
        {
          active: {
            state: 'activated',
            scriptURL: 'https://localhost:3000/firebase-messaging-sw.js?projectId=test',
          },
        },
      ]);

      vi.stubGlobal('Notification', { permission: 'granted' });
      vi.stubGlobal('navigator', {
        serviceWorker: {
          getRegistrations: mockGetRegistrations,
        },
      });
      vi.stubGlobal('window', {
        Notification: { permission: 'granted' },
        localStorage: {
          getItem: vi.fn((key: string) =>
            key === 'bunkker_android_fcm_token' ? sampleToken : null
          ),
        },
      });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const res = await verifyFcmServiceWorkerIntegration();
      expect(res.fcmSwActive).toBe(true);
      expect(res.fcmSwState).toBe('activated');
      expect(res.fcmSwScriptUrl).toContain('firebase-messaging-sw.js');
      expect(res.token).toBe(sampleToken);
      expect(res.ok).toBe(true);
      expect(infoSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        '[FCM Verify] Token de registro del dispositivo actual:',
        sampleToken
      );
    });
  });
});

