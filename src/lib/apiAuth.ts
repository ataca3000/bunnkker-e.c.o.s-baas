/**
 * apiAuth.ts — Validador de sesión para API routes
 * Protege los endpoints contra acceso no autenticado.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export type ApiAuthResult =
  | { ok: true; uid: string; role: string }
  | { ok: false; response: NextResponse };

const WRITE_ROLES = ['superadmin', 'admin', 'inventory', 'sales', 'billing'];
const DELIVERY_ROLES = ['superadmin', 'admin', 'delivery', 'driver', 'carga_descarga'];

// ── Cookie Secret — NUNCA tiene fallback inseguro ─────────────────────────────
// Si INTERNAL_API_SECRET no está configurado en producción, el servidor falla
// explícitamente en lugar de usar un secreto conocido públicamente.
const COOKIE_SECRET = (() => {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || secret.trim() === '') {
    const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-export' || process.env.IS_BUILD === 'true';
    if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
      // En producción, un secreto ausente es un error fatal de configuración en ejecución.
      throw new Error(
        '[SECURITY] INTERNAL_API_SECRET no está configurado. ' +
        'Define esta variable de entorno antes de iniciar el servidor en producción.'
      );
    }
    return 'dev-only-secret-never-use-in-production-development';
  }
  return secret;
})();

/**
 * Genera una firma HMAC segura para un rol y UID dados.
 */
export function signRole(role: string, uid: string): string {
  return crypto.createHmac('sha256', COOKIE_SECRET).update(`${role}:${uid}`).digest('hex');
}

/**
 * Verifica la autenticidad de una firma de rol recibida.
 */
export function verifyRoleSignature(role: string, uid: string, signature: string): boolean {
  const expected = signRole(role, uid);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return expected === signature;
  }
}

/**
 * Valida que la petición tenga una sesión activa y una firma de rol válida.
 * Lee las cookies httpOnly seteadas por /api/auth/session.
 */
export function validateApiSession(request: NextRequest): ApiAuthResult {
  const session = request.cookies.get('msj-session')?.value;
  const role    = request.cookies.get('msj-role')?.value;
  const sig     = request.cookies.get('msj-role-sig')?.value;

  if (!session || !role || !sig || session === '' || !verifyRoleSignature(role, session, sig)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'No autorizado. Inicia sesión.' },
        { status: 401 }
      ),
    };
  }

  return { ok: true, uid: session, role };
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

export { WRITE_ROLES, DELIVERY_ROLES };

/**
 * Hashea un PIN usando SHA-256 de forma determinista para la columna 'pin' de la base de datos local.
 */
export function hashPinSha256(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

/**
 * Encripta un objeto JSON usando AES-256-CBC y el COOKIE_SECRET para enlaces mágicos seguros.
 */
export function encryptToken(data: any): string {
  const key = crypto.createHash('sha256').update(COOKIE_SECRET).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Desencripta un token AES-256-CBC seguro del enlace mágico.
 */
export function decryptToken(token: string): any {
  try {
    const [ivHex, encryptedHex] = token.split(':');
    if (!ivHex || !encryptedHex) return null;
    const key = crypto.createHash('sha256').update(COOKIE_SECRET).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (e) {
    return null;
  }
}
