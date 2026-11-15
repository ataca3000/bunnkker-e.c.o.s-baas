export const AUDIT_NOTIF_PREF_KEY = 'bunkker_superadmin_audit_notifications_enabled';
export const AUDIT_NOTIF_DOM_EVENT = 'bunkker:audit-change-event';
export const AUDIT_PREF_CHANGE_EVENT = 'bunkker:audit-notif-pref-changed';

export const AUDIT_WATCHED_ACTIONS = new Set([
  'PRICE_CHANGE',
  'STOCK_UPDATE',
  'PRODUCT_CREATED',
  'PRODUCT_UPDATED',
  'PRODUCT_DELETED',
  'PRODUCT_ARCHIVED',
  'PRODUCT_RESTORED',
  'PRODUCTS_BATCH_UPDATED',
  'SITE_CONFIG_PUBLISHED',
  'CONFIG_UPDATE',
  'ORDER_CANCELLED',
  'ORDER_CANCEL',
  'ORDER_ABANDONED',
  'ROLE_CHANGE',
  'USER_CREATE',
  'SECURITY_ALERT',
  'SHRINKAGE',
  'CORTE_CAJA_CIEGO',
  'INVENTORY_MOVE',
  'ADMIN_RETURN_INTAKE',
]);

export function loadAuditNotificationPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(AUDIT_NOTIF_PREF_KEY);
    if (raw === 'false' || raw === '0') return false;
    return true;
  } catch {
    return true;
  }
}

export function saveAuditNotificationPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUDIT_NOTIF_PREF_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(AUDIT_PREF_CHANGE_EVENT, { detail: { enabled } }));
  } catch {
    // No-op en almacenamiento restringido
  }
}

/**
 * Regla estricta: únicamente el rol `superadmin` recibe notificaciones de auditoría
 * y solo cuando no las haya silenciado manualmente.
 */
export function shouldNotifySuperAdminAudit(
  role: string | null | undefined,
  enabled: boolean
): boolean {
  return role === 'superadmin' && enabled === true;
}

export function isAuditNotificationAction(action?: string, scope?: string): boolean {
  if (scope === 'audit') return true;
  if (!action) return false;
  const normalized = action.trim().toUpperCase();
  return AUDIT_WATCHED_ACTIONS.has(normalized);
}

export function formatAuditChangeNotification(input: {
  action?: string;
  details?: unknown;
  actorName?: string;
  entityId?: string;
}): { title: string; message: string; level: 'warning' | 'info' } {
  const action = (input.action || 'AUDIT_EVENT').trim().toUpperCase();
  let detailText = '';

  if (typeof input.details === 'string') {
    const trimmed = input.details.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (typeof parsed.productName === 'string' && typeof parsed.addedQty === 'number') {
          detailText = `${parsed.productName} (+${parsed.addedQty} ${parsed.unitType || 'PZA'} → ${parsed.newStock ?? ''})`;
        } else if (typeof parsed.description === 'string') {
          detailText = parsed.description;
        } else {
          detailText = trimmed;
        }
      } catch {
        detailText = trimmed;
      }
    } else {
      detailText = trimmed;
    }
  } else if (input.details && typeof input.details === 'object') {
    const obj = input.details as Record<string, unknown>;
    detailText =
      (typeof obj.details === 'string' && obj.details) ||
      (typeof obj.description === 'string' && obj.description) ||
      (typeof obj.productName === 'string' && obj.productName) ||
      '';
  }

  const actorPrefix = input.actorName ? `${input.actorName}: ` : '';
  const suffix = detailText || (input.entityId ? `Referencia ${input.entityId}` : 'Cambio registrado en auditoría.');

  switch (action) {
    case 'PRICE_CHANGE':
      return {
        title: 'Auditoría: Cambio de Precio',
        message: `${actorPrefix}${suffix}`,
        level: 'warning',
      };
    case 'STOCK_UPDATE':
    case 'INVENTORY_MOVE':
      return {
        title: 'Auditoría: Movimiento de Stock',
        message: `${actorPrefix}${suffix}`,
        level: 'info',
      };
    case 'PRODUCT_CREATED':
    case 'PRODUCT_UPDATED':
    case 'PRODUCT_SAVED':
      return {
        title: 'Auditoría: Catálogo / Producto',
        message: `${actorPrefix}${suffix}`,
        level: 'info',
      };
    case 'PRODUCT_DELETED':
    case 'PRODUCT_ARCHIVED':
    case 'ORDER_CANCELLED':
    case 'ORDER_CANCEL':
    case 'ORDER_ABANDONED':
    case 'SECURITY_ALERT':
    case 'SHRINKAGE':
      return {
        title: 'Alerta de Auditoría',
        message: `${actorPrefix}${suffix}`,
        level: 'warning',
      };
    case 'ROLE_CHANGE':
    case 'USER_CREATE':
      return {
        title: 'Auditoría: Usuarios y Permisos',
        message: `${actorPrefix}${suffix}`,
        level: 'warning',
      };
    case 'SITE_CONFIG_PUBLISHED':
    case 'CONFIG_UPDATE':
      return {
        title: 'Auditoría: Configuración',
        message: `${actorPrefix}${suffix}`,
        level: 'info',
      };
    default:
      return {
        title: 'Auditoría del Sistema',
        message: `${actorPrefix}${suffix}`,
        level: 'info',
      };
  }
}
