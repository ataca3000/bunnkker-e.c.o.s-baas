import crypto from 'crypto';
import type { MulticastMessage } from 'firebase-admin/messaging';
import { adminDb, adminMessaging, hasAdminMessagingCredentials } from './firebase-admin';
import { loadPersistentJson, savePersistentJson } from './persistentSettings';
import { publishRealtimeEvent } from './realtimeBus';
import {
  ALL_EARLY_WARNING_CATEGORIES,
  buildStableDeviceId,
  detectClientPlatform,
  isValidFcmToken,
  maskFcmToken,
  normalizeSubscribedCategories,
  sanitizePushAlertInput,
  type EarlyWarningAlertRecord,
  type EarlyWarningCategory,
  type EarlyWarningSeverity,
  type FcmDevicePlatform,
  type PublicFcmDeviceView,
  type RegisteredFcmDevice,
} from './fcmPushTypes';

export * from './fcmPushTypes';

const DEVICES_NAMESPACE = 'fcm_admin_devices';
const ALERTS_NAMESPACE = 'fcm_early_warning_alerts';
const MAX_ALERT_HISTORY = 100;

const recentDedupTimestamps = new Map<string, number>();

interface DeviceStoreState {
  devices: RegisteredFcmDevice[];
}

interface AlertStoreState {
  alerts: EarlyWarningAlertRecord[];
}

function readDevicesStore(tenantId: string): RegisteredFcmDevice[] {
  const store = loadPersistentJson<DeviceStoreState>(DEVICES_NAMESPACE, tenantId, { devices: [] });
  return Array.isArray(store?.devices) ? store.devices : [];
}

function writeDevicesStore(tenantId: string, devices: RegisteredFcmDevice[]): void {
  savePersistentJson<DeviceStoreState>(DEVICES_NAMESPACE, tenantId, { devices });
}

function readAlertsStore(tenantId: string): EarlyWarningAlertRecord[] {
  const store = loadPersistentJson<AlertStoreState>(ALERTS_NAMESPACE, tenantId, { alerts: [] });
  return Array.isArray(store?.alerts) ? store.alerts : [];
}

function writeAlertsStore(tenantId: string, alerts: EarlyWarningAlertRecord[]): void {
  savePersistentJson<AlertStoreState>(ALERTS_NAMESPACE, tenantId, {
    alerts: alerts.slice(0, MAX_ALERT_HISTORY),
  });
}

export function toPublicFcmDeviceView(device: RegisteredFcmDevice): PublicFcmDeviceView {
  const { token: _omitted, ...safeDevice } = device;
  return safeDevice;
}

export function buildFcmMulticastMessage(
  tokens: string[],
  alert: {
    id: string;
    category: EarlyWarningCategory;
    severity: EarlyWarningSeverity;
    title: string;
    body: string;
    url: string;
    createdAt: string;
    metadata?: Record<string, string>;
  }
): MulticastMessage {
  const isCritical = alert.severity === 'critical';

  return {
    tokens,
    notification: {
      title: alert.title,
      body: alert.body,
    },
    data: {
      ...(alert.metadata || {}),
      alertId: alert.id,
      category: alert.category,
      severity: alert.severity,
      title: alert.title,
      body: alert.body,
      url: alert.url,
      createdAt: alert.createdAt,
    },
    android: {
      priority: 'high',
      ttl: isCritical ? 3600 * 1000 : 1800 * 1000,
      notification: {
        title: alert.title,
        body: alert.body,
        channelId: 'bunkker_critical_alerts',
        priority: isCritical ? 'max' : 'high',
        defaultSound: true,
        defaultVibrateTimings: false,
        vibrateTimingsMillis: [250, 120, 250, 120, 400],
        visibility: 'public',
        clickAction: alert.url,
        icon: '/icon-192x192.png',
        color: isCritical ? '#ef4444' : '#f59e0b',
      },
    },
    webpush: {
      headers: {
        Urgency: isCritical ? 'high' : 'normal',
        TTL: '3600',
      },
      notification: {
        title: alert.title,
        body: alert.body,
        icon: '/icon-192x192.png',
        badge: '/icon-maskable-192x192.png',
        tag: `bunkker-${alert.category}-${alert.id}`,
        renotify: true,
        requireInteraction: isCritical,
        vibrate: [250, 120, 250, 120, 400],
        data: {
          url: alert.url,
          category: alert.category,
          severity: alert.severity,
          alertId: alert.id,
        },
      },
      fcmOptions: {
        link: alert.url,
      },
    },
  };
}

export async function registerAdminFcmDevice(input: {
  tenantId?: string;
  userId: string;
  userName?: string;
  role: string;
  token: string;
  deviceId?: string;
  platform?: FcmDevicePlatform;
  deviceLabel?: string;
  userAgent?: string;
  isStandalone?: boolean;
  enabled?: boolean;
  categories?: unknown;
}): Promise<PublicFcmDeviceView> {
  if (input.role !== 'superadmin' && input.role !== 'admin') {
    throw new Error('Solo cuentas Admin o SuperAdmin pueden registrar dispositivos de alerta temprana.');
  }
  if (!isValidFcmToken(input.token)) {
    throw new Error('Token FCM inválido.');
  }

  const tenantId = (input.tenantId || 'default').trim() || 'default';
  const cleanToken = input.token.trim();
  const deviceId = buildStableDeviceId(cleanToken, input.deviceId);
  const now = new Date().toISOString();
  const platform: FcmDevicePlatform =
    input.platform || detectClientPlatform(input.userAgent, input.isStandalone);
  const categories = normalizeSubscribedCategories(input.categories);
  const existing = readDevicesStore(tenantId);

  const prev = existing.find((d) => d.deviceId === deviceId || d.token === cleanToken);
  const nextRecord: RegisteredFcmDevice = {
    deviceId: prev?.deviceId || deviceId,
    tenantId,
    userId: input.userId,
    userName: (input.userName || prev?.userName || 'Administrador').trim().slice(0, 80),
    role: input.role,
    token: cleanToken,
    tokenMasked: maskFcmToken(cleanToken),
    platform,
    deviceLabel:
      (input.deviceLabel || prev?.deviceLabel || (platform.startsWith('android') ? 'Android Admin' : 'Terminal Admin'))
        .trim()
        .slice(0, 80),
    enabled: typeof input.enabled === 'boolean' ? input.enabled : (prev?.enabled ?? true),
    categories: input.categories !== undefined ? categories : (prev?.categories || [...ALL_EARLY_WARNING_CATEGORIES]),
    userAgent: input.userAgent?.slice(0, 240) || prev?.userAgent,
    createdAt: prev?.createdAt || now,
    updatedAt: now,
    lastSentAt: prev?.lastSentAt,
    lastDeliveryStatus: prev?.lastDeliveryStatus || 'pending',
  };

  const filtered = existing.filter((d) => d.deviceId !== nextRecord.deviceId && d.token !== cleanToken);
  filtered.unshift(nextRecord);
  writeDevicesStore(tenantId, filtered);

  if (hasAdminMessagingCredentials) {
    try {
      await adminDb.collection('fcm_admin_devices').doc(nextRecord.deviceId).set(
        {
          deviceId: nextRecord.deviceId,
          tenantId: nextRecord.tenantId,
          userId: nextRecord.userId,
          userName: nextRecord.userName,
          role: nextRecord.role,
          tokenMasked: nextRecord.tokenMasked,
          platform: nextRecord.platform,
          deviceLabel: nextRecord.deviceLabel,
          enabled: nextRecord.enabled,
          categories: nextRecord.categories,
          updatedAt: nextRecord.updatedAt,
          createdAt: nextRecord.createdAt,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[FCM PUSH] No se pudo espejar dispositivo en Firestore:', err);
    }
  }

  return toPublicFcmDeviceView(nextRecord);
}

export function listAdminFcmDevicesSafe(tenantId: string = 'default'): PublicFcmDeviceView[] {
  return readDevicesStore(tenantId).map(toPublicFcmDeviceView);
}

export async function updateAdminFcmDevice(
  tenantId: string,
  deviceId: string,
  patch: {
    enabled?: boolean;
    categories?: unknown;
    deviceLabel?: string;
  }
): Promise<PublicFcmDeviceView | null> {
  const devices = readDevicesStore(tenantId);
  const idx = devices.findIndex((d) => d.deviceId === deviceId);
  if (idx === -1) return null;

  const target = devices[idx];
  const updated: RegisteredFcmDevice = {
    ...target,
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : target.enabled,
    categories:
      patch.categories !== undefined ? normalizeSubscribedCategories(patch.categories) : target.categories,
    deviceLabel:
      typeof patch.deviceLabel === 'string' && patch.deviceLabel.trim()
        ? patch.deviceLabel.trim().slice(0, 80)
        : target.deviceLabel,
    updatedAt: new Date().toISOString(),
  };

  devices[idx] = updated;
  writeDevicesStore(tenantId, devices);

  if (hasAdminMessagingCredentials) {
    try {
      await adminDb.collection('fcm_admin_devices').doc(updated.deviceId).set(
        {
          enabled: updated.enabled,
          categories: updated.categories,
          deviceLabel: updated.deviceLabel,
          updatedAt: updated.updatedAt,
        },
        { merge: true }
      );
    } catch {}
  }

  return toPublicFcmDeviceView(updated);
}

export async function removeAdminFcmDevice(
  tenantId: string,
  selector: { deviceId?: string; token?: string }
): Promise<number> {
  const devices = readDevicesStore(tenantId);
  const removed = devices.filter(
    (d) =>
      (selector.deviceId && d.deviceId === selector.deviceId) ||
      (selector.token && d.token === selector.token.trim())
  );

  if (removed.length === 0) return 0;

  const removedIds = new Set(removed.map((d) => d.deviceId));
  const remaining = devices.filter((d) => !removedIds.has(d.deviceId));
  writeDevicesStore(tenantId, remaining);

  if (hasAdminMessagingCredentials) {
    for (const dev of removed) {
      try {
        await adminDb.collection('fcm_admin_devices').doc(dev.deviceId).delete();
      } catch {}
    }
  }

  return removed.length;
}

export function listEarlyWarningAlerts(
  tenantId: string = 'default',
  limit: number = 25
): EarlyWarningAlertRecord[] {
  return readAlertsStore(tenantId).slice(0, Math.max(1, Math.min(limit, MAX_ALERT_HISTORY)));
}

export async function dispatchCriticalAdminPush(input: {
  tenantId?: string;
  category: EarlyWarningCategory;
  severity?: EarlyWarningSeverity;
  title?: string;
  body?: string;
  url?: string;
  actorUid?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
  dedupKey?: string;
  cooldownMs?: number;
}): Promise<{
  success: boolean;
  deduplicated?: boolean;
  alert: EarlyWarningAlertRecord;
  hasFcmServerCredentials: boolean;
}> {
  const tenantId = (input.tenantId || 'default').trim() || 'default';
  const clean = sanitizePushAlertInput(input);
  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();

  if (input.dedupKey && (input.cooldownMs ?? 0) > 0) {
    const cacheKey = `${tenantId}:${input.dedupKey}`;
    const prevTs = recentDedupTimestamps.get(cacheKey);
    if (prevTs && nowMs - prevTs < (input.cooldownMs || 0)) {
      const latest = readAlertsStore(tenantId)[0] || {
        id: `dedup_${crypto.randomUUID()}`,
        tenantId,
        category: clean.category,
        severity: clean.severity,
        title: clean.title,
        body: clean.body,
        url: clean.url,
        actorUid: input.actorUid,
        actorName: input.actorName,
        targetRoles: ['superadmin', 'admin'],
        deliveryMode: 'recorded_no_devices',
        sentCount: 0,
        failedCount: 0,
        prunedCount: 0,
        targetedDevices: 0,
        createdAt,
        metadata: clean.metadata,
      };
      return {
        success: true,
        deduplicated: true,
        alert: latest,
        hasFcmServerCredentials: hasAdminMessagingCredentials,
      };
    }
    recentDedupTimestamps.set(cacheKey, nowMs);
  }

  const devices = readDevicesStore(tenantId);
  const eligible = devices.filter(
    (d) =>
      d.enabled &&
      (d.role === 'superadmin' || d.role === 'admin') &&
      d.categories.includes(clean.category)
  );

  const tokens = Array.from(new Set(eligible.map((d) => d.token).filter(isValidFcmToken)));
  const alertId = `ew_${crypto.randomUUID().slice(0, 12)}`;

  let sentCount = 0;
  let failedCount = 0;
  let prunedCount = 0;

  if (tokens.length > 0 && adminMessaging) {
    const multicastMessage = buildFcmMulticastMessage(tokens, {
      id: alertId,
      category: clean.category,
      severity: clean.severity,
      title: clean.title,
      body: clean.body,
      url: clean.url,
      createdAt,
      metadata: clean.metadata,
    });

    try {
      const batchResult = await adminMessaging.sendEachForMulticast(multicastMessage);
      sentCount = batchResult.successCount;
      failedCount = batchResult.failureCount;

      const invalidTokens = new Set<string>();
      const succeededTokens = new Set<string>();

      batchResult.responses.forEach((resp, idx) => {
        const token = tokens[idx];
        if (!token) return;
        if (resp.success) {
          succeededTokens.add(token);
        } else {
          const code = resp.error?.code || '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.add(token);
          }
        }
      });

      if (invalidTokens.size > 0 || succeededTokens.size > 0) {
        const updatedDevices = devices
          .filter((d) => !invalidTokens.has(d.token))
          .map((d) =>
            succeededTokens.has(d.token)
              ? { ...d, lastSentAt: createdAt, lastDeliveryStatus: 'ok' as const }
              : d
          );
        prunedCount = devices.length - updatedDevices.length;
        writeDevicesStore(tenantId, updatedDevices);

        if (hasAdminMessagingCredentials && prunedCount > 0) {
          for (const d of devices) {
            if (invalidTokens.has(d.token)) {
              try {
                await adminDb.collection('fcm_admin_devices').doc(d.deviceId).delete();
              } catch {}
            }
          }
        }
      }
    } catch (err) {
      console.warn('[FCM PUSH] Error enviando multicast Admin SDK:', err);
      failedCount = tokens.length;
    }
  }

  const deliveryMode: EarlyWarningAlertRecord['deliveryMode'] =
    sentCount > 0
      ? 'fcm_and_realtime'
      : eligible.length > 0 || !adminMessaging
      ? 'realtime_sw_only'
      : 'recorded_no_devices';

  const record: EarlyWarningAlertRecord = {
    id: alertId,
    tenantId,
    category: clean.category,
    severity: clean.severity,
    title: clean.title,
    body: clean.body,
    url: clean.url,
    actorUid: input.actorUid,
    actorName: input.actorName,
    targetRoles: ['superadmin', 'admin'],
    deliveryMode,
    sentCount,
    failedCount,
    prunedCount,
    targetedDevices: eligible.length,
    createdAt,
    metadata: clean.metadata,
  };

  const alerts = readAlertsStore(tenantId);
  alerts.unshift(record);
  writeAlertsStore(tenantId, alerts);

  if (hasAdminMessagingCredentials) {
    try {
      await adminDb.collection('early_warning_alerts').doc(record.id).set(record);
    } catch {}
  }

  publishRealtimeEvent({
    tenantId,
    scope: 'audit',
    action: 'EARLY_WARNING_PUSH',
    entityId: record.id,
    payload: {
      alert: record,
      details: `${record.title} — ${record.body}`,
    },
  });

  return {
    success: true,
    alert: record,
    hasFcmServerCredentials: hasAdminMessagingCredentials,
  };
}
