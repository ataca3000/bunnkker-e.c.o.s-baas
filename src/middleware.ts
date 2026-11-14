import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { canAccessDashboardPath, getRoleLandingPath } from './lib/dashboardRouting';

// Comparación segura en tiempo constante compatible con Edge Runtime (sin import 'crypto')
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

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

  const isDashboardPath = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  if (isDashboardPath) {
    const session = request.cookies.get('msj-session')?.value;
    const role = request.cookies.get('msj-role')?.value;
    const sig = request.cookies.get('msj-role-sig')?.value;

    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

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

    if (role === 'superadmin' || role === 'admin') {
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      response.headers.set('x-tenant-id', tenantId);
      return response;
    }

    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      const landingPath = getRoleLandingPath(role);
      if (!landingPath) {
        return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
      }
      if (landingPath !== '/dashboard') {
        return NextResponse.redirect(new URL(landingPath, request.url));
      }
    } else if (!canAccessDashboardPath(role, pathname)) {
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
    // Permitir lectura pública de media subida para la tienda (POST /api/media/upload sigue protegido)
    const isPublicMediaGet = request.method === 'GET' && pathname.startsWith('/api/media/');
    // Permitir reclamar pase de vinculación QR/código y conectar al stream SSE multidispositivo
    const isPublicPairingClaim = pathname === '/api/pairing/claim';
    const isPublicSyncEvents = pathname === '/api/sync/events';
    // Permitir creación de pedidos (la seguridad, RBAC y validación de roles/invitados se gestiona de forma segura en /api/orders y /api/store-checkout)
    const isPublicOrderCreate = request.method === 'POST' && (pathname === '/api/orders' || pathname === '/api/store-checkout');
    const isPublicApi = isProductsApi || isPublicMediaGet || isPublicPairingClaim || isPublicSyncEvents || isPublicOrderCreate || publicApiRoutes.some(r => pathname.startsWith(r));

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
