/**
 * salesCounter.ts — Contador Monotónico Anti-Tampering de Ventas para BUNKKER E.C.O.S.
 *
 * Reglas de Negocio:
 * - 0 a 100 ventas: Periodo de prueba VIP ilimitado y gratuito sin interrupciones.
 * - 100 a 119 ventas: Periodo de gracia / cortesía (+20 ventas de colchón sin frenar en seco).
 * - 120 ventas: Límite estricto de prueba. Requiere suscripción mensual ($349 MXN/mes).
 *
 * Invariante Anti-Tampering:
 * - El conteo acumulativo se almacena en disco con firma HMAC.
 * - Si el usuario borra órdenes de SQLite o vacía la base de datos de prueba,
 *   el contador histórico NUNCA se reinicia ni disminuye (Watermark Monotónico: Math.max).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { atomicWriteFileSync } from './atomicFs';

export const TRIAL_TARGET_SALES = 100;
export const GRACE_BUFFER_SALES = 20;
export const HARD_SALES_LIMIT = TRIAL_TARGET_SALES + GRACE_BUFFER_SALES; // 120

interface CounterData {
  tenantId: string;
  lifetimeSales: number;
  lastOrderAt: string;
  signature: string;
}

const COUNTER_SALT = process.env.SALES_COUNTER_SALT || 'bunkker-ecos-tamper-resistant-watermark-salt-2026';

function getStorageDir(): string {
  const candidates = [
    process.env.APPDATA ? path.join(process.env.APPDATA, 'bunnkker-ecos', 'security') : null,
    path.join(process.cwd(), 'data', 'security'),
    path.join(os.tmpdir(), 'bunnkker-ecos', 'security'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    } catch {
      // Continuar al siguiente candidato (ej. /tmp en Vercel Serverless cuando /var/task es Read-Only)
    }
  }
  return os.tmpdir();
}

function computeSignature(tenantId: string, count: number): string {
  return crypto
    .createHmac('sha256', COUNTER_SALT)
    .update(`${tenantId}:${count}:${COUNTER_SALT}`)
    .digest('hex');
}

function getCounterFilePath(tenantId: string): string {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getStorageDir(), `sales_watermark_${safeTenant}.dat`);
}

/**
 * Lee el contador histórico persistente desde disco.
 * Valida la firma HMAC para detectar manipulación manual del archivo.
 */
export function getPersistentSalesCount(tenantId: string = 'default'): number {
  const filePath = getCounterFilePath(tenantId);
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data: CounterData = JSON.parse(raw);
    const expectedSig = computeSignature(tenantId, data.lifetimeSales);

    // Si la firma no coincide (alguien editó el archivo manualmente),
    // no permitimos bajar el contador; asumimos que ya superó el límite.
    if (data.signature !== expectedSig) {
      console.warn(`[ANTI-TAMPERING] Discrepancia de firma en ${filePath}. Activando fail-closed.`);
      return HARD_SALES_LIMIT;
    }

    return Math.max(0, Number(data.lifetimeSales) || 0);
  } catch (err) {
    console.error(`[ANTI-TAMPERING] Error leyendo archivo de conteo ${filePath}:`, err);
    return 0;
  }
}

/**
 * Registra una nueva venta de forma monotónica e irreversible.
 * Garantiza atomicidad escribiendo primero a un archivo temporal con fsync.
 */
export function recordPersistentSale(tenantId: string = 'default', dbTotalSales: number = 0): {
  lifetimeSales: number;
  inGracePeriod: boolean;
  remainingGrace: number;
  isLocked: boolean;
} {
  const currentCount = getPersistentSalesCount(tenantId);
  // El nuevo conteo es estrictamente monotónico: nunca menor que el anterior ni que el de la BD
  const nextCount = Math.max(currentCount + 1, dbTotalSales);

  const payload: CounterData = {
    tenantId,
    lifetimeSales: nextCount,
    lastOrderAt: new Date().toISOString(),
    signature: computeSignature(tenantId, nextCount),
  };

  const filePath = getCounterFilePath(tenantId);

  try {
    atomicWriteFileSync(filePath, JSON.stringify(payload, null, 2), true);
  } catch (err) {
    console.error(`[ANTI-TAMPERING] Error guardando contador atómico en ${filePath}:`, err);
  }

  const inGracePeriod = nextCount >= TRIAL_TARGET_SALES && nextCount < HARD_SALES_LIMIT;
  const remainingGrace = Math.max(0, HARD_SALES_LIMIT - nextCount);
  const isLocked = nextCount >= HARD_SALES_LIMIT;

  return {
    lifetimeSales: nextCount,
    inGracePeriod,
    remainingGrace,
    isLocked,
  };
}

/**
 * Retorna el estado completo de ventas y límites de prueba.
 */
export function getSalesTrialStatus(tenantId: string = 'default', isSubscribed: boolean = false) {
  const lifetimeSales = getPersistentSalesCount(tenantId);

  // Si ya tiene suscripción mensual activa, no hay límite
  if (isSubscribed) {
    return {
      lifetimeSales,
      trialTarget: TRIAL_TARGET_SALES,
      hardLimit: HARD_SALES_LIMIT,
      isSubscribed: true,
      inGracePeriod: false,
      remainingGrace: 0,
      isLocked: false,
      message: 'Suscripción VIP Activa — Ventas Ilimitadas',
    };
  }

  const inGracePeriod = lifetimeSales >= TRIAL_TARGET_SALES && lifetimeSales < HARD_SALES_LIMIT;
  const remainingGrace = Math.max(0, HARD_SALES_LIMIT - lifetimeSales);
  const isLocked = lifetimeSales >= HARD_SALES_LIMIT;

  let message = 'Prueba VIP Activa';
  if (isLocked) {
    message = 'Límite de prueba alcanzado (120 ventas). Activa tu suscripción mensual para continuar.';
  } else if (inGracePeriod) {
    message = `¡Felicidades por tus 100 ventas! Tienes ${remainingGrace} ventas de cortesía antes de activar tu suscripción mensual ($349 MXN/mes).`;
  }

  return {
    lifetimeSales,
    trialTarget: TRIAL_TARGET_SALES,
    hardLimit: HARD_SALES_LIMIT,
    isSubscribed: false,
    inGracePeriod,
    remainingGrace,
    isLocked,
    message,
  };
}
