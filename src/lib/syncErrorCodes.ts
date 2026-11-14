export type BunkkerSyncErrorCode =
  | 'ERR_NET_OFFLINE'
  | 'ERR_SERVER_UNREACHABLE'
  | 'ERR_SYNC_HTTP_5XX'
  | 'ERR_SYNC_CONFLICT'
  | 'ERR_BRIDGE_WS_DOWN'
  | 'ERR_SESSION_EXPIRED'
  | 'ERR_PAIRING_INVALID'
  | 'ERR_PAIRING_EXPIRED'
  | 'ERR_PAIRING_REVOKED'
  | 'ERR_DEVICE_MISMATCH'
  | 'ERR_DEVICE_REVOKED'
  | 'ERR_ORDER_CREATE_FAILED';

export interface SyncErrorDescriptor {
  code: BunkkerSyncErrorCode;
  title: string;
  message: string;
  actionHint: string;
  severity: 'warning' | 'error' | 'info';
  recoverable: boolean;
}

export const SYNC_ERROR_CATALOG: Record<BunkkerSyncErrorCode, SyncErrorDescriptor> = {
  ERR_NET_OFFLINE: {
    code: 'ERR_NET_OFFLINE',
    title: 'Sin red local o internet',
    message: 'El dispositivo perdió conectividad. Tus ventas y cambios se resguardan en IndexedDB.',
    actionHint: 'Se sincronizará automáticamente al recuperar la conexión.',
    severity: 'warning',
    recoverable: true,
  },
  ERR_SERVER_UNREACHABLE: {
    code: 'ERR_SERVER_UNREACHABLE',
    title: 'Servidor temporalmente inaccesible',
    message: 'No se pudo contactar al servidor principal de BUNKKER.',
    actionHint: 'Reintentando reconexión automática con retroceso exponencial.',
    severity: 'warning',
    recoverable: true,
  },
  ERR_SYNC_HTTP_5XX: {
    code: 'ERR_SYNC_HTTP_5XX',
    title: 'Fallo temporal del servidor (5xx)',
    message: 'El servidor respondió con un error interno al sincronizar los datos.',
    actionHint: 'Tus pedidos pendientes permanecen seguros en la cola local.',
    severity: 'error',
    recoverable: true,
  },
  ERR_SYNC_CONFLICT: {
    code: 'ERR_SYNC_CONFLICT',
    title: 'Conflicto de concurrencia',
    message: 'Este registro fue actualizado por otro dispositivo o caja al mismo tiempo.',
    actionHint: 'Recargando el estado más reciente desde el servidor.',
    severity: 'warning',
    recoverable: true,
  },
  ERR_BRIDGE_WS_DOWN: {
    code: 'ERR_BRIDGE_WS_DOWN',
    title: 'Puente LAN 3001 inactivo',
    message: 'El puente local WebSocket no está activo; operando por canal web seguro.',
    actionHint: 'La sincronización multidispositivo continúa vía canal HTTPS/SSE.',
    severity: 'info',
    recoverable: true,
  },
  ERR_SESSION_EXPIRED: {
    code: 'ERR_SESSION_EXPIRED',
    title: 'Sesión expirada',
    message: 'Tu sesión expiró o requiere revalidación.',
    actionHint: 'Inicia sesión con tu PIN o escanea un nuevo pase QR.',
    severity: 'error',
    recoverable: false,
  },
  ERR_PAIRING_INVALID: {
    code: 'ERR_PAIRING_INVALID',
    title: 'Pase de vinculación inválido',
    message: 'El código o enlace QR no es válido o ya fue utilizado.',
    actionHint: 'Solicita un nuevo código QR o clave de 6 dígitos al administrador.',
    severity: 'error',
    recoverable: false,
  },
  ERR_PAIRING_EXPIRED: {
    code: 'ERR_PAIRING_EXPIRED',
    title: 'Pase de vinculación expirado',
    message: 'El tiempo de validez del código QR o pase temporal ha caducado.',
    actionHint: 'Genera un nuevo pase desde Vinculación QR.',
    severity: 'warning',
    recoverable: false,
  },
  ERR_PAIRING_REVOKED: {
    code: 'ERR_PAIRING_REVOKED',
    title: 'Pase revocado',
    message: 'Este pase de vinculación fue cancelado por el administrador.',
    actionHint: 'Solicita autorización nueva en administración.',
    severity: 'error',
    recoverable: false,
  },
  ERR_DEVICE_MISMATCH: {
    code: 'ERR_DEVICE_MISMATCH',
    title: 'Terminal no vinculada',
    message: 'Tu usuario está asignado a otra terminal y este dispositivo no está autorizado.',
    actionHint: 'Pide al administrador vincular este equipo o desvincular el anterior.',
    severity: 'error',
    recoverable: false,
  },
  ERR_DEVICE_REVOKED: {
    code: 'ERR_DEVICE_REVOKED',
    title: 'Dispositivo desvinculado',
    message: 'El administrador revocó el acceso de esta terminal.',
    actionHint: 'Vuelve a vincular el equipo escaneando un pase QR autorizado.',
    severity: 'error',
    recoverable: false,
  },
  ERR_ORDER_CREATE_FAILED: {
    code: 'ERR_ORDER_CREATE_FAILED',
    title: 'Error procesando orden',
    message: 'No se pudo completar la creación de la orden en el servidor.',
    actionHint: 'Verifica stock, sesión o conexión y reintenta.',
    severity: 'error',
    recoverable: true,
  },
};

export function getSyncErrorDescriptor(code?: string | null): SyncErrorDescriptor | null {
  if (!code) return null;
  if (code in SYNC_ERROR_CATALOG) {
    return SYNC_ERROR_CATALOG[code as BunkkerSyncErrorCode];
  }
  return null;
}
