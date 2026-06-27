import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── HMAC inline (Edge-compatible via Web Crypto API) ─────────────────────────
// No importamos de @/lib/apiAuth para evitar el warning de Node crypto en Edge.
// Usamos SubtleCrypto que está disponible en todos los runtimes (Edge, Node, browser).

const COOKIE_SECRET = process.env.INTERNAL_API_SECRET || 'fallback-secret-key-12345';

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
  '/dashboard/inventory': ['superadmin', 'admin', 'inventory'],
  '/dashboard/sales':     ['superadmin', 'admin', 'sales'],
  '/dashboard/admin/sales': ['superadmin', 'admin', 'sales'],
  '/dashboard/admin/customers': ['superadmin', 'admin', 'sales'],
  '/dashboard/audit':     ['superadmin', 'admin', 'billing'],
  '/dashboard/billing':   ['superadmin', 'admin', 'billing'],
  '/dashboard/users':     ['superadmin', 'admin'],
  '/dashboard/admin/users': ['superadmin', 'admin'],
  '/dashboard/patio':     ['superadmin', 'carga_descarga', 'driver', 'delivery', 'inventory'],
  '/dashboard/pickup':    ['superadmin', 'carga_descarga', 'driver', 'delivery', 'inventory'],
  '/dashboard/delivery':  ['superadmin', 'driver', 'delivery', 'carga_descarga'],
  '/dashboard/marketing': ['superadmin', 'marketing', 'admin'],
  '/dashboard/design':    ['superadmin', 'marketing', 'admin'],
  '/dashboard/reports':   ['superadmin'],
  '/dashboard/qr':        ['superadmin', 'admin', 'marketing', 'sales'],
  '/dashboard/demo':      ['superadmin', 'admin'],
  '/dashboard/suscripcion': ['superadmin', 'admin'],
  '/dashboard/tests':     ['superadmin', 'admin'],
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

  // --- 0. FIREWALL: Bloqueo de Túneles Públicos ---
  // Si se accede mediante un dominio de túnel (ngrok, localtunnel, etc.) bloqueamos rutas de admin
  const isProtectedPath = pathname.startsWith('/dashboard') || pathname.startsWith('/login') || pathname.startsWith('/api/users');
  
  // Expresión regular para detectar si el host es una IP (ej. 192.168.1.5) o localhost
  const isLocalHostOrIP = /^localhost(:\d+)?$/.test(hostname) || /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(:\d+)?$/.test(hostname);
  
  if (!isLocalHostOrIP && isProtectedPath) {
    console.warn(`[FIREWALL] Bloqueando intento de acceso desde túnel público (${hostname}) a la ruta ${pathname}`);
    return NextResponse.redirect(new URL('/catalogo', request.url));
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
      if (role !== 'superadmin' && role !== 'admin') {
        const primaryPath = Object.entries(ROLE_PERMISSIONS).find(
          ([_, roles]) => roles.includes(role)
        )?.[0];
        if (primaryPath) return NextResponse.redirect(new URL(primaryPath, request.url));
        return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
      }
    } else if (role !== 'superadmin' && role !== 'admin') {
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
