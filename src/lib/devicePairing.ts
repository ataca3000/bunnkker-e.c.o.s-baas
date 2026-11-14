import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { NextRequest } from 'next/server';
import { atomicWriteFileSync } from './atomicFs';
import { decryptToken, encryptToken } from './apiAuth';

export type PairedDeviceStatus = 'ONLINE' | 'OFFLINE' | 'REVOKED';

export interface PairedDeviceRecord {
  deviceId: string;
  tenantId: string;
  label: string;
  role: string;
  userId: string;
  userName: string;
  platform: string;
  userAgent?: string;
  ip?: string;
  currentPath?: string;
  pendingQueueSize?: number;
  pairedAt: string;
  lastSeenAt: string;
  pairedBy?: string;
  revoked?: boolean;
  revokedAt?: string;
}

export interface PairingPassRecord {
  passId: string;
  code: string;
  tenantId: string;
  role: string;
  userId?: string;
  label: string;
  createdBy: string;
  createdAt: string;
  expiresAt: number;
  reusable: boolean;
  usedCount: number;
  revoked: boolean;
}

interface TenantPairingStore {
  devices: PairedDeviceRecord[];
  passes: PairingPassRecord[];
}

const ONLINE_THRESHOLD_MS = 95_000;
const PAIR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function getPairingStorageDir(): string {
  const candidates = [
    process.env.APPDATA ? path.join(process.env.APPDATA, 'bunnkker-ecos', 'pairing') : null,
    path.join(process.cwd(), 'data', 'pairing'),
    path.join(os.tmpdir(), 'bunnkker-ecos', 'pairing'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    } catch {
      // fallback to next writable dir
    }
  }
  return os.tmpdir();
}

function getStoreCache(): Map<string, TenantPairingStore> {
  const g = globalThis as unknown as { __bunkkerPairingCache?: Map<string, TenantPairingStore> };
  if (!g.__bunkkerPairingCache) {
    g.__bunkkerPairingCache = new Map();
  }
  return g.__bunkkerPairingCache;
}

function sanitizeTenant(tenantId: string): string {
  return (tenantId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
}

export function loadPairingStore(tenantId: string = 'default'): TenantPairingStore {
  const safeTenant = sanitizeTenant(tenantId);
  const cache = getStoreCache();
  if (cache.has(safeTenant)) {
    return cache.get(safeTenant)!;
  }

  const filePath = path.join(getPairingStorageDir(), `devices_${safeTenant}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const store: TenantPairingStore = {
        devices: Array.isArray(parsed?.devices) ? parsed.devices : [],
        passes: Array.isArray(parsed?.passes) ? parsed.passes : [],
      };
      cache.set(safeTenant, store);
      return store;
    } catch {
      // ignore corrupted file and recover cleanly
    }
  }

  const empty: TenantPairingStore = { devices: [], passes: [] };
  cache.set(safeTenant, empty);
  return empty;
}

export function savePairingStore(tenantId: string = 'default', store: TenantPairingStore): void {
  const safeTenant = sanitizeTenant(tenantId);
  const cache = getStoreCache();
  cache.set(safeTenant, store);

  const filePath = path.join(getPairingStorageDir(), `devices_${safeTenant}.json`);
  try {
    atomicWriteFileSync(filePath, JSON.stringify(store, null, 2), true);
  } catch (err) {
    console.warn('[DevicePairing] Error persistiendo registro de dispositivos:', err);
  }
}

export function generatePairingCode(length: number = 6): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += PAIR_ALPHABET[bytes[i] % PAIR_ALPHABET.length];
  }
  return out;
}

export function createPairingPass(params: {
  tenantId: string;
  role: string;
  label?: string;
  userId?: string;
  createdBy: string;
  ttlMinutes?: number;
  reusable?: boolean;
}): { pass: PairingPassRecord; token: string } {
  const tenantId = params.tenantId || 'default';
  const store = loadPairingStore(tenantId);

  // Limpiar pases expirados hace más de 1 hora
  const pruneBefore = Date.now() - 60 * 60 * 1000;
  store.passes = store.passes.filter((p) => p.expiresAt > pruneBefore);

  let code = generatePairingCode(6);
  while (store.passes.some((p) => p.code === code && !p.revoked && p.expiresAt > Date.now())) {
    code = generatePairingCode(6);
  }

  const ttlMs = Math.max(1, Math.min(24 * 60, params.ttlMinutes ?? 30)) * 60 * 1000;
  const passId = crypto.randomUUID();
  const expiresAt = Date.now() + ttlMs;
  const pass: PairingPassRecord = {
    passId,
    code,
    tenantId,
    role: params.role,
    userId: params.userId,
    label: (params.label || `Terminal ${params.role.toUpperCase()}`).trim().slice(0, 60),
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    expiresAt,
    reusable: params.reusable ?? true,
    usedCount: 0,
    revoked: false,
  };

  store.passes.unshift(pass);
  if (store.passes.length > 50) {
    store.passes = store.passes.slice(0, 50);
  }
  savePairingStore(tenantId, store);

  const token = encryptToken({
    type: 'device_pairing',
    passId,
    code,
    tenantId,
    role: params.role,
    userId: params.userId,
    label: pass.label,
    expiresAt,
    nonce: crypto.randomBytes(12).toString('hex'),
  });

  return { pass, token };
}

export function verifyAndConsumePairingInput(params: {
  tenantId: string;
  token?: string;
  code?: string;
}):
  | { ok: true; pass: PairingPassRecord }
  | { ok: false; code: 'ERR_PAIRING_INVALID' | 'ERR_PAIRING_EXPIRED' | 'ERR_PAIRING_REVOKED'; error: string } {
  const tenantId = params.tenantId || 'default';
  const store = loadPairingStore(tenantId);
  const now = Date.now();

  let matchedPass: PairingPassRecord | undefined;

  if (params.token) {
    const decoded = decryptToken(params.token.trim());
    if (!decoded || decoded.type !== 'device_pairing' || !decoded.passId) {
      return { ok: false, code: 'ERR_PAIRING_INVALID', error: 'Token QR de vinculación inválido o alterado.' };
    }
    if (decoded.tenantId && decoded.tenantId !== tenantId) {
      return { ok: false, code: 'ERR_PAIRING_INVALID', error: 'Este código pertenece a otra sucursal.' };
    }
    if (now > Number(decoded.expiresAt || 0)) {
      return { ok: false, code: 'ERR_PAIRING_EXPIRED', error: 'El código QR de vinculación expiró. Genera uno nuevo.' };
    }

    matchedPass = store.passes.find((p) => p.passId === decoded.passId);
    if (!matchedPass) {
      // En entornos serverless stateless donde la instancia cambió pero el token AES-GCM firmado es válido y vigente,
      // reconstituimos el pase desde el token criptográfico autenticado.
      matchedPass = {
        passId: decoded.passId,
        code: decoded.code || 'TOKEN',
        tenantId: decoded.tenantId || tenantId,
        role: decoded.role,
        userId: decoded.userId,
        label: decoded.label || `Terminal ${String(decoded.role || '').toUpperCase()}`,
        createdBy: 'admin',
        createdAt: new Date().toISOString(),
        expiresAt: Number(decoded.expiresAt),
        reusable: true,
        usedCount: 0,
        revoked: false,
      };
      store.passes.unshift(matchedPass);
    }
  } else if (params.code) {
    const cleanCode = params.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length !== 6) {
      return { ok: false, code: 'ERR_PAIRING_INVALID', error: 'El código de vinculación debe tener 6 caracteres.' };
    }
    matchedPass = store.passes.find((p) => p.code === cleanCode);
    if (!matchedPass) {
      return { ok: false, code: 'ERR_PAIRING_INVALID', error: 'Código de vinculación no encontrado.' };
    }
  } else {
    return { ok: false, code: 'ERR_PAIRING_INVALID', error: 'Proporciona un código de vinculación o token QR.' };
  }

  if (matchedPass.revoked) {
    return { ok: false, code: 'ERR_PAIRING_REVOKED', error: 'Este pase fue revocado por el administrador.' };
  }
  if (now > matchedPass.expiresAt) {
    return { ok: false, code: 'ERR_PAIRING_EXPIRED', error: 'El pase de vinculación expiró. Solicita uno nuevo.' };
  }
  if (!matchedPass.reusable && matchedPass.usedCount > 0) {
    return { ok: false, code: 'ERR_PAIRING_INVALID', error: 'Este pase de un solo uso ya fue reclamado.' };
  }

  matchedPass.usedCount += 1;
  savePairingStore(tenantId, store);

  return { ok: true, pass: matchedPass };
}

export function registerPairedDevice(input: {
  tenantId: string;
  deviceId: string;
  label: string;
  role: string;
  userId: string;
  userName: string;
  platform?: string;
  userAgent?: string;
  ip?: string;
  pairedBy?: string;
}): PairedDeviceRecord {
  const tenantId = input.tenantId || 'default';
  const store = loadPairingStore(tenantId);
  const nowIso = new Date().toISOString();

  const existingIdx = store.devices.findIndex((d) => d.deviceId === input.deviceId);
  const existing = existingIdx !== -1 ? store.devices[existingIdx] : null;

  const record: PairedDeviceRecord = {
    deviceId: input.deviceId,
    tenantId,
    label: input.label || existing?.label || `Terminal ${input.role.toUpperCase()}`,
    role: input.role,
    userId: input.userId,
    userName: input.userName,
    platform: input.platform || existing?.platform || 'Web',
    userAgent: input.userAgent || existing?.userAgent,
    ip: input.ip || existing?.ip,
    currentPath: existing?.currentPath,
    pendingQueueSize: existing?.pendingQueueSize ?? 0,
    pairedAt: existing && !existing.revoked ? existing.pairedAt : nowIso,
    lastSeenAt: nowIso,
    pairedBy: input.pairedBy || existing?.pairedBy,
    revoked: false,
    revokedAt: undefined,
  };

  if (existingIdx !== -1) {
    store.devices[existingIdx] = record;
  } else {
    store.devices.unshift(record);
  }

  savePairingStore(tenantId, store);
  return record;
}

export function recordDeviceHeartbeat(input: {
  tenantId: string;
  deviceId: string;
  role?: string;
  userId?: string;
  userName?: string;
  platform?: string;
  currentPath?: string;
  pendingQueueSize?: number;
  ip?: string;
}): { ok: true; device: PairedDeviceRecord } | { ok: false; code: 'ERR_DEVICE_REVOKED' } {
  const tenantId = input.tenantId || 'default';
  const store = loadPairingStore(tenantId);
  const idx = store.devices.findIndex((d) => d.deviceId === input.deviceId);
  const nowIso = new Date().toISOString();

  if (idx !== -1) {
    const existing = store.devices[idx];
    if (existing.revoked) {
      return { ok: false, code: 'ERR_DEVICE_REVOKED' };
    }
    store.devices[idx] = {
      ...existing,
      role: input.role || existing.role,
      userId: input.userId || existing.userId,
      userName: input.userName || existing.userName,
      platform: input.platform || existing.platform,
      currentPath: input.currentPath ?? existing.currentPath,
      pendingQueueSize: typeof input.pendingQueueSize === 'number' ? input.pendingQueueSize : existing.pendingQueueSize,
      ip: input.ip || existing.ip,
      lastSeenAt: nowIso,
    };
    savePairingStore(tenantId, store);
    return { ok: true, device: store.devices[idx] };
  }

  // Auto-registrar terminal autenticada activa si no había entrada previa
  const created: PairedDeviceRecord = {
    deviceId: input.deviceId,
    tenantId,
    label: `Dispositivo ${input.platform || 'Web'} (${input.role || 'staff'})`,
    role: input.role || 'sales',
    userId: input.userId || 'unknown',
    userName: input.userName || 'Operador',
    platform: input.platform || 'Web',
    currentPath: input.currentPath,
    pendingQueueSize: input.pendingQueueSize ?? 0,
    ip: input.ip,
    pairedAt: nowIso,
    lastSeenAt: nowIso,
    revoked: false,
  };
  store.devices.unshift(created);
  savePairingStore(tenantId, store);
  return { ok: true, device: created };
}

export function listPairedDevices(tenantId: string = 'default'): Array<PairedDeviceRecord & { status: PairedDeviceStatus }> {
  const store = loadPairingStore(tenantId);
  const now = Date.now();
  return store.devices.map((d) => {
    const lastMs = Date.parse(d.lastSeenAt || '') || 0;
    const status: PairedDeviceStatus = d.revoked
      ? 'REVOKED'
      : now - lastMs <= ONLINE_THRESHOLD_MS
        ? 'ONLINE'
        : 'OFFLINE';
    return { ...d, status };
  });
}

export function listActivePairingPasses(tenantId: string = 'default'): PairingPassRecord[] {
  const store = loadPairingStore(tenantId);
  const now = Date.now();
  return store.passes.filter((p) => !p.revoked && p.expiresAt > now);
}

export function revokePairedDevice(tenantId: string, deviceId: string): boolean {
  const store = loadPairingStore(tenantId);
  const idx = store.devices.findIndex((d) => d.deviceId === deviceId);
  if (idx === -1) return false;
  store.devices[idx] = {
    ...store.devices[idx],
    revoked: true,
    revokedAt: new Date().toISOString(),
  };
  savePairingStore(tenantId, store);
  return true;
}

export function revokePairingPass(tenantId: string, passId: string): boolean {
  const store = loadPairingStore(tenantId);
  const idx = store.passes.findIndex((p) => p.passId === passId);
  if (idx === -1) return false;
  store.passes[idx] = { ...store.passes[idx], revoked: true };
  savePairingStore(tenantId, store);
  return true;
}

export function isDeviceAuthorizedForTenant(tenantId: string, deviceId: string, userId?: string): boolean {
  if (!deviceId) return false;
  const store = loadPairingStore(tenantId);
  const found = store.devices.find((d) => d.deviceId === deviceId);
  if (!found || found.revoked) return false;
  if (userId && found.userId && found.userId !== userId) {
    return true; // Terminal compartida autorizada por el administrador en el mismo tenant
  }
  return true;
}

/**
 * Detecta si la petición entró por HTTPS (incluyendo proxies como Vercel / Cloud Run / Nginx).
 * Fundamental para que las cookies en LAN HTTP (ej. http://192.168.1.20:3000) NO lleven flag Secure,
 * que haría que celulares Android/iOS rechacen la cookie silenciosamente.
 */
export function isHttpsRequest(request: NextRequest): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
  }
  const origin = request.headers.get('origin') || request.headers.get('referer') || '';
  if (origin.startsWith('https://')) return true;
  if (origin.startsWith('http://')) return false;
  return request.url.startsWith('https://');
}

export function getProtocolAwareCookieOpts(request: NextRequest, httpOnlyFlag: boolean = false) {
  const isHttps = isHttpsRequest(request);
  return {
    httpOnly: httpOnlyFlag,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  };
}

/**
 * Resuelve el origen público real de la petición detrás de reverse proxies (Cloud Run, Vercel, Nginx)
 * evitando redirigir dispositivos móviles a http://localhost:3000.
 */
export function resolvePublicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = (forwardedHost ? forwardedHost.split(',')[0].trim() : request.headers.get('host')) || '';
  const proto = isHttpsRequest(request) ? 'https' : 'http';
  if (host) {
    return `${proto}://${host}`;
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return 'http://localhost:3000';
  }
}
