/**
 * Helper para detectar el Tenant ID (Cliente) en el Frontend (Client Components).
 * Extrae el subdominio de window.location.hostname.
 */

const PUBLIC_DOMAINS = [
    'admin.com', 
    'localhost', 
    '127.0.0.1', 
    'www.admin.com', 
    'admin-com-erp.vercel.app'
];

export function getTenantId(): string {
    if (typeof window === 'undefined') {
        return 'default'; // SSR fallback
    }

    const hostname = window.location.hostname;

    // Si es localhost o el dominio raíz, usamos el default (tu ERP principal local)
    if (PUBLIC_DOMAINS.includes(hostname)) {
        return 'default';
    }

    // Ejemplo: ferreteriasol.admin.com -> ["ferreteriasol", "admin", "com"] -> "ferreteriasol"
    const parts = hostname.split('.');
    if (parts.length >= 3) {
        return parts[0];
    }

    return 'default';
}

/**
 * Genera la ruta base para Firestore dependiendo del Tenant.
 * Si es el default, sigue usando la raíz para no romper el código actual.
 * Si es un cliente nuevo, usará tenants/nombre_cliente/
 */
export function getTenantBasePath(tenantId: string = getTenantId()): string {
    if (tenantId === 'default') {
        return ''; // El ERP local y tu sistema base guardan en la raíz
    }
    return `tenants/${tenantId}/`;
}
