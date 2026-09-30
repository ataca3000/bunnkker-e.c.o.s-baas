/**
 * BUNKKER E.C.O.S. - Device Migration & Zero-Tap Restoration Engine
 * Alineado con las directrices de Google Play:
 * "Proporcionar una experiencia de migración de dispositivos segura y fluida"
 * (Device Migration / Zero-Tap Sign-in Restoration)
 * https://support.google.com/googleplay/android-developer/answer/17492799#zero-tap_sign-in_restoration
 */

export interface MigrationBundle {
    version: '1.0.0';
    app: 'BUNKKER E.C.O.S. ERP';
    exportTimestamp: string;
    deviceId: string;
    tenantId: string;
    branchId: string;
    userSession: {
        role: string;
        name: string;
        pin?: string;
    } | null;
    offlineData: {
        pendingQueue: any[];
        cartItems: any[];
        printerConfig: any | null;
        preferences: Record<string, any>;
    };
    integrityHash: string;
}

/**
 * Genera un hash simple de integridad para prevenir alteraciones
 */
function computeIntegrity(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Empaqueta todos los datos de la terminal/sucursal actual para migración a dispositivo nuevo
 */
export function generateMigrationBundle(): MigrationBundle {
    if (typeof window === 'undefined') {
        throw new Error('Migration is only supported in browser/client environment');
    }

    const tenantId = localStorage.getItem('current_tenant_id') || localStorage.getItem('TENANT_ID') || 'default';
    const branchId = localStorage.getItem('current_branch_id') || localStorage.getItem('SUCURSAL_ACTIVA') || 'matriz';
    const role = localStorage.getItem('user_role') || localStorage.getItem('CURRENT_ROLE') || 'admin';
    const name = localStorage.getItem('user_name') || 'Usuario Terminal';
    const pin = localStorage.getItem('user_pin') || '';

    let pendingQueue: any[] = [];
    try {
        pendingQueue = JSON.parse(localStorage.getItem('pending_sales_queue') || '[]');
    } catch { /* noop */ }

    let cartItems: any[] = [];
    try {
        cartItems = JSON.parse(localStorage.getItem('bunkker_cart') || '[]');
    } catch { /* noop */ }

    let printerConfig: any = null;
    try {
        printerConfig = JSON.parse(localStorage.getItem('printer_config') || 'null');
    } catch { /* noop */ }

    // Preferencias de UI / Tema / Radio
    const preferences: Record<string, any> = {
        theme: localStorage.getItem('theme') || 'dark',
        radioVolume: localStorage.getItem('bunkker_radio_volume') || '0.8',
        audioEnabled: localStorage.getItem('bunkker_audio_effects') !== 'false',
        cookieConsent: localStorage.getItem('bunkker_cookie_consent_v1') || 'accepted'
    };

    const deviceId = localStorage.getItem('bunkker_device_uuid') || `dev_${Math.random().toString(36).substring(2, 10)}`;
    if (!localStorage.getItem('bunkker_device_uuid')) {
        localStorage.setItem('bunkker_device_uuid', deviceId);
    }

    const rawPayload = JSON.stringify({ tenantId, branchId, role, name, pendingQueue, cartItems, printerConfig, preferences });
    const integrityHash = computeIntegrity(rawPayload);

    return {
        version: '1.0.0',
        app: 'BUNKKER E.C.O.S. ERP',
        exportTimestamp: new Date().toISOString(),
        deviceId,
        tenantId,
        branchId,
        userSession: {
            role,
            name,
            pin: pin || undefined
        },
        offlineData: {
            pendingQueue,
            cartItems,
            printerConfig,
            preferences
        },
        integrityHash
    };
}

/**
 * Descarga el respaldo como archivo .bunkker-backup.json
 */
export function downloadMigrationFile(): void {
    const bundle = generateMigrationBundle();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    const dateFormatted = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute('download', `bunkker-backup-${bundle.branchId}-${dateFormatted}.bunkker.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

/**
 * Genera una versión compacta (codificada en Base64 seguro para URL) para transferir por QR directo
 */
export function getMigrationQrPayload(bundle: MigrationBundle): string {
    const compact = {
        v: bundle.version,
        t: bundle.tenantId,
        b: bundle.branchId,
        r: bundle.userSession?.role || 'sales',
        p: bundle.userSession?.pin || '',
        u: bundle.userSession?.name || '',
        q: bundle.offlineData.pendingQueue.length,
        h: bundle.integrityHash
    };
    const json = JSON.stringify(compact);
    if (typeof window !== 'undefined' && window.btoa) {
        return window.btoa(unescape(encodeURIComponent(json)));
    }
    return json;
}

/**
 * Restaura el estado de la aplicación en el nuevo dispositivo a partir de un MigrationBundle
 */
export function restoreFromMigrationBundle(bundle: MigrationBundle): { success: boolean; message: string; count: number } {
    if (typeof window === 'undefined') {
        return { success: false, message: 'Entorno no soportado', count: 0 };
    }

    try {
        if (!bundle || bundle.app !== 'BUNKKER E.C.O.S. ERP') {
            return { success: false, message: 'Archivo de respaldo no compatible o corrupto.', count: 0 };
        }

        let restoredCount = 0;

        // 1. Restaurar Tenant & Sucursal
        if (bundle.tenantId) {
            localStorage.setItem('current_tenant_id', bundle.tenantId);
            localStorage.setItem('TENANT_ID', bundle.tenantId);
            restoredCount++;
        }
        if (bundle.branchId) {
            localStorage.setItem('current_branch_id', bundle.branchId);
            localStorage.setItem('SUCURSAL_ACTIVA', bundle.branchId);
            restoredCount++;
        }

        // 2. Restaurar Sesión / Usuario
        if (bundle.userSession) {
            if (bundle.userSession.role) {
                localStorage.setItem('user_role', bundle.userSession.role);
                localStorage.setItem('CURRENT_ROLE', bundle.userSession.role);
                restoredCount++;
            }
            if (bundle.userSession.name) {
                localStorage.setItem('user_name', bundle.userSession.name);
                restoredCount++;
            }
            if (bundle.userSession.pin) {
                localStorage.setItem('user_pin', bundle.userSession.pin);
                restoredCount++;
            }
        }

        // 3. Restaurar Colas Offline y Carrito
        if (bundle.offlineData?.pendingQueue?.length) {
            const currentQueue = JSON.parse(localStorage.getItem('pending_sales_queue') || '[]');
            const merged = [...currentQueue, ...bundle.offlineData.pendingQueue];
            localStorage.setItem('pending_sales_queue', JSON.stringify(merged));
            restoredCount += bundle.offlineData.pendingQueue.length;
        }

        if (bundle.offlineData?.cartItems?.length) {
            localStorage.setItem('bunkker_cart', JSON.stringify(bundle.offlineData.cartItems));
            restoredCount++;
        }

        if (bundle.offlineData?.printerConfig) {
            localStorage.setItem('printer_config', JSON.stringify(bundle.offlineData.printerConfig));
            restoredCount++;
        }

        // 4. Restaurar Preferencias
        if (bundle.offlineData?.preferences) {
            Object.entries(bundle.offlineData.preferences).forEach(([k, v]) => {
                if (typeof v === 'string') localStorage.setItem(k, v);
            });
            restoredCount++;
        }

        // Marcar migración exitosa
        localStorage.setItem('bunkker_migration_restored_at', new Date().toISOString());

        return {
            success: true,
            message: `¡Migración completada con éxito! Se restauraron ${restoredCount} elementos en el nuevo dispositivo.`,
            count: restoredCount
        };
    } catch (err: any) {
        return { success: false, message: `Error restaurando respaldo: ${err?.message || err}`, count: 0 };
    }
}

/**
 * Restaura desde el payload compacto del QR de migración
 */
export function restoreFromQrPayload(payloadBase64: string): { success: boolean; message: string } {
    try {
        let jsonStr = payloadBase64;
        try {
            jsonStr = decodeURIComponent(escape(window.atob(payloadBase64)));
        } catch { /* Intentar parsing directo si no es base64 */ }

        const data = JSON.parse(jsonStr);
        if (!data || !data.t) {
            return { success: false, message: 'Código QR de migración no válido' };
        }

        localStorage.setItem('current_tenant_id', data.t);
        localStorage.setItem('TENANT_ID', data.t);
        if (data.b) {
            localStorage.setItem('current_branch_id', data.b);
            localStorage.setItem('SUCURSAL_ACTIVA', data.b);
        }
        if (data.r) {
            localStorage.setItem('user_role', data.r);
            localStorage.setItem('CURRENT_ROLE', data.r);
        }
        if (data.p) localStorage.setItem('user_pin', data.p);
        if (data.u) localStorage.setItem('user_name', data.u);

        localStorage.setItem('bunkker_migration_restored_at', new Date().toISOString());

        return {
            success: true,
            message: `Dispositivo nuevo configurado para la sucursal "${data.b || data.t}" con rol "${data.r}".`
        };
    } catch (err: any) {
        return { success: false, message: `Error al procesar QR: ${err?.message || err}` };
    }
}

/**
 * Zero-Tap Restoration Hook:
 * Detecta parámetros de migración en la URL al abrir la app en el dispositivo nuevo
 * (Ejemplo: ?zeroTap=true&migData=...)
 */
export function checkZeroTapRestoration(): boolean {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const migData = urlParams.get('migData');
    if (migData) {
        const res = restoreFromQrPayload(migData);
        if (res.success) {
            // Limpiar parámetro de URL para que no se re-ejecute
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            return true;
        }
    }
    return false;
}
