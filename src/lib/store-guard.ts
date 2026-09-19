/**
 * BUNKKER — Store Guard (Edge-compatible)
 * Valida que el dispositivo accediendo pertenece a esta tienda.
 * Compatible con Next.js Edge Runtime (sin Node.js APIs, sin IndexedDB).
 *
 * ANALOGIA: Cada tienda hace su propio "pay" (instancia).
 * El storeId es el sello de esa receta. Si el sello no coincide -> acceso denegado.
 */

export type AccessMode = 'catalog' | 'staff' | 'owner' | 'demo';

export interface StoreGuardResult {
    allowed: boolean;
    mode: AccessMode;
    storeId: string | null;
    reason?: string;
}

/**
 * Evalua si una request puede acceder a esta instancia de tienda.
 *
 * Reglas:
 * 1. Sin ?s= y sin cookie -> modo demo (pagina de instalacion)
 * 2. Sin ?s= con cookie   -> modo owner (el dueno en su dispositivo)
 * 3. Con ?s= == cookie    -> modo catalog o staff segun ?mode=
 * 4. Con ?s= != cookie    -> BLOQUEADO (tienda incorrecta)
 */
export function evaluateStoreGuard(
    storeIdFromUrl: string | null,
    storeIdFromCookie: string | null,
    modeFromUrl: string | null
): StoreGuardResult {

    // Caso 1: Primer uso o modo demo (sin cookie, sin URL)
    if (!storeIdFromCookie && !storeIdFromUrl) {
        return { allowed: true, mode: 'demo', storeId: null };
    }

    // Caso 2: El dueno navegando en su propio dispositivo (tiene cookie, no trajo ?s=)
    if (storeIdFromCookie && !storeIdFromUrl) {
        return { allowed: true, mode: 'owner', storeId: storeIdFromCookie };
    }

    // Caso 3 & 4: Alguien escaneo un QR (tiene ?s=)
    if (storeIdFromUrl) {
        // Caso 4: El storeId del QR NO coincide con esta tienda
        if (storeIdFromCookie && storeIdFromCookie !== storeIdFromUrl) {
            return {
                allowed: false,
                mode: 'catalog',
                storeId: storeIdFromUrl,
                reason: 'STORE_MISMATCH', // Este QR no es de esta tienda
            };
        }

        // Caso 3: El QR si corresponde a esta tienda (o no hay cookie aun)
        const mode: AccessMode = modeFromUrl === 'staff' ? 'staff' : 'catalog';
        return { allowed: true, mode, storeId: storeIdFromUrl };
    }

    // Fallback seguro
    return { allowed: false, mode: 'demo', storeId: null, reason: 'UNKNOWN' };
}

/**
 * Determina si una ruta es accesible en modo catalogo (cliente publico).
 * Los clientes SOLO ven el catalogo — cualquier otra ruta = 404.
 */
export function isCatalogRoute(pathname: string): boolean {
    const PUBLIC_PATHS = [
        '/catalogo',
        '/ofertas',
        '/nosotros',
        '/contacto',
        '/carrito',
        '/',
    ];
    const PUBLIC_API_PREFIXES = [
        '/api/products',
        '/api/public',
        '/api/customer',
        '/api/health',
    ];

    if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) return true;
    if (PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) return true;
    return false;
}
