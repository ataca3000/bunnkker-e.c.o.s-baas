import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Comparación segura en tiempo constante compatible con Edge Runtime (sin import 'crypto')
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// 🛡️ Permisos por rol y ruta
const ROLE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard/inventory':       ['superadmin', 'admin', 'inventory', 'almacen'],
  '/dashboard/sales':           ['superadmin', 'admin', 'sales', 'caja'],
  '/dashboard/admin/sales':     ['superadmin', 'admin', 'sales', 'caja'],
  '/dashboard/admin/customers': ['superadmin', 'admin', 'sales', 'caja'],
  '/dashboard/audit':           ['superadmin', 'admin', 'billing'],
  '/dashboard/billing':         ['superadmin', 'admin', 'billing'],
  '/dashboard/users':           ['superadmin', 'admin'],
  '/dashboard/admin/users':     ['superadmin', 'admin'],
  '/dashboard/patio':           ['superadmin', 'admin', 'carga_descarga', 'driver', 'delivery', 'inventory', 'almacen'],
  '/dashboard/pickup':          ['superadmin', 'admin', 'carga_descarga', 'driver', 'delivery', 'inventory', 'almacen'],
  '/dashboard/delivery':        ['superadmin', 'admin', 'driver', 'delivery', 'carga_descarga', 'repartidor'],
  '/dashboard/marketing':       ['superadmin', 'admin', 'marketing'],
  '/dashboard/omnipulse':       ['superadmin', 'admin', 'marketing'],
  '/dashboard/design':          ['superadmin', 'admin', 'marketing'],
  '/dashboard/reports':         ['superadmin', 'admin'],
  '/dashboard/qr':              ['superadmin', 'admin', 'marketing', 'sales', 'caja'],
  '/dashboard/simulator':       ['superadmin', 'admin'],
  '/dashboard/demo':            ['superadmin'],
  '/dashboard/suscripcion':     ['superadmin'],
};

// Redirecciones directas desde /dashboard según el rol del empleado
const WORKER_DASHBOARD_REDIRECTS: Record<string, string> = {
  inventory: '/dashboard/inventory',
  almacen: '/dashboard/inventory',
  sales: '/dashboard/sales',
  caja: '/dashboard/sales',
  billing: '/dashboard/audit',
  driver: '/dashboard/patio',
  delivery: '/dashboard/patio',
  carga_descarga: '/dashboard/patio',
  repartidor: '/dashboard/patio',
  marketing: '/dashboard/marketing',
};

// Dominios que NO se tratan como sub-tenants
const PUBLIC_DOMAINS = [
  'admin.com',
  'localhost:3000',
  'www.admin.com',
  'admin-com-erp.vercel.app',
  'camaliontopics.com',
];

// --- Helper HMAC Verification ---
async function verifyHmac(session: string, role: string, sig: string, tenantId: string = 'default'): Promise<boolean> {
  const secret = process.env.INTERNAL_API_SECRET || process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && !secret) {
    console.warn('[MIDDLEWARE] Missing INTERNAL_API_SECRET in production — using fallback');
  }
  const activeSecret = secret || 'bunkker-ecos-default-local-dev-secret-key-2026';

  const encoder = new TextEncoder();
  try {
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(activeSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    // 1. Firma Triple amarrada a tenantId (tenantId:role:session)
    const expectedBufferScoped = await crypto.subtle.sign('HMAC', key, encoder.encode(`${tenantId}:${role}:${session}`));
    const expectedHexScoped = Array.from(new Uint8Array(expectedBufferScoped)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (timingSafeEqualHex(expectedHexScoped, sig)) return true;

    // 2. Fallback legacy solo para el tenant default (compatibilidad interna)
    if (tenantId === 'default') {
      const expectedBufferLegacy = await crypto.subtle.sign('HMAC', key, encoder.encode(`${role}:${session}`));
      const expectedHexLegacy = Array.from(new Uint8Array(expectedBufferLegacy)).map(b => b.toString(16).padStart(2, '0')).join('');
      return timingSafeEqualHex(expectedHexLegacy, sig);
    }
    return false;
  } catch {
    return false;
  }
}

export default async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // --- 1. MULTI-TENANT (extracción de subdominio) ---
  let tenantId = 'default';
  if (hostname.endsWith('.admin.com') && !PUBLIC_DOMAINS.includes(hostname)) {
    tenantId = hostname.split('.')[0];
  } else if (searchParams.has('tenant') && !pathname.startsWith('/dashboard') && !pathname.startsWith('/api')) {
    tenantId = searchParams.get('tenant')!;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', tenantId);

  // --- 2. RBAC - protección del dashboard ---
  if (pathname === '/dashboard/tests') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname.startsWith('/dashboard')) {
    const session = request.cookies.get('msj-session')?.value;
    const role    = request.cookies.get('msj-role')?.value;
    const sig     = request.cookies.get('msj-role-sig')?.value;

    // Sin sesión -> login
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ✨ Verificación HMAC obligatoria de firma de rol (Fail-Closed) ✨
    if (!role || !sig) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }
    try {
      const signatureValid = await verifyHmac(session, role, sig, tenantId);
      if (!signatureValid) {
        if (process.env.NODE_ENV !== 'production') console.warn(`[RBAC] Firma HMAC inválida para rol '${role}'.`);
        return NextResponse.redirect(new URL('/login?error=tampered', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }

    // Superadmin/admin tienen acceso total
    if (role === 'superadmin' || role === 'admin') {
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      res.headers.set('x-tenant-id', tenantId);
      return res;
    }

    // Verificar permisos por ruta
    const matchedEntry = Object.entries(ROLE_PERMISSIONS).find(
      ([path]) => pathname.startsWith(path) && path !== '/dashboard'
    );

    if (matchedEntry) {
      const requiredRoles = matchedEntry[1];
      if (!role || !requiredRoles.includes(role)) {
        return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
      }
    } else if (pathname === '/dashboard') {
      if (role && WORKER_DASHBOARD_REDIRECTS[role]) {
        return NextResponse.redirect(new URL(WORKER_DASHBOARD_REDIRECTS[role], request.url));
      }
    } else if (role !== 'superadmin' && role !== 'admin') {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }
  }

  // --- 3. API Protection ---
  if (pathname.startsWith('/api')) {
    const publicApiRoutes = [
      '/api/auth',
      '/api/customer',
      '/api/public',
      '/api/settings',
      '/api/mercadopago/webhook',
      '/api/stripe/webhook',
      '/api/health',
    ];
    // Permitir acceso a productos para que la validación RBAC granular se ejecute en el route handler
    const isProductsApi = pathname === '/api/products' || pathname.startsWith('/api/products/');
    // Permitir creación de pedidos (la seguridad, RBAC y validación de roles/invitados se gestiona de forma segura en /api/orders y /api/store-checkout)
    const isPublicOrderCreate = request.method === 'POST' && (pathname === '/api/orders' || pathname === '/api/store-checkout');
    const isPublicApi = isProductsApi || isPublicOrderCreate || publicApiRoutes.some(r => pathname.startsWith(r));

    if (!isPublicApi) {
      const session = request.cookies.get('msj-session')?.value;
      const role    = request.cookies.get('msj-role')?.value;
      const sig     = request.cookies.get('msj-role-sig')?.value;

      if (!session || !role || !sig) {
        return new NextResponse(JSON.stringify({ error: 'Unauthorized', message: 'Acceso denegado (Sesión o firma incompleta)' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId }
        });
      }

      // ✨ Verificación HMAC obligatoria en API (sin rama ausente) ✨
      try {
        const signatureValid = await verifyHmac(session, role, sig, tenantId);
        if (!signatureValid) {
          return new NextResponse(JSON.stringify({ error: 'Unauthorized', message: 'Firma manipulada' }), { 
            status: 401, 
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId } 
          });
        }
      } catch {
        return new NextResponse(JSON.stringify({ error: 'Internal Error', message: 'Error verificando sesión' }), { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId } 
        });
      }
    }
  }

  // Continuar inyectando siempre el tenant en headers
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-tenant-id', tenantId);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json).*)'],
};
