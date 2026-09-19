import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ROUTE_ROLES, getAllowedRolesForRoute, isValidRole } from './lib/rbac';
import { evaluateStoreGuard, isCatalogRoute } from './lib/store-guard';


// Comparación segura en tiempo constante compatible con Edge Runtime (sin import 'crypto')
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ROUTE_ROLES viene de @/lib/rbac — fuente única de verdad para permisos de ruta
// Ver src/lib/rbac.ts para agregar o modificar rutas

// Dominios que NO se tratan como sub-tenants
const PUBLIC_DOMAINS = [
  'admin.com',
  'localhost:3000',
  'www.admin.com',
  'admin-com-erp.vercel.app',
  'camaliontopics.com',
  'admin.localhost:3000'
];

export default async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // --- 0. STORE GUARD — Cada tienda es su propio "pay" ---
  // El storeId del QR (?s=) debe coincidir con la cookie bunkker-store.
  // Si no coincide: el dispositivo pertenece a otra tienda -> /tienda-incorrecta.
  const storeIdFromUrl    = searchParams.get('s');
  const storeIdFromCookie = request.cookies.get('bunkker-store')?.value ?? null;
  const modeFromUrl       = searchParams.get('mode');

  // Rutas del sistema que nunca pasan por el guard de tienda
  const isSystemRoute = pathname.startsWith('/_next') ||
                        pathname.startsWith('/tienda-incorrecta') ||
                        pathname === '/favicon.ico' ||
                        pathname === '/manifest.json' ||
                        pathname === '/sw.js';

  if (!isSystemRoute) {
    const guard = evaluateStoreGuard(storeIdFromUrl, storeIdFromCookie, modeFromUrl);

    if (!guard.allowed && guard.reason === 'STORE_MISMATCH') {
      // El QR no corresponde a esta tienda
      return NextResponse.redirect(new URL('/tienda-incorrecta', request.url));
    }

    // Modo catalogo (cliente publico): solo rutas de catalogo permitidas
    if (guard.mode === 'catalog' && !isCatalogRoute(pathname)) {
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }

    // Propagar modo de acceso a los headers para que los componentes lo lean
    request.headers.set('x-access-mode', guard.mode);
    request.headers.set('x-store-id', guard.storeId ?? '');
  }

  // --- 1. MULTI-TENANT (extracción de subdominio) ---
  let tenantId = 'default';
  if (hostname.endsWith('.admin.com') && !PUBLIC_DOMAINS.includes(hostname)) {
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
    if (role && sig) {
      const secret = process.env.INTERNAL_API_SECRET || 'dev-only-secret-CHANGE-IN-PRODUCTION-DO-NOT-USE';
      const encoder = new TextEncoder();
      let signatureValid = false;
      try {
        const key = await crypto.subtle.importKey(
          'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const expectedBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(`${role}:${session}`));
        const expectedHex = Array.from(new Uint8Array(expectedBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (timingSafeEqualHex(expectedHex, sig)) {
          signatureValid = true;
        }
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

    // Verificar permisos por ruta usando rbac.ts (fuente unica de verdad)
    const allowedRoles = getAllowedRolesForRoute(pathname);

    if (allowedRoles) {
      if (!role || !isValidRole(role) || !allowedRoles.includes(role as any)) {
        if (process.env.NODE_ENV !== 'production')
          console.warn(`[RBAC] Bloqueado: rol '${role}' sin acceso a ${pathname} (tenant: ${tenantId})`);
        // 404 en lugar de 401: no revela que la ruta existe pero esta bloqueada
        return NextResponse.rewrite(new URL('/not-found', request.url));
      }
    } else if (pathname !== '/dashboard') {
      // Ruta no listada y no es la raiz del dashboard
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }
  }

  // --- 3. API Protection ---
  if (pathname.startsWith('/api')) {
    // Rutas públicas que no requieren sesión de empleado
    const publicApiRoutes = ['/api/auth', '/api/customer', '/api/public', '/api/omnipulse', '/api/seed'];
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
