import {
  applyLocalStockDeltaToIDB,
  enqueueOfflineOrder,
  saveLanHostLink,
  saveOfflineCatalogSnapshot,
  type OfflineCatalogProduct,
} from '@/lib/indexedDBCart';

export interface HostInfoResponse {
  ok: boolean;
  roomCode: string;
  branchId: string;
  branchName: string;
  hostEpoch: number;
  hostIp: string;
  port: number;
  productCount: number;
  connectedClients: number;
  pendingCloudSync: number;
  startedAt: string;
}

export interface HostSaleItemInput {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface HostSalePayload {
  txId: string;
  roomCode: string;
  cashierRole: string;
  deviceName: string;
  items: HostSaleItemInput[];
  total: number;
  createdAt: string;
}

export interface HostConflictSnapshot {
  branchId: string;
  hostEpoch: number;
  updatedAt: string;
  products: OfflineCatalogProduct[];
  pendingSalesCount: number;
  todaySales: number;
  todayOrders: number;
}

export const DEFAULT_HOST_PORT = 8765;

/**
 * Normaliza un código de sala estilo Minecraft/BUNKKER (ej. "bnk 4821" -> "BNK-4821").
 */
export function normalizeRoomCode(input: string): string {
  const cleaned = String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!cleaned) return '';
  if (cleaned.startsWith('BNK') && cleaned.length > 3) {
    return `BNK-${cleaned.slice(3, 9)}`;
  }
  if (cleaned.length <= 6) {
    return `BNK-${cleaned}`;
  }
  return `BNK-${cleaned.slice(0, 6)}`;
}

/**
 * Valida que el código de sala tenga formato BNK-XXXX (4 a 6 caracteres alfanuméricos).
 */
export function isValidRoomCode(code: string): boolean {
  const normalized = normalizeRoomCode(code);
  return /^BNK-[A-Z0-9]{4,6}$/.test(normalized);
}

/**
 * Normaliza una IP/host de red local a sus URLs HTTP y WebSocket.
 */
export function parseHostEndpoint(rawAddress: string, defaultPort: number = DEFAULT_HOST_PORT): {
  httpUrl: string;
  wsUrl: string;
  hostname: string;
  port: number;
} | null {
  const trimmed = String(rawAddress || '').trim();
  if (!trimmed) return null;

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname) return null;
    const port = parsed.port ? Number(parsed.port) : defaultPort;
    if (!Number.isFinite(port) || port <= 0 || port > 65535) return null;
    const isHttps = parsed.protocol === 'https:';
    const httpProtocol = isHttps ? 'https:' : 'http:';
    const wsProtocol = isHttps ? 'wss:' : 'ws:';
    const baseAuthority = `${parsed.hostname}:${port}`;
    return {
      httpUrl: `${httpProtocol}//${baseAuthority}`,
      wsUrl: `${wsProtocol}//${baseAuthority}/ws/host`,
      hostname: parsed.hostname,
      port,
    };
  } catch {
    return null;
  }
}

/**
 * Detecta si el navegador actual está en HTTPS e intenta abrir un Host HTTP LAN plano
 * (bloqueado por Mixed Content en navegadores modernos).
 */
export function detectMixedContentHazard(
  currentProtocol: string | undefined,
  targetHttpUrl: string
): boolean {
  if (!currentProtocol) return false;
  return currentProtocol === 'https:' && targetHttpUrl.startsWith('http://');
}

export async function fetchHostInfo(hostHttpUrl: string, timeoutMs: number = 3500): Promise<HostInfoResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${hostHttpUrl.replace(/\/+$/, '')}/api/host/info`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`El Host respondió HTTP ${res.status}`);
    }
    return (await res.json()) as HostInfoResponse;
  } finally {
    clearTimeout(timer);
  }
}

export async function joinAndCacheLanHost(params: {
  hostAddress: string;
  roomCode: string;
  deviceName: string;
  role: string;
}): Promise<{
  info: HostInfoResponse;
  products: OfflineCatalogProduct[];
  httpUrl: string;
  wsUrl: string;
}> {
  const endpoint = parseHostEndpoint(params.hostAddress);
  if (!endpoint) {
    throw new Error('Dirección IP o puerto del Host inválido (ejemplo: 192.168.1.45:8765).');
  }

  const normalizedCode = normalizeRoomCode(params.roomCode);
  if (!isValidRoomCode(normalizedCode)) {
    throw new Error('El código de sala debe tener el formato BNK-XXXX.');
  }

  const info = await fetchHostInfo(endpoint.httpUrl);
  if (normalizeRoomCode(info.roomCode) !== normalizedCode) {
    throw new Error(
      `El código ingresado (${normalizedCode}) no coincide con el Host encontrado (${info.roomCode}).`
    );
  }

  const joinRes = await fetch(`${endpoint.httpUrl}/api/host/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: normalizedCode,
      deviceName: params.deviceName.trim() || 'Terminal PWA',
      role: params.role || 'sales',
    }),
  });
  if (!joinRes.ok) {
    throw new Error('El Host rechazó el ingreso de la terminal.');
  }

  const snapRes = await fetch(`${endpoint.httpUrl}/api/host/snapshot`);
  const snapData = snapRes.ok ? await snapRes.json() : { products: [] };
  const products: OfflineCatalogProduct[] = Array.isArray(snapData?.products) ? snapData.products : [];

  await saveLanHostLink({
    roomCode: normalizedCode,
    hostUrl: endpoint.httpUrl,
    wsUrl: endpoint.wsUrl,
    branchId: info.branchId,
    branchName: info.branchName,
    hostEpoch: info.hostEpoch,
    role: params.role || 'sales',
    deviceName: params.deviceName.trim() || 'Terminal PWA',
  });

  await saveOfflineCatalogSnapshot({
    branchId: info.branchId,
    roomCode: normalizedCode,
    hostEpoch: info.hostEpoch,
    source: 'lan_host',
    products,
  });

  return {
    info,
    products,
    httpUrl: endpoint.httpUrl,
    wsUrl: endpoint.wsUrl,
  };
}

/**
 * Envía una venta al Host LAN o la respalda en IndexedDB si el Host se desconectó momentáneamente.
 */
export async function submitSaleToHostOrQueue(params: {
  hostHttpUrl?: string | null;
  roomCode: string;
  cashierRole: string;
  deviceName: string;
  items: HostSaleItemInput[];
}): Promise<{ deliveredToHost: boolean; queuedOffline: boolean; txId: string }> {
  const txId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const total = params.items.reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0),
    0
  );

  const payload: HostSalePayload = {
    txId,
    roomCode: normalizeRoomCode(params.roomCode),
    cashierRole: params.cashierRole,
    deviceName: params.deviceName,
    items: params.items,
    total: Math.round(total * 100) / 100,
    createdAt: new Date().toISOString(),
  };

  // Descuento optimista inmediato en caché local IndexedDB
  await applyLocalStockDeltaToIDB(
    params.items.map((i) => ({ productId: i.productId, delta: -Math.abs(Number(i.qty || 0)) }))
  ).catch(() => {});

  if (params.hostHttpUrl) {
    try {
      const res = await fetch(`${params.hostHttpUrl.replace(/\/+$/, '')}/api/host/sale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { deliveredToHost: true, queuedOffline: false, txId };
      }
    } catch {
      // Caída temporal del enlace LAN: respaldar en cola IndexedDB
    }
  }

  await enqueueOfflineOrder({
    orderId: txId,
    payload,
    source: 'pos',
  });

  return { deliveredToHost: false, queuedOffline: true, txId };
}

/**
 * Regla de resolución de conflictos Host-Authoritative:
 * Cuando existe un snapshot del dispositivo Host con epoch >= 1 y cambios pendientes,
 * el estado del Host manda y sobrescribe la versión previa de la nube.
 */
export function resolveHostConflictPriority(
  hostSnapshot: HostConflictSnapshot,
  cloudState: { hostEpoch?: number; updatedAt?: string } | null
): { winner: 'host'; reason: string; overwriteCloud: boolean } {
  if (!cloudState) {
    return {
      winner: 'host',
      reason: 'Sin estado previo en nube; el Host inicializa el nodo autoritativo en Firebase.',
      overwriteCloud: true,
    };
  }
  if (hostSnapshot.pendingSalesCount > 0 || hostSnapshot.hostEpoch >= (cloudState.hostEpoch || 0)) {
    return {
      winner: 'host',
      reason: `Política Host-Authoritative activa (epoch ${hostSnapshot.hostEpoch}, ${hostSnapshot.pendingSalesCount} ventas locales): el Host sobrescribe la nube.`,
      overwriteCloud: true,
    };
  }
  return {
    winner: 'host',
    reason: 'Política Host-Authoritative activa: el dispositivo Host mantiene precedencia operativa.',
    overwriteCloud: true,
  };
}
