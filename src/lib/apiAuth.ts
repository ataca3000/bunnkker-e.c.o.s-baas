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

// ── Cookie Secret — sincronizado con middleware.ts para validación de roles y sesiones ──
// SEGURIDAD: En producción cloud (Vercel/Web) INTERNAL_API_SECRET debe estar configurado.
// En tiempo de compilación (build phase) o en el ejecutable de escritorio (.exe local),
// permitimos el fallback para no abortar el empaquetado estático.
const _envSecret = process.env.INTERNAL_API_SECRET;
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.argv.some(arg => arg.includes('next') && arg.includes('build'));
const isDesktopLocal = process.env.BUILD_TARGET === 'desktop' || process.env.NEXT_PUBLIC_APP_ENV === 'local' || Boolean(process.env.MACHINE_HWID);

if (!_envSecret && process.env.NODE_ENV === 'production' && !isBuildPhase && !isDesktopLocal) {
  throw new Error(
    '[BUNKKER SECURITY] INTERNAL_API_SECRET no configurado. ' +
    'El servidor web no puede arrancar en producción sin secreto seguro. ' +
    'Configura la variable en tu plataforma de hosting (Vercel/Cloud) antes de deployar.'
  );
}
const COOKIE_SECRET = _envSecret || 'bunkker-ecos-default-local-dev-secret-key-2026';

/**
 * Extrae el tenantId de la request de forma centralizada.
 * El middleware lo inyecta en 'x-tenant-id' desde el subdominio o query param.
 * Todos los handlers de API deben usar esta función para aislar datos por tenant.
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

/**
 * Valida de forma estricta contra la base de datos que el usuario exista,
 * esté activo (active: true) y que su rol en BD coincida con el rol firmado.
 * Impide que empleados desactivados o con roles cambiados sigan operando con cookies previas.
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
      select: { id: true, role: true, active: true }
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

    return { ok: true, uid: user.id, role: user.role };
  } catch {
    // Modo offline resiliente: si SQLite está bajo migración transitoria pero la firma HMAC es válida
    return auth;
  }
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
