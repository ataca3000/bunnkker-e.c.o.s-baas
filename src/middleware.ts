import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── Permisos por rol y ruta ───────────────────────────────────────────────────
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
  '/dashboard/design':          ['superadmin', 'admin', 'marketing'],
  '/dashboard/reports':         ['superadmin', 'admin'],
  '/dashboard/qr':              ['superadmin', 'admin', 'marketing', 'sales', 'caja'],
  '/dashboard/demo':            ['superadmin'],
  '/dashboard/suscripcion':     ['superadmin'],
  '/dashboard/tests':           ['superadmin'],
};

// Dominios que NO se tratan como sub-tenants
const PUBLIC_DOMAINS = [
  'admin.com',
  'localhost:3000',
  'www.admin.com',
  'admin-com-erp.vercel.app',
  'camaliontopics.com',
];

export default async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // --- 1. MULTI-TENANT (extracción de subdominio) ---
  let tenantId = 'default';
  if (hostname.includes('.admin.com') && !PUBLIC_DOMAINS.includes(hostname)) {
    tenantId = hostname.split('.')[0];
  } else if (searchParams.has('tenant')) {
    tenantId = searchParams.get('tenant')!;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', tenantId);

  // --- 2. RBAC — protección del dashboard ---
  if (pathname.startsWith('/dashboard')) {
    const session = request.cookies.get('msj-session')?.value;
    const role    = request.cookies.get('msj-role')?.value;
    const sig     = request.cookies.get('msj-role-sig')?.value;

    // Sin sesión → login
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ── Verificación HMAC de firma de rol (aplica a TODOS los roles, incluyendo superadmin) ──
    // Previene que alguien edite manualmente la cookie msj-role a 'superadmin'.
    // El Edge Runtime de Next.js soporta crypto nativo (Web Crypto API).
    if (role && sig) {
      const secret = process.env.INTERNAL_API_SECRET || 'dev-only-secret-never-use-in-production-development';
      const encoder = new TextEncoder();
      let signatureValid = false;
      try {
        const key = await crypto.subtle.importKey(
          'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const expectedBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(`${role}:${session}`));
        const expectedHex = Array.from(new Uint8Array(expectedBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        // Comparación de longitud constante para prevenir timing attacks
        signatureValid = expectedHex.length === sig.length &&
          expectedHex.split('').every((c, i) => c === sig[i]);
      } catch {
        signatureValid = false;
      }

      if (!signatureValid) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[RBAC] Firma HMAC inválida para rol '${role}' en ${pathname}. Posible cookie tampering.`);
        }
        return NextResponse.redirect(new URL('/login?error=tampered', request.url));
      }
    } else if (!sig) {
      // Sin firma → cookie vieja o manipulada, redirigir a login
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }

    // Superadmin/admin tienen acceso total (ya verificamos su firma arriba)
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
        if (process.env.NODE_ENV !== 'production') console.warn(`[RBAC] Bloqueado: ${role} intentó acceder a ${pathname} en tenant ${tenantId}`);
        return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
      }
    } else if (pathname === '/dashboard') {
      // Root dashboard: redirigir al módulo principal del rol
      if (role) {
        const primaryPath = Object.entries(ROLE_PERMISSIONS).find(
          ([_, roles]) => roles.includes(role)
        )?.[0];
        if (primaryPath) return NextResponse.redirect(new URL(primaryPath, request.url));
      }
    } else if (role !== 'superadmin' && role !== 'admin') {
      if (process.env.NODE_ENV !== 'production') console.warn(`[RBAC] Ruta no permitida: ${role} en ${pathname}`);
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }
  }

  // --- 3. API Protection ---
  if (pathname.startsWith('/api')) {
    // Rutas públicas que no requieren sesión de empleado
    const publicApiRoutes = ['/api/auth', '/api/customer', '/api/public'];
    const isPublicApi = publicApiRoutes.some(r => pathname.startsWith(r));

    if (!isPublicApi) {
      // Permitir consultas públicas del catálogo y checkout por método
      const isPublicMethod = (pathname === '/api/products' && request.method === 'GET') ||
                             (pathname === '/api/orders' && request.method === 'POST');

      if (!isPublicMethod) {
        const session = request.cookies.get('msj-session')?.value;
        if (!session) {
          if (process.env.NODE_ENV !== 'production') console.warn(`[RBAC] Acceso a API denegado sin sesión: ${pathname}`);
          return new NextResponse(JSON.stringify({ error: 'Unauthorized', message: 'Acceso denegado (RNI)' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId }
          });
        }
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
