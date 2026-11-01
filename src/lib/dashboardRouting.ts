export const DASHBOARD_HOME_BY_ROLE: Readonly<Record<string, string>> = {
    superadmin: '/dashboard',
    admin: '/dashboard',
    sales: '/dashboard',
    caja: '/dashboard',
    billing: '/dashboard',
    inventory: '/dashboard',
    almacen: '/dashboard',
    bodega: '/dashboard',
    carga_descarga: '/dashboard',
    carga: '/dashboard',
    patio: '/dashboard',
    driver: '/dashboard',
    delivery: '/dashboard',
    repartidor: '/dashboard',
    chofer: '/dashboard',
    pickup: '/dashboard',
    mostrador: '/dashboard',
    marketing: '/dashboard/marketing',
    client: '/cuenta',
};

const STAFF_ROLES = [
    'sales',
    'caja',
    'billing',
    'inventory',
    'almacen',
    'bodega',
    'carga_descarga',
    'carga',
    'patio',
    'driver',
    'delivery',
    'repartidor',
    'chofer',
    'pickup',
    'mostrador',
    'marketing',
] as const;

export const DASHBOARD_ROLE_PERMISSIONS = {
    '/dashboard/inventory': ['inventory', 'almacen', 'bodega'],
    '/dashboard/sales': ['sales', 'caja'],
    '/dashboard/admin/sales': ['sales', 'caja'],
    '/dashboard/admin/customers': ['sales', 'caja'],
    '/dashboard/crm': ['sales', 'caja'],
    '/dashboard/audit': ['billing'],
    '/dashboard/billing': ['billing'],
    '/dashboard/users': [],
    '/dashboard/admin/users': [],
    '/dashboard/patio': ['carga_descarga', 'carga', 'patio', 'driver', 'delivery', 'inventory', 'almacen', 'bodega'],
    '/dashboard/pickup': ['carga_descarga', 'carga', 'patio', 'driver', 'delivery', 'inventory', 'almacen', 'bodega', 'pickup', 'mostrador'],
    '/dashboard/delivery': ['driver', 'delivery', 'carga_descarga', 'repartidor', 'chofer'],
    '/dashboard/marketing': ['marketing'],
    '/dashboard/omnipulse': ['marketing'],
    '/dashboard/design': ['marketing'],
    '/dashboard/reports': [],
    '/dashboard/qr': ['marketing', 'sales', 'caja'],
    '/dashboard/simulator': [],
    '/dashboard/demo': [],
    '/dashboard/suscripcion': [],
    '/dashboard/setup': [],
    '/dashboard/profile': [...STAFF_ROLES],
    '/dashboard/guia': [...STAFF_ROLES],
    '/dashboard/purchases': [],
    '/dashboard/soporte': [],
    '/dashboard/pro-sync': [],
    '/dashboard/verificador': [],
    '/dashboard/migracion': [],
    '/dashboard/link': [],
} as const satisfies Record<string, readonly string[]>;

function getRouteRoles(pathname: string): readonly string[] | null {
    let matchedPath = '';
    let matchedRoles: readonly string[] | null = null;

    for (const [route, roles] of Object.entries(DASHBOARD_ROLE_PERMISSIONS)) {
        const matches = pathname === route || pathname.startsWith(`${route}/`);
        if (matches && route.length > matchedPath.length) {
            matchedPath = route;
            matchedRoles = roles;
        }
    }

    return matchedRoles;
}

export function canAccessDashboardPath(role: string, pathname: string): boolean {
    if (role === 'superadmin' || role === 'admin') return true;

    if (pathname === '/dashboard' || pathname === '/dashboard/') {
        return DASHBOARD_HOME_BY_ROLE[role] === '/dashboard';
    }

    return getRouteRoles(pathname)?.includes(role) ?? false;
}

function parseDashboardRedirect(value: string | null | undefined): URL | null {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return null;

    try {
        const url = new URL(value, 'https://bunkker.invalid');
        if (url.pathname === '/dashboard/') url.pathname = '/dashboard';
        const isDashboardPath = url.pathname === '/dashboard' || url.pathname.startsWith('/dashboard/');
        if (url.origin !== 'https://bunkker.invalid' || !isDashboardPath) return null;
        return url;
    } catch {
        return null;
    }
}

export function getRoleLandingPath(role: string, requestedPath?: string | null): string | null {
    const homePath = DASHBOARD_HOME_BY_ROLE[role];
    if (!homePath) return null;
    if (role === 'client') return homePath;

    const requestedUrl = parseDashboardRedirect(requestedPath);
    if (!requestedUrl || !canAccessDashboardPath(role, requestedUrl.pathname)) return homePath;

    if (role === 'marketing' && requestedUrl.pathname === '/dashboard/design') {
        requestedUrl.pathname = '/dashboard/marketing';
        requestedUrl.searchParams.set('tab', 'studio');
    }

    return `${requestedUrl.pathname}${requestedUrl.search}${requestedUrl.hash}`;
}
