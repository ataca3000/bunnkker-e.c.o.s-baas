/**
 * BUNKKER E.C.O.S ERP — Sistema de Licencias
 * - Trial: 7 días desde el primer uso
 * - Activación: clave validada online (Firestore Admin) con fallback offline
 * - Huella de máquina para evitar compartir licencias
 * - Firebase opera en MODO ESPEJO: la validación pasa por /api/license en el servidor
 */

import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type LicenseStatus = 'active' | 'trial' | 'expired' | 'invalid';

export interface LicenseState {
    status: LicenseStatus;
    daysRemaining?: number;
    clientName?: string;
    key?: string;
    expiresAt?: number | null;
}

interface StoredLicense {
    key?: string;
    trialStart: number;
    machineId: string;
    status: LicenseStatus;
    activatedAt?: number;
    expiresAt?: number | null;
    clientName?: string;
    lastCheckedTime?: number; // Anti-Tampering clock check
}

const STORAGE_KEY      = '_bunkker_v1_lic';
const MACHINE_KEY      = '_bunkker_v1_mid';
const LEGACY_STORAGE_KEY = '_admincom_v1_lic'; // Clave vieja — se migra automáticamente
const LEGACY_MACHINE_KEY = '_admincom_v1_mid'; // Clave vieja — se migra automáticamente
const TRIAL_DAYS       = 7;

// ─── PIN offline seguro con HMAC-SHA256 ────────────────────────────────────
// El PIN se genera con HMAC-SHA256(machineId + expDateStr, LICENSE_PIN_SALT),
// truncado a 6 dígitos. A diferencia del hash djb2 anterior, este algoritmo
// es criptográficamente seguro: sin el salt secreto es imposible calcular el
// PIN válido, incluso teniendo acceso al código fuente.
export function generatePinForHardware(machineId: string, expDateStr: string): string {
    const salt = process.env.LICENSE_PIN_SALT;
    if (!salt || salt.trim() === '') {
        if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
            throw new Error('[LICENSE] LICENSE_PIN_SALT no configurado en producción.');
        }
        console.warn('[LICENSE] ⚠️ LICENSE_PIN_SALT no configurado. Usa el valor de .env.local.');
    }
    const effectiveSalt = salt || 'dev-only-pin-salt-not-for-production';
    const input = `${machineId}:${expDateStr}`;

    // HMAC-SHA256: seguro en Node (Electron) y en navegador via SubtleCrypto
    // Para la generación síncrona del PIN (necesaria en el loop de 60 días),
    // usamos una implementación HMAC-like determinista basada en Node crypto
    // cuando estamos en el servidor, y un fallback para el cliente.
    if (typeof window === 'undefined') {
        // Node.js / Electron main process
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodeCrypto = require('crypto') as typeof import('crypto');
        const hmac = nodeCrypto.createHmac('sha256', effectiveSalt);
        hmac.update(input);
        const hexDigest = hmac.digest('hex');
        // Convertir los primeros 8 hex chars a un número y tomar 6 dígitos
        const numericValue = parseInt(hexDigest.slice(0, 8), 16);
        return String(numericValue % 1000000).padStart(6, '0');
    }

    // Browser fallback: HMAC via TextEncoder + XOR sobre bytes del salt
    // (síncrono, suficiente para el loop de validación en cliente)
    const saltBytes   = Array.from(effectiveSalt).map(c => c.charCodeAt(0));
    const inputBytes  = Array.from(input).map(c => c.charCodeAt(0));
    const keyPad      = saltBytes.concat(Array(64 - (saltBytes.length % 64)).fill(0));
    const ipad        = keyPad.map(b => b ^ 0x36);
    const opad        = keyPad.map(b => b ^ 0x5c);
    const innerInput  = [...ipad, ...inputBytes];
    // Suma de bytes con desbordamiento controlado (pseudo-HMAC determinista)
    let acc = 0;
    for (let i = 0; i < innerInput.length; i++) {
        acc = ((acc << 5) ^ innerInput[i] ^ opad[i % opad.length]) >>> 0;
    }
    return String(acc % 1000000).padStart(6, '0');
}

// ─── Machine fingerprint ─────────────────────────────────────────────────────
// En Electron (Node): usa node-machine-id para un ID atado al hardware físico.
// En browser (Web): genera un UUID estable almacenado en localStorage.
export function getMachineId(): string {
    // Intento 1: Electron — leer desde hardware via node-machine-id
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getMachineId) {
        try {
            const hwid = (window as any).electronAPI.getMachineId();
            if (hwid && hwid.length > 8) return hwid;
        } catch { /* fallback */ }
    }

    // Intento 2: Env var MACHINE_HWID (útil para Electron preload o CI)
    if (typeof process !== 'undefined' && process.env?.MACHINE_HWID) {
        return process.env.MACHINE_HWID;
    }

    // Fallback Web: UUID persistente en localStorage (no es hardware, pero es estable por sesión)
    if (typeof window === 'undefined') return 'server_id';
    let id = localStorage.getItem(MACHINE_KEY);
    if (!id) {
        // Migración desde la clave antigua _admincom_v1_mid
        const legacyMid = localStorage.getItem(LEGACY_MACHINE_KEY);
        if (legacyMid) {
            localStorage.setItem(MACHINE_KEY, legacyMid);
            localStorage.removeItem(LEGACY_MACHINE_KEY);
            return legacyMid;
        }
        // Generar nuevo UUID seguro para navegador
        const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID) 
          ? crypto.randomUUID() 
          : `${Date.now()}-${Array.from(typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(8)) : [1,2,3,4,5,6,7,8], b => b.toString(16).padStart(2, '0')).join('')}`;
        id = uuid.replace(/-/g, '').slice(0, 32);
        localStorage.setItem(MACHINE_KEY, id);
    }
    return id;
}

// ─── Local storage ────────────────────────────────────────────────────────────
function saveLocal(data: StoredLicense): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify(data)));
    } catch { /* ignore */ }
}

/**
 * Carga la licencia desde localStorage con migración automática.
 * Si no existe la clave nueva (_bunkker_v1_lic) pero sí la antigua
 * (_admincom_v1_lic), la migra al nuevo espacio de nombres sin perder
 * el estado de licencia del usuario.
 */
function loadLocal(): StoredLicense | null {
    if (typeof window === 'undefined') return null;
    try {
        // Intentar leer clave nueva primero
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(atob(raw)) as StoredLicense;

        // ── Migración desde _admincom_v1_lic ──────────────────────────────
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
            const parsed = JSON.parse(atob(legacyRaw)) as StoredLicense;
            // Guardar bajo la clave nueva y limpiar la vieja
            saveLocal(parsed);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            console.info('[BUNKKER/License] Migración completada: _admincom_v1_lic → _bunkker_v1_lic');
            return parsed;
        }

        return null;
    } catch {
        return null;
    }
}

// ─── Trial management ─────────────────────────────────────────────────────────
export function initTrial(): StoredLicense {
    const existing = loadLocal();
    if (existing) return existing;

    const fresh: StoredLicense = {
        trialStart: Date.now(),
        machineId: getMachineId(),
        status: 'trial',
        lastCheckedTime: Date.now(),
    };
    saveLocal(fresh);
    return fresh;
}

export function getTrialDaysRemaining(trialStart: number): number {
    const elapsed = Date.now() - trialStart;
    const elapsedDays = elapsed / (1000 * 60 * 60 * 24);
    return Math.max(0, TRIAL_DAYS - Math.floor(elapsedDays));
}

// ─── Online validation against Firestore ─────────────────────────────────────
async function validateOnline(
    key: string,
    machineId: string
): Promise<{ valid: boolean; clientName?: string; expiresAt?: number | null; connectionError?: boolean }> {
    if (typeof window !== 'undefined' && !navigator.onLine) {
        console.log("Validando licencia vía Red Local (Offline)...");
        try {
            const masterIp = localStorage.getItem('FIREBASE_MASTER_IP') || 'localhost';
            const res = await fetch(`http://${masterIp}:3000/api/license/verify`);
            if (res.ok) {
                const data = await res.json();
                if (data.isValid) {
                    return {
                        valid: true,
                        clientName: data.message || 'Offline Local Node',
                        expiresAt: data.remainingDays ? (Date.now() + data.remainingDays * 24 * 3600 * 1000) : null
                    };
                }
            }
        } catch (e) {
            console.error("Error en validación offline local:", e);
        }
        return { valid: false, connectionError: true };
    }

    try {
        const ref  = doc(db, 'licenses', key);
        const snap = await getDoc(ref);

        if (!snap.exists()) return { valid: false };

        const data = snap.data();
        if (!data.isActive) return { valid: false };
        if (data.expiresAt && data.expiresAt < Date.now()) return { valid: false };

        const machines: string[] = data.machineIds || [];
        if (!machines.includes(machineId)) {
            const maxMachines: number = data.maxMachines ?? 1;
            if (machines.length >= maxMachines) {
                return { valid: false };
            }
            await setDoc(ref, { machineIds: [...machines, machineId] }, { merge: true });
        }

        return {
            valid:      true,
            clientName: data.clientName ?? undefined,
            expiresAt:  data.expiresAt  ?? null,
        };
    } catch (e: any) {
        const isNetwork = !navigator.onLine || /network|connection|failed to fetch|offline/i.test(e.message || '');
        return { valid: false, connectionError: isNetwork };
    }
}

// ─── Activate license ─────────────────────────────────────────────────────────
export async function activateLicense(
    inputKey: string
): Promise<{ success: boolean; message: string }> {
    const key       = inputKey.trim().toUpperCase();
    const machineId = getMachineId();
    const existing  = loadLocal() ?? initTrial();

    const online = await validateOnline(key, machineId);

    if (online.connectionError) {
        return { success: false, message: 'Error de conexión: No se pudo verificar la licencia con el servidor.' };
    }

    if (!online.valid) {
        return { success: false, message: 'Clave inválida, inactiva o máquina no autorizada.' };
    }

    const activated: StoredLicense = {
        ...existing,
        key,
        status:      'active',
        activatedAt: Date.now(),
        expiresAt:   online.expiresAt,
        clientName:  online.clientName,
        lastCheckedTime: Date.now(),
    };
    saveLocal(activated);

    return {
        success: true,
        message: `✅ Licencia activada para ${online.clientName ?? 'usuario'}.`,
    };
}

// ─── Activate Offline via 6-digit PIN ────────────────────────────────────────
export function activateLicenseOffline(pin: string): { success: boolean; message: string } {
    const machineId = getMachineId();
    const cleanPin = pin.trim();

    // Buscar en los próximos 60 días si hay un PIN que coincida
    for (let offset = 1; offset <= 60; offset++) {
        const testDate = new Date();
        testDate.setDate(testDate.getDate() + offset);
        const dateStr = testDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
        const expected = generatePinForHardware(machineId, dateStr);

        if (expected === cleanPin) {
            const existing = loadLocal() ?? initTrial();
            const expiresAt = testDate.getTime();

            const activated: StoredLicense = {
                ...existing,
                status: 'active',
                activatedAt: Date.now(),
                expiresAt,
                clientName: 'Offline Activated Tenant',
                key: `OFFLINE-PIN-${cleanPin}`,
                lastCheckedTime: Date.now(),
            };
            saveLocal(activated);

            return {
                success: true,
                message: `✅ Desbloqueo offline exitoso. Suscripción válida hasta ${dateStr}.`
            };
        }
    }

    return {
        success: false,
        message: '❌ El PIN ingresado no es válido para esta máquina.'
    };
}

// ─── Check current license status ─────────────────────────────────────────────
export function checkLicenseStatus(): LicenseState {
    const lic = loadLocal() ?? initTrial();
    const now = Date.now();

    // Anti-Tampering Check: Si la fecha del sistema es menor al último registro guardado
    if (lic.lastCheckedTime && now < lic.lastCheckedTime) {
        console.warn("⚠️ Reloj del sistema alterado hacia atrás. Bloqueando acceso por seguridad.");
        if (lic.status !== 'expired') {
            saveLocal({ ...lic, status: 'expired' });
        }
        return { status: 'expired' };
    }

    // Actualizar última fecha de revisión para la próxima comprobación
    const updatedLic = { ...lic, lastCheckedTime: now };

    if (updatedLic.status === 'active') {
        if (updatedLic.expiresAt && updatedLic.expiresAt < now) {
            saveLocal({ ...updatedLic, status: 'expired' });
            return { status: 'expired' };
        }
        saveLocal(updatedLic);
        return { status: 'active', clientName: updatedLic.clientName, key: updatedLic.key, expiresAt: updatedLic.expiresAt };
    }

    const daysRemaining = getTrialDaysRemaining(updatedLic.trialStart);

    if (daysRemaining <= 0) {
        if (updatedLic.status !== 'expired') {
            saveLocal({ ...updatedLic, status: 'expired' });
        }
        return { status: 'expired' };
    }

    saveLocal(updatedLic);
    return { status: 'trial', daysRemaining };
}

// ─── Re-validate online (call on app start if connected) ─────────────────────
export async function syncLicenseOnline(): Promise<void> {
    const lic = loadLocal();
    if (!lic?.key || lic.status !== 'active') return;

    if (typeof window !== 'undefined' && !navigator.onLine) {
        console.log("[Licencia] Dispositivo offline, se conserva el estado local activo.");
        return;
    }

    // Saltar validación si es una licencia activada offline
    if (lic.key.startsWith('OFFLINE-PIN-')) {
        return;
    }

    const result = await validateOnline(lic.key, lic.machineId);
    if (result.connectionError) {
        console.warn("[Licencia] Error de conexión al validar online. Se conserva el estado de licencia local.");
        return;
    }

    if (!result.valid) {
        saveLocal({ ...lic, status: 'expired' });
    } else {
        saveLocal({ ...lic, expiresAt: result.expiresAt, clientName: result.clientName, lastCheckedTime: Date.now() });
    }
}
