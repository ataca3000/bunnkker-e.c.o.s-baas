import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── HMAC inline (Edge-compatible via Web Crypto API) ─────────────────────────
// No importamos de @/lib/apiAuth para evitar el warning de Node crypto en Edge.
// Usamos SubtleCrypto que está disponible en todos los runtimes (Edge, Node, browser).

// ── Cookie Secret — igual que apiAuth.ts, NUNCA tiene fallback inseguro ───────
// Edge runtime no puede usar Node crypto, por lo que la validación se hace con
// SubtleCrypto (Web Crypto API). El secreto se resuelve en tiempo de ejecución.
const COOKIE_SECRET = (() => {
  const s = process.env.INTERNAL_API_SECRET;
  if (!s || s.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      // En producción, un secreto ausente es un error de despliegue.
      // Devolvemos un valor vacío pero todas las verificaciones HMAC fallarán,
      // lo que redirigirá a /login — comportamiento seguro por defecto.
      console.error('[SECURITY] INTERNAL_API_SECRET no configurado en producción. Todas las sesiones serán rechazadas.');
      return '';
    }
    return 'dev-only-secret-never-use-in-production-development';
  }
  return s;
})();

function hexToUint8Array(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0) return null;
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (isNaN(byte)) return null;
    arr[i] = byte;
  }
  return arr;
}

async function verifyHmac(role: string, uid: string, sig: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(COOKIE_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = hexToUint8Array(sig);
    if (!sigBytes) return false;
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(`${role}:${uid}`));
  } catch {
    return false;
  }
}

// ─── RBAC permissions ─────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard/guia':      ['superadmin'],
  '/dashboard/inventory': ['superadmin', 'inventory'],
  '/dashboard/sales':     ['superadmin', 'sales'],
  '/dashboard/admin/sales': ['superadmin', 'sales'],
  '/dashboard/admin/customers': ['superadmin', 'sales'],
  '/dashboard/audit':     ['superadmin', 'billing'],
  '/dashboard/billing':   ['superadmin', 'billing'],
  '/dashboard/users':     ['superadmin'],
  '/dashboard/admin/users': ['superadmin'],
  '/dashboard/patio':     ['superadmin', 'carga_descarga', 'driver', 'delivery', 'inventory'],
  '/dashboard/pickup':    ['superadmin', 'carga_descarga', 'driver', 'delivery', 'inventory'],
  '/dashboard/delivery':  ['superadmin', 'driver', 'delivery', 'carga_descarga'],
  '/dashboard/marketing': ['superadmin', 'marketing'],
  '/dashboard/design':    ['superadmin', 'marketing'],
  '/dashboard/reports':   ['superadmin'],
  '/dashboard/qr':        ['superadmin', 'marketing', 'sales'],
  '/dashboard/demo':      ['superadmin'],
  '/dashboard/suscripcion': ['superadmin'],
  '/dashboard/tests':     ['superadmin'],
};

const PUBLIC_DOMAINS = [
  'admin.com',
  'localhost:3000',
  'www.admin.com',
  'admin-com-erp.vercel.app',
];

export default async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // --- 0. FIREWALL: Bloqueo de Túneles Públicos (Bypass para trabajadores por IP Virtual) ---
  // Las rutas de administración y endpoints sensibles están protegidas
  const isProtectedPath = pathname.startsWith('/dashboard') || pathname.startsWith('/api/users');
  
  // Expresión regular para detectar si el host es una IP local (ej. 192.168.1.5), mDNS (.local) o localhost
  const isLocalHostOrIP = /^localhost(:\d+)?$/.test(hostname) || 
                          hostname.endsWith('.local') ||
                          /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(:\d+)?$/.test(hostname) ||
                          /^127\.0\.0\.1(:\d+)?$/.test(hostname);

  // Si acceden a administración, forzar que sea local o solo permitir al superadmin de forma remota
  if (isProtectedPath) {
    const session = request.cookies.get('msj-session')?.value;
    const role    = request.cookies.get('msj-role')?.value;
    const sig     = request.cookies.get('msj-role-sig')?.value;

    let isSuperAdmin = false;
    if (session && role && sig) {
      const validSig = await verifyHmac(role, session, sig);
      if (validSig && role === 'superadmin') {
        isSuperAdmin = true;
      }
    }

    // Bloquear acceso a trabajadores fuera de la red local (WiFi/LAN física de la sucursal)
    if (!isLocalHostOrIP && !isSuperAdmin) {
      console.warn(`[FIREWALL] Acceso denegado a la ruta administrativa ${pathname} desde túnel externo (${hostname}). Requiere conexión local Wi-Fi/LAN de la sucursal.`);
      return NextResponse.redirect(new URL('/catalogo', request.url));
    }
  }

  // --- 1. MULTI-TENANT ---
  let tenantId = 'default';
  if (hostname.includes('.admin.com') && !PUBLIC_DOMAINS.includes(hostname)) {
    tenantId = hostname.split('.')[0];
  } else if (searchParams.has('tenant')) {
    tenantId = searchParams.get('tenant')!;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', tenantId);

  // --- 2. RBAC ---
  if (pathname.startsWith('/dashboard')) {
    const session = request.cookies.get('msj-session')?.value;
    const role    = request.cookies.get('msj-role')?.value;
    const sig     = request.cookies.get('msj-role-sig')?.value;

    if (!session || !role || !sig) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const valid = await verifyHmac(role, session, sig);
    if (!valid) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (role === 'superadmin') {
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      res.headers.set('x-tenant-id', tenantId);
      return res;
    }

    const matchedEntry = Object.entries(ROLE_PERMISSIONS).find(
      ([path]) => pathname.startsWith(path) && path !== '/dashboard'
    );

    if (matchedEntry) {
      const requiredRoles = matchedEntry[1];
      if (!requiredRoles.includes(role)) {
        return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
      }
    } else if (pathname === '/dashboard') {
      if (role !== 'superadmin') {
        const primaryPath = Object.entries(ROLE_PERMISSIONS).find(
          ([_, roles]) => roles.includes(role)
        )?.[0];
        if (primaryPath) return NextResponse.redirect(new URL(primaryPath, request.url));
        return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
      }
    } else if (role !== 'superadmin') {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-tenant-id', tenantId);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
