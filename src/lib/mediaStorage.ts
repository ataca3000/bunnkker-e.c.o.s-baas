/**
 * mediaStorage.ts — Almacenamiento soberano de archivos multimedia subidos
 * desde el Visual Storefront Builder (JPG, PNG, WEBP, GIF, MP4, WEBM).
 * Compatible con disco local (Electron/Node) y /tmp en despliegues Serverless (Vercel).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const SAFE_TENANT_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const SAFE_FILE_RE = /^[a-zA-Z0-9._-]{4,120}$/;

export function sanitizeTenantSegment(tenantId: string): string {
  const clean = (tenantId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return SAFE_TENANT_RE.test(clean) ? clean : 'default';
}

export function sanitizeFileName(fileName: string): string | null {
  const base = path.basename(fileName || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!base || base.includes('..') || !SAFE_FILE_RE.test(base)) return null;
  return base;
}

export function getMediaBaseDir(): string {
  const candidates = [
    process.env.APPDATA ? path.join(process.env.APPDATA, 'bunkker-ecos', 'uploads') : null,
    path.join(process.cwd(), 'data', 'uploads'),
    path.join(os.tmpdir(), 'bunkker-ecos', 'uploads'),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    } catch {
      // Fallback al siguiente directorio escribible
    }
  }
  return os.tmpdir();
}

export function getTenantMediaDir(tenantId: string): string {
  const safeTenant = sanitizeTenantSegment(tenantId);
  const dir = path.join(getMediaBaseDir(), safeTenant);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
};

export function extensionFromMime(mimeType: string): string | null {
  return MIME_TO_EXT[(mimeType || '').toLowerCase()] || null;
}

export function mimeFromFilename(filename: string): string {
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  return EXT_TO_MIME[ext] || 'application/octet-stream';
}

export function saveMediaBuffer(tenantId: string, mimeType: string, buffer: Buffer): { fileName: string; fullPath: string } {
  const ext = extensionFromMime(mimeType);
  if (!ext) {
    throw new Error('Tipo MIME no permitido.');
  }
  const fileName = `sb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dir = getTenantMediaDir(tenantId);
  const fullPath = path.join(dir, fileName);
  fs.writeFileSync(fullPath, buffer);
  return { fileName, fullPath };
}

export function resolveMediaFilePath(tenantId: string, rawFileName: string): string | null {
  const safeName = sanitizeFileName(rawFileName);
  if (!safeName) return null;
  const dir = getTenantMediaDir(tenantId);
  const fullPath = path.join(dir, safeName);
  if (!fullPath.startsWith(dir)) return null;
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}
