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

const COOKIE_SECRET = process.env.INTERNAL_API_SECRET || 'fallback-secret-key-12345';

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
