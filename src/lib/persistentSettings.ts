/**
 * persistentSettings.ts — Almacenamiento local persistente para configuración de sitio y agentes.
 * BUNKKER E.C.O.S. — Soberanía Local-First (Invariante #4 / P2)
 *
 * Garantiza que las configuraciones persistan en disco entre reinicios del servidor
 * o la aplicación de escritorio sin depender de internet ni de Firebase, con
 * fallback automático a os.tmpdir() (/tmp) en entornos Serverless Read-Only (Vercel).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { atomicWriteFileSync } from './atomicFs';

function getStorageDir(): string {
  const candidates = [
    process.env.APPDATA ? path.join(process.env.APPDATA, 'bunnkker-ecos', 'settings') : null,
    path.join(process.cwd(), 'data', 'settings'),
    path.join(os.tmpdir(), 'bunnkker-ecos', 'settings'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    } catch {
      // Continuar al siguiente candidato (ej. /tmp en Vercel cuando /var/task es Read-Only)
    }
  }
  return os.tmpdir();
}

const memoryCache = new Map<string, Record<string, any>>();

/**
 * Carga la configuración del sitio para un tenant desde caché en RAM o disco local.
 */
export function loadPersistentSiteConfig(tenantId: string = 'default'): Record<string, any> {
  const cacheKey = `site_config_${tenantId}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  const filePath = path.join(getStorageDir(), `${cacheKey}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      memoryCache.set(cacheKey, parsed);
      return parsed;
    } catch (err) {
      console.warn(`[PERSISTENT SETTINGS] Error leyendo ${filePath}:`, err);
    }
  }

  const initial = { tenantId };
  memoryCache.set(cacheKey, initial);
  return initial;
}

/**
 * Guarda la configuración del sitio de forma atómica en disco y actualiza la caché en RAM.
 */
export function savePersistentSiteConfig(tenantId: string = 'default', data: Record<string, any>): void {
  const cacheKey = `site_config_${tenantId}`;
  const dir = getStorageDir();
  const filePath = path.join(dir, `${cacheKey}.json`);

  const payload = {
    ...data,
    tenantId,
    updatedAt: new Date().toISOString()
  };

  memoryCache.set(cacheKey, payload);

  try {
    atomicWriteFileSync(filePath, JSON.stringify(payload, null, 2), true);
  } catch (err) {
    console.warn(`[PERSISTENT SETTINGS] Advertencia guardando ${filePath} (mantenido en RAM):`, err);
  }
}

/**
 * Carga configuraciones de agentes AI persistentes en modo local.
 */
export function loadPersistentAgentConfigs(tenantId: string = 'default'): Record<string, any> {
  const cacheKey = `ai_agents_${tenantId}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  const filePath = path.join(getStorageDir(), `${cacheKey}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      memoryCache.set(cacheKey, parsed);
      return parsed;
    } catch (err) {
      console.warn(`[PERSISTENT SETTINGS] Error leyendo ${filePath}:`, err);
    }
  }

  const initial = {};
  memoryCache.set(cacheKey, initial);
  return initial;
}

/**
 * Guarda configuraciones de agentes AI persistentes en disco.
 */
export function savePersistentAgentConfigs(tenantId: string = 'default', configs: Record<string, any>): void {
  const cacheKey = `ai_agents_${tenantId}`;
  const dir = getStorageDir();
  const filePath = path.join(dir, `${cacheKey}.json`);

  memoryCache.set(cacheKey, configs);

  try {
    atomicWriteFileSync(filePath, JSON.stringify(configs, null, 2), true);
  } catch (err) {
    console.warn(`[PERSISTENT SETTINGS] Advertencia guardando configuración de agentes (mantenido en RAM):`, err);
  }
}

function sanitizeNamespaceKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Carga un documento JSON arbitrario persistente por namespace y tenantId.
 */
export function loadPersistentJson<T>(
  namespace: string,
  tenantId: string = 'default',
  fallback: T
): T {
  const safeNs = sanitizeNamespaceKey(namespace);
  const safeTenant = sanitizeNamespaceKey(tenantId || 'default');
  const cacheKey = `${safeNs}_${safeTenant}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) as unknown as T;
  }

  const filePath = path.join(getStorageDir(), `${cacheKey}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as T;
      memoryCache.set(cacheKey, parsed as unknown as Record<string, any>);
      return parsed;
    } catch (err) {
      console.warn(`[PERSISTENT SETTINGS] Error leyendo ${filePath}:`, err);
    }
  }

  memoryCache.set(cacheKey, fallback as unknown as Record<string, any>);
  return fallback;
}

/**
 * Guarda de forma atómica un documento JSON persistente por namespace y tenantId.
 */
export function savePersistentJson<T>(
  namespace: string,
  tenantId: string = 'default',
  data: T
): void {
  const safeNs = sanitizeNamespaceKey(namespace);
  const safeTenant = sanitizeNamespaceKey(tenantId || 'default');
  const cacheKey = `${safeNs}_${safeTenant}`;
  const dir = getStorageDir();
  const filePath = path.join(dir, `${cacheKey}.json`);

  memoryCache.set(cacheKey, data as unknown as Record<string, any>);

  try {
    atomicWriteFileSync(filePath, JSON.stringify(data, null, 2), true);
  } catch (err) {
    console.warn(`[PERSISTENT SETTINGS] Advertencia guardando ${filePath} (mantenido en RAM):`, err);
  }
}

