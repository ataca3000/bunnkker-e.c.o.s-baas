/**
 * Helper para detectar el Tenant ID (tienda) en el Frontend.
 *
 * Orden de resolucion:
 * 1. Parametro ?s= en la URL  →  acceso via codigo QR (prioridad maxima)
 * 2. Cache en localStorage     →  instalacion previa en este dispositivo
 * 3. Subdominio del hostname   →  modo multi-tenant legacy
 * 4. Fallback 'default'        →  ERP local / SSR
 */

const PUBLIC_DOMAINS = [
    'admin.com',
    'localhost',
    '127.0.0.1',
    'www.admin.com',
    'admin-com-erp.vercel.app',
];

export function getTenantId(): string {
    if (typeof window === 'undefined') return 'default';

    // 1. Acceso via QR: ?s=[storeId]
    const params = new URLSearchParams(window.location.search);
    const fromQr = params.get('s');
    if (fromQr && fromQr.length > 8) return fromQr;

    // 2. Instalacion previa en este dispositivo
    const cached = localStorage.getItem('_bunkker_active_store');
    if (cached && cached !== 'default') return cached;

    const hostname = window.location.hostname;

    // 3a. Dominio publico o IP local → default
    if (PUBLIC_DOMAINS.includes(hostname)) return 'default';
    const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname);
    if (isIP) return 'default';

    // 3b. Subdominio: ferreteriasol.admin.com → 'ferreteriasol'
    const parts = hostname.split('.');
    if (parts.length >= 3) return parts[0];

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
