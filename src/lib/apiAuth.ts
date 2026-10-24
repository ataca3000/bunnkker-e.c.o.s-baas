/**
 * apiAuth.ts — Validador de sesión para API routes
 * Protege los endpoints contra acceso no autenticado.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export type ApiAuthResult =
  | { ok: true; uid: string; role: string; tenantId?: string }
  | { ok: false; response: NextResponse };

const WRITE_ROLES = ['superadmin', 'admin', 'inventory', 'sales', 'billing'];
const DELIVERY_ROLES = ['superadmin', 'admin', 'delivery', 'driver', 'carga_descarga'];

// ── Cookie Secret — sincronizado determinísticamente con middleware.ts (Edge + Node) ──
const _envSecret = process.env.INTERNAL_API_SECRET || process.env.JWT_SECRET;
const COOKIE_SECRET = _envSecret || 'bunkker-ecos-default-local-dev-secret-key-2026';

/**
 * Extrae el tenantId de la request de forma centralizada.
 * El middleware lo inyecta en 'x-tenant-id' desde el subdominio.
 */
export function getTenantId(request: NextRequest): string {
  return request.headers.get('x-tenant-id') || 'default';
}

/**
 * Genera un entero aleatorio seguro dentro de un rango.
 */
export function generateSecureRandomInt(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new Error('Invalid random range');
  }
  return crypto.randomInt(min, max + 1);
}

/**
 * Genera una firma HMAC segura para un tenantId, rol y UID dados.
 */
export function signRole(role: string, uid: string, tenantId: string = 'default'): string {
  return crypto.createHmac('sha256', COOKIE_SECRET).update(`${tenantId}:${role}:${uid}`).digest('hex');
}

export function verifyRoleSignature(role: string, uid: string, signature: string, tenantId: string = 'default'): boolean {
  if (!signature) return false;
  const expectedScoped = signRole(role, uid, tenantId);

  const checkMatch = (expected: string) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return expected === signature;
    }
  };

  if (checkMatch(expectedScoped)) return true;

  // Compatibilidad con firma simple únicamente en tenant 'default'
  if (tenantId === 'default') {
    const expectedLegacy = crypto.createHmac('sha256', COOKIE_SECRET).update(`${role}:${uid}`).digest('hex');
    return checkMatch(expectedLegacy);
  }
  return false;
}

/**
 * Valida que la petición tenga una sesión activa y una firma de rol válida.
 */
export function validateApiSession(request: NextRequest): ApiAuthResult {
  const session = request.cookies.get('msj-session')?.value;
  const role    = request.cookies.get('msj-role')?.value;
  const sig     = request.cookies.get('msj-role-sig')?.value;
  const tenantId = getTenantId(request);

  if (!session || !role || !sig || session === '' || !verifyRoleSignature(role, session, sig, tenantId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'No autorizado. Inicia sesión.' },
        { status: 401 }
      ),
    };
  }

  return { ok: true, uid: session, role, tenantId };
}

/**
 * Valida sesión Y que el rol esté en la lista de permitidos.
 */
export function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): ApiAuthResult {
  const auth = validateApiSession(request);
  if (!auth.ok) return auth;

  if (!allowedRoles.includes(auth.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: `Acceso denegado. Rol requerido: ${allowedRoles.join(' | ')}` },
        { status: 403 }
      ),
    };
  }

  return auth;
}

/**
 * Valida de forma estricta contra la base de datos que el usuario exista,
 * esté activo (active: true) y que su rol en BD coincida con el rol firmado.
 * SEGURIDAD FAIL-CLOSED: Si la base de datos falla o no responde, NUNCA permite el acceso.
 */
export async function validateActiveDbUser(
  request: NextRequest,
  prismaInstance?: any
): Promise<ApiAuthResult> {
  const auth = validateApiSession(request);
  if (!auth.ok) return auth;

  try {
    const db = prismaInstance || (await import('@/lib/prisma')).prisma;
    const user = await db.user.findUnique({
      where: { id: auth.uid },
      select: { id: true, role: true, active: true, tenantId: true }
    });

    if (!user || !user.active) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'Usuario inexistente o cuenta suspendida.' },
          { status: 401 }
        )
      };
    }

    if (user.role !== auth.role) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'Conflicto de autorización: el rol ha cambiado. Inicia sesión nuevamente.' },
          { status: 403 }
        )
      };
    }

    return { ok: true, uid: user.id, role: user.role, tenantId: user.tenantId };
  } catch (error: any) {
    console.error('[AUTH FAIL-CLOSED] Fallo al validar usuario en SQLite:', error?.message);
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Servicio no disponible: No se pudo verificar la identidad en la base de datos local.' },
        { status: 503 }
      )
    };
  }
}

/**
 * Valida sesión en vivo contra la base de datos Y exige roles autorizados.
 */
export async function requireActiveRole(
  request: NextRequest,
  allowedRoles: string[],
  prismaInstance?: any
): Promise<ApiAuthResult> {
  const auth = await validateActiveDbUser(request, prismaInstance);
  if (!auth.ok) return auth;

  if (!allowedRoles.includes(auth.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: `Acceso denegado. Rol requerido: ${allowedRoles.join(' | ')}` },
        { status: 403 }
      ),
    };
  }

  return auth;
}

export { WRITE_ROLES, DELIVERY_ROLES };

/**
 * Hashea un PIN usando SHA-256 de forma determinista para la columna 'pin' de la base de datos local.
 */
export function hashPinSha256(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

/**
 * Encripta un objeto JSON usando AES-256-GCM autenticado y el COOKIE_SECRET para enlaces mágicos seguros.
 */
export function encryptToken(data: any): string {
  const key = crypto.createHash('sha256').update(COOKIE_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Desencripta un token AES-256-GCM autenticado del enlace mágico.
 */
export function decryptToken(token: string): any {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!ivHex || !authTagHex || !encryptedHex) return null;
    const key = crypto.createHash('sha256').update(COOKIE_SECRET).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}
