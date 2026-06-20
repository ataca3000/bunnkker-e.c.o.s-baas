import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROLE_PERMISSIONS: Record<string, string[]> = {
    '/dashboard/guia': ['superadmin'],
    '/dashboard/inventory': ['superadmin', 'admin', 'inventory'],
    '/dashboard/sales': ['superadmin', 'admin', 'sales'], // caja
    '/dashboard/audit': ['superadmin', 'admin', 'billing'],
    '/dashboard/users': ['superadmin', 'admin'],
    '/dashboard/patio': ['superadmin', 'carga_descarga', 'driver', 'inventory'],
    '/dashboard/delivery': ['superadmin', 'driver', 'carga_descarga'],
    '/dashboard/marketing': ['superadmin', 'marketing', 'admin'], // edición de la market
};

// Dominios que NO deben tratarse como tenants
const PUBLIC_DOMAINS = [
    'admin.com', 
    'localhost:3000', 
    'www.admin.com', 
    'admin-com-erp.vercel.app'
];

export default function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl;
    const hostname = request.headers.get('host') || '';
    
    // --- 1. LÓGICA MULTI-TENANT (Extracción de Subdominio) ---
    let tenantId = 'default';
    if (hostname.includes('.admin.com') && !PUBLIC_DOMAINS.includes(hostname)) {
        tenantId = hostname.split('.')[0];
    } else if (searchParams.has('tenant')) {
        tenantId = searchParams.get('tenant')!;
    }

    // Preparamos los headers inyectando el tenantId
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-tenant-id', tenantId);

    // --- 2. LÓGICA DE SEGURIDAD RBAC (Existente) ---
    if (pathname.startsWith('/dashboard')) {
        const session = request.cookies.get('msj-session')?.value;
        const role = request.cookies.get('msj-role')?.value;

        // Si no hay sesión, redirigir al login preservando el tenant actual
        if (!session) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // Si es superadmin, tiene llave maestra
        if (role === 'superadmin') {
            const res = NextResponse.next({ request: { headers: requestHeaders } });
            res.headers.set('x-tenant-id', tenantId);
            return res;
        }

        const matchedEntry = Object.entries(ROLE_PERMISSIONS).find(([path]) => 
            pathname.startsWith(path)
        );

        if (matchedEntry) {
            const requiredRoles = matchedEntry[1];
            if (role && !requiredRoles.includes(role)) {
                console.warn(`[Security] Bloqueado: ${role} intentó entrar a ${pathname} en tenant ${tenantId}`);
                return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
            }
        } else {
            // Default Deny
            if (role !== 'superadmin' && role !== 'admin') {
                console.warn(`[Security] Default Deny: ${role} intentó entrar a ${pathname}`);
                return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
            }
        }
    }

    // Continuar la petición inyectando siempre el Tenant ID en los headers
    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
    response.headers.set('x-tenant-id', tenantId);
    return response;
}

// Intercepta todas las rutas excepto recursos estáticos y APIs core
export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
