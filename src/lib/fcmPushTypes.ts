export type EarlyWarningCategory =
  | 'STOCK_CRITICAL'
  | 'PANIC_ALERT'
  | 'SECURITY_ALERT'
  | 'PRICE_CHANGE'
  | 'ORDER_ABANDONED'
  | 'SYSTEM_ERROR'
  | 'TEST_ALERT';

export type EarlyWarningSeverity = 'critical' | 'warning' | 'info';

export type FcmDevicePlatform =
  | 'android-pwa'
  | 'android-web'
  | 'desktop-web'
  | 'ios-web'
  | 'unknown';

export interface EarlyWarningCategoryMeta {
  id: EarlyWarningCategory;
  label: string;
  description: string;
  defaultSeverity: EarlyWarningSeverity;
  defaultUrl: string;
}

export const EARLY_WARNING_CATEGORIES: Record<EarlyWarningCategory, EarlyWarningCategoryMeta> = {
  STOCK_CRITICAL: {
    id: 'STOCK_CRITICAL',
    label: 'Stock Crítico / Agotado',
    description: 'Productos por debajo del mínimo configurado o en cero piezas.',
    defaultSeverity: 'critical',
    defaultUrl: '/dashboard/inventory',
  },
  PANIC_ALERT: {
    id: 'PANIC_ALERT',
    label: 'Botón de Pánico / Emergencia',
    description: 'Alertas de emergencia en ruta o sucursal enviadas por personal.',
    defaultSeverity: 'critical',
    defaultUrl: '/dashboard/delivery',
  },
  SECURITY_ALERT: {
    id: 'SECURITY_ALERT',
    label: 'Seguridad y Auditoría',
    description: 'Intentos anómalos, sesiones bloqueadas o mermas/cancelaciones críticas.',
    defaultSeverity: 'critical',
    defaultUrl: '/dashboard/audit',
  },
  PRICE_CHANGE: {
    id: 'PRICE_CHANGE',
    label: 'Cambios de Precio',
    description: 'Modificaciones de precios en catálogo para validación inmediata.',
    defaultSeverity: 'warning',
    defaultUrl: '/dashboard/inventory',
  },
  ORDER_ABANDONED: {
    id: 'ORDER_ABANDONED',
    label: 'Órdenes Abandonadas / Canceladas',
    description: 'Cancelaciones de pedido o reservas expiradas con impacto en caja.',
    defaultSeverity: 'warning',
    defaultUrl: '/dashboard/audit',
  },
  SYSTEM_ERROR: {
    id: 'SYSTEM_ERROR',
    label: 'Fallo Crítico de Sistema',
    description: 'Errores críticos de sincronización, impresión o servidor.',
    defaultSeverity: 'critical',
    defaultUrl: '/dashboard/audit',
  },
  TEST_ALERT: {
    id: 'TEST_ALERT',
    label: 'Prueba de Alerta Temprana',
    description: 'Verificación manual de conectividad FCM hacia Android.',
    defaultSeverity: 'warning',
    defaultUrl: '/dashboard/setup?step=8',
  },
};

export const ALL_EARLY_WARNING_CATEGORIES = Object.keys(
  EARLY_WARNING_CATEGORIES
) as EarlyWarningCategory[];

export interface RegisteredFcmDevice {
  deviceId: string;
  tenantId: string;
  userId: string;
  userName: string;
  role: 'superadmin' | 'admin';
  token: string;
  tokenMasked: string;
  platform: FcmDevicePlatform;
  deviceLabel: string;
  enabled: boolean;
  categories: EarlyWarningCategory[];
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
  lastSentAt?: string;
  lastDeliveryStatus?: 'ok' | 'unregistered' | 'pending';
}

export type PublicFcmDeviceView = Omit<RegisteredFcmDevice, 'token'>;

export interface EarlyWarningAlertRecord {
  id: string;
  tenantId: string;
  category: EarlyWarningCategory;
  severity: EarlyWarningSeverity;
  title: string;
  body: string;
  url: string;
  actorUid?: string;
  actorName?: string;
  targetRoles: Array<'superadmin' | 'admin'>;
  deliveryMode: 'fcm_and_realtime' | 'realtime_sw_only' | 'recorded_no_devices';
  sentCount: number;
  failedCount: number;
  prunedCount: number;
  targetedDevices: number;
  createdAt: string;
  metadata?: Record<string, string>;
}

export function isValidEarlyWarningCategory(value: unknown): value is EarlyWarningCategory {
  return typeof value === 'string' && value in EARLY_WARNING_CATEGORIES;
}

export function normalizeSubscribedCategories(input: unknown): EarlyWarningCategory[] {
  if (!Array.isArray(input) || input.length === 0) {
    return [...ALL_EARLY_WARNING_CATEGORIES];
  }
  const filtered = input.filter(isValidEarlyWarningCategory);
  return filtered.length > 0 ? Array.from(new Set(filtered)) : [...ALL_EARLY_WARNING_CATEGORIES];
}

export function detectClientPlatform(
  userAgent?: string,
  isStandalone?: boolean
): FcmDevicePlatform {
  const ua = (userAgent || '').trim();
  if (/Android/i.test(ua)) {
    return isStandalone ? 'android-pwa' : 'android-web';
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'ios-web';
  }
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) {
    return 'desktop-web';
  }
  return 'unknown';
}

export function maskFcmToken(token: string): string {
  const trimmed = (token || '').trim();
  if (trimmed.length <= 14) {
    return trimmed ? `${trimmed.slice(0, 4)}***` : '';
  }
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-6)}`;
}

export function isValidFcmToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (trimmed.length < 20 || trimmed.length > 4096) return false;
  if (/\s/.test(trimmed)) return false;
  return true;
}

export function buildStableDeviceId(token: string, providedId?: string): string {
  if (typeof providedId === 'string') {
    const cleaned = providedId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96);
    if (cleaned.length >= 3) {
      return cleaned;
    }
  }
  const normalizedToken = token.trim();
  let hash = 2166136261;
  for (let i = 0; i < normalizedToken.length; i++) {
    hash ^= normalizedToken.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const tail = normalizedToken.slice(-8).replace(/[^a-zA-Z0-9_-]/g, 'x') || 'dev';
  return `fcm_${hex}_${tail}`;
}

export function sanitizePushAlertInput(input: {
  category?: unknown;
  severity?: unknown;
  title?: unknown;
  body?: unknown;
  url?: unknown;
  metadata?: unknown;
}): {
  category: EarlyWarningCategory;
  severity: EarlyWarningSeverity;
  title: string;
  body: string;
  url: string;
  metadata: Record<string, string>;
} {
  const category: EarlyWarningCategory = isValidEarlyWarningCategory(input.category)
    ? input.category
    : 'SECURITY_ALERT';
  const metaInfo = EARLY_WARNING_CATEGORIES[category];

  const severity: EarlyWarningSeverity =
    input.severity === 'critical' || input.severity === 'warning' || input.severity === 'info'
      ? input.severity
      : metaInfo.defaultSeverity;

  const rawTitle = typeof input.title === 'string' ? input.title.trim() : '';
  const rawBody = typeof input.body === 'string' ? input.body.trim() : '';

  const title = (rawTitle || `Alerta Temprana: ${metaInfo.label}`).slice(0, 120);
  const body = (rawBody || metaInfo.description).slice(0, 300);

  let url = metaInfo.defaultUrl;
  if (typeof input.url === 'string' && input.url.trim().startsWith('/')) {
    url = input.url.trim().slice(0, 200);
  }

  const metadata: Record<string, string> = {};
  if (input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)) {
    for (const [k, v] of Object.entries(input.metadata as Record<string, unknown>)) {
      if (!k || typeof k !== 'string') continue;
      if (v === undefined || v === null) continue;
      const safeKey = k.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48);
      if (!safeKey || safeKey === 'from' || safeKey === 'notification') continue;
      metadata[safeKey] = String(v).slice(0, 256);
    }
  }

  return { category, severity, title, body, url, metadata };
}
