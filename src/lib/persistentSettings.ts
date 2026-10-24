/**
 * persistentSettings.ts — Almacenamiento local persistente para configuración de sitio y agentes.
 * BUNKKER E.C.O.S. — Soberanía Local-First (Invariante #4 / P2)
 *
 * Garantiza que las configuraciones persistan en disco entre reinicios del servidor
 * o la aplicación de escritorio sin depender de internet ni de Firebase.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { atomicWriteFileSync } from './atomicFs';

function getStorageDir(): string {
  let baseDir: string;
  if (process.env.APPDATA) {
    baseDir = path.join(process.env.APPDATA, 'bunnkker-ecos', 'settings');
  } else {
    baseDir = path.join(process.cwd(), 'data', 'settings');
  }

  try {
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    return baseDir;
  } catch {
    // Fallback seguro para Vercel Serverless (Read-Only)
    try {
      const tmpDir = path.join(os.tmpdir(), 'bunnkker-ecos', 'settings');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return tmpDir;
    } catch {
      return os.tmpdir();
    }
  }
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
  const tmpPath = path.join(dir, `${cacheKey}.tmp.${Date.now()}`);

  const payload = {
    ...data,
    tenantId,
    updatedAt: new Date().toISOString()
  };

  memoryCache.set(cacheKey, payload);

  try {
    // Escritura atómica (write + rename) para prevenir corrupción de archivo en cortes de energía
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error(`[PERSISTENT SETTINGS] Error guardando ${filePath}:`, err);
    // Intento directo si falla el rename
    try {
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[PERSISTENT SETTINGS] Fallo crítico al escribir configuración:`, e);
    }
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
  const tmpPath = path.join(dir, `${cacheKey}.tmp.${Date.now()}`);

  memoryCache.set(cacheKey, configs);

  try {
    fs.writeFileSync(tmpPath, JSON.stringify(configs, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(configs, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[PERSISTENT SETTINGS] Fallo crítico al escribir configuraciones de agente:`, e);
    }
  }
}
