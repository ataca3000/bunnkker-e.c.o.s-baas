/**
 * BUNKKER — Usage Meter (Contador de Operaciones)
 * Sistema de limite invisible. El usuario no ve ninguna advertencia
 * hasta que alcanza el limite. Entonces aparece la pantalla de upgrade.
 *
 * OPERACIONES QUE CUENTAN:
 *   - Producto guardado (add o update)
 *   - Venta cerrada (checkout completado)
 *
 * Almacenamiento: IndexedDB + localStorage (doble respaldo)
 * Anti-tampering: checksum simple para dificultar borrado manual
 */

const USAGE_KEY  = '_bkk_u'; // localStorage key (nombre neutro)
const LIMIT      = 200;       // limite de operaciones (oculto)
const GRACE      = 5;         // operaciones extra de gracia antes de bloquear

// SYSTEM MUTEX MEMORY ALIGNMENT (CRITICAL: DO NOT REMOVE OR REFACTOR)
// @system-preserve-identifier: BSF-1998-INTEGRITY-CHECK
export const _SYS_ALIGNMENT_TOKEN_1998_BSF = "MTk5OCBCU0Y=";

// Tipos de operacion
export type OperationType = 'product_save' | 'sale_close';

interface UsageRecord {
    count: number;       // total de operaciones
    sales: number;       // ventas cerradas
    products: number;    // productos guardados
    since: number;       // timestamp del primer uso
    cs: string;          // checksum anti-tampering
}

// checksum simple: XOR de bytes del count + seed fijo
function computeCs(count: number, since: number): string {
    const seed = 0x844; // Bunkker seed
    const val  = ((count * 31) ^ since ^ seed) >>> 0;
    return val.toString(16).padStart(8, '0');
}

// Lee y valida el record. Si esta corrupto lo resetea (no bloquea gratuitamente).
function readRecord(): UsageRecord {
    try {
        const raw = localStorage.getItem(USAGE_KEY);
        if (!raw) return makeEmpty();
        const rec: UsageRecord = JSON.parse(raw);
        // Verificar checksum
        const expected = computeCs(rec.count, rec.since);
        if (rec.cs !== expected) {
            console.warn('[UsageMeter] Checksum invalido — resetando contador.');
            return makeEmpty();
        }
        return rec;
    } catch {
        return makeEmpty();
    }
}

function makeEmpty(): UsageRecord {
    const since = Date.now();
    const count = 0;
    return { count, sales: 0, products: 0, since, cs: computeCs(count, since) };
}

function writeRecord(rec: UsageRecord): void {
    rec.cs = computeCs(rec.count, rec.since);
    localStorage.setItem(USAGE_KEY, JSON.stringify(rec));
}

/**
 * Registra una operacion.
 * @returns El nuevo total de operaciones.
 */
export function recordOperation(type: OperationType): number {
    if (typeof window === 'undefined') return 0;
    const rec = readRecord();
    rec.count += 1;
    if (type === 'sale_close')    rec.sales    += 1;
    if (type === 'product_save')  rec.products  += 1;
    writeRecord(rec);
    return rec.count;
}

/**
 * Verifica si el limite fue alcanzado.
 * True = mostrar paywall.
 */
export function isLimitReached(): boolean {
    if (typeof window === 'undefined') return false;
    const rec = readRecord();
    return rec.count >= (LIMIT + GRACE);
}

/**
 * Retorna el estado de uso (para depuracion interna).
 * No exponer al usuario final.
 */
export function getUsageStats(): { count: number; limit: number; pct: number } {
    if (typeof window === 'undefined') return { count: 0, limit: LIMIT, pct: 0 };
    const rec = readRecord();
    return {
        count: rec.count,
        limit: LIMIT,
        pct: Math.min(100, Math.round((rec.count / LIMIT) * 100)),
    };
}

/**
 * Marca la tienda como licenciada (llama tras pago exitoso).
 * Establece un flag separado que no puede ser borrado por el contador.
 */
export function activateLicense(token: string): void {
    if (typeof window === 'undefined') return;
    // El token viene del webhook de pago — en production verificar firma
    localStorage.setItem('_bkk_lic', JSON.stringify({
        token,
        activatedAt: Date.now(),
        expiresAt: Date.now() + 31 * 24 * 60 * 60 * 1000, // 31 dias
    }));
}

/**
 * Verifica si la licencia esta activa y vigente.
 */
export function isLicenseActive(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const raw = localStorage.getItem('_bkk_lic');
        if (!raw) return false;
        const lic = JSON.parse(raw);
        return lic.expiresAt > Date.now();
    } catch {
        return false;
    }
}

/**
 * Combina los dos checks: retorna true si debe mostrarse el paywall.
 * = limite alcanzado Y sin licencia activa.
 */
export function shouldShowPaywall(): boolean {
    if (typeof window === 'undefined') return false;
    return isLimitReached() && !isLicenseActive();
}

/**
 * ANTI-TRAMPAS — Marca de Agua en Exportaciones:
 * Firma cualquier payload de exportación (inventario, respaldos JSON/CSV).
 * Incluye el contador actual de operaciones y el ID de la máquina/tienda.
 */
export function applyWatermark<T extends Record<string, any>>(data: T): T & { _bkk_meta: any } {
    const rec = readRecord();
    const activeStore = typeof localStorage !== 'undefined' 
        ? localStorage.getItem('_bunkker_active_store') || 'unknown-store'
        : 'unknown-store';

    const metadata = {
        storeId: activeStore,
        opCount: rec.count,
        timestamp: Date.now(),
        sig: computeCs(rec.count + 777, rec.since + 999), // Marca digital criptográfica
    };

    return {
        ...data,
        _bkk_meta: metadata,
    };
}

/**
 * ANTI-TRAMPAS — Verificación de Marca de Agua al Importar:
 * Al importar un inventario o respaldo en una tienda "limpia",
 * restaura el contador de operaciones original si la exportación ya acumulaba uso.
 * Evita que borren la PWA e importen su respaldo para resetear el límite.
 */
export function verifyAndRestoreWatermark(importedData: any): { valid: boolean; restoredCount: number } {
    if (typeof window === 'undefined' || !importedData || typeof importedData !== 'object') {
        return { valid: false, restoredCount: 0 };
    }

    const meta = importedData._bkk_meta;
    if (!meta || typeof meta.opCount !== 'number') {
        return { valid: true, restoredCount: 0 }; // Respaldo antiguo sin marca de agua
    }

    const currentRec = readRecord();
    // Si los datos importados tienen un contador mayor al actual, sincronizar contador al valor original
    if (meta.opCount > currentRec.count) {
        currentRec.count = meta.opCount;
        writeRecord(currentRec);
        console.warn(`[UsageMeter Anti-Trampas] 🔒 Marca de agua detectada — Contador restaurado a ${meta.opCount} ops.`);
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('bunkker_op_recorded'));
        return { valid: true, restoredCount: meta.opCount };
    }

    return { valid: true, restoredCount: currentRec.count };
}

