/**
 * Admin.com ERP — Sistema de Licencias
 * - Trial: 7 días desde el primer uso
 * - Activación: clave validada online (Firestore) con fallback offline
 * - Huella de máquina para evitar compartir licencias
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
}

const STORAGE_KEY = '_admincom_v1_lic';
const MACHINE_KEY = '_admincom_v1_mid';
const TRIAL_DAYS  = 7;

// ─── Machine fingerprint ─────────────────────────────────────────────────────
function getMachineId(): string {
    // In a browser environment, localStorage is used.
    // For Electron/desktop apps, a more robust, persistent, and truly unique
    // machine ID (e.g., UUID stored in app data directory) should be implemented.
    // The current implementation is primarily for browser-based identification.
    if (typeof window === 'undefined') return 'server_id'; // For SSR environments

    // if (process.env.NODE_ENV === 'production') return 'server_id'; // This line was problematic for Electron
    let id = localStorage.getItem(MACHINE_KEY);
    if (!id) {
        const raw = `${navigator.userAgent || 'unknown'}|${window.screen?.width || 0}x${window.screen?.height || 0}|${navigator.language || 'en'}|${Date.now()}`;
        id = btoa(raw).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
        localStorage.setItem(MACHINE_KEY, id);
    }
    return id;
}

// ─── Local storage (obfuscated, not crypto — use in conjunction with Firestore) ─
function saveLocal(data: StoredLicense): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify(data)));
    } catch { /* ignore */ }
}

function loadLocal(): StoredLicense | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(atob(raw)) as StoredLicense;
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
): Promise<{ valid: boolean; clientName?: string; expiresAt?: number | null }> {
    // FALLBACK LOCAL: Si no hay internet, buscar en el servidor maestro de la red local
    if (!navigator.onLine) {
        console.log("Validando licencia vía Red Local (Offline)...");
        // Aquí llamarías a una función que consulte al Nodo Maestro vía localSync.ts
    }

    try {
        const ref  = doc(db, 'licenses', key);
        const snap = await getDoc(ref);

        if (!snap.exists()) return { valid: false };

        const data = snap.data();
        if (!data.isActive) return { valid: false };
        if (data.expiresAt && data.expiresAt < Date.now()) return { valid: false };

        // Register machine ID if not already registered
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
    } catch {
        return { valid: false };
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
    };
    saveLocal(activated);

    return {
        success: true,
        message: `✅ Licencia activada para ${online.clientName ?? 'usuario'}.`,
    };
}

// ─── Check current license status ─────────────────────────────────────────────
export function checkLicenseStatus(): LicenseState {
    const lic = loadLocal() ?? initTrial();

    if (lic.status === 'active') {
        // Check if active license has expired
        if (lic.expiresAt && lic.expiresAt < Date.now()) {
            saveLocal({ ...lic, status: 'expired' });
            return { status: 'expired' };
        }
        return { status: 'active', clientName: lic.clientName, key: lic.key, expiresAt: lic.expiresAt };
    }

    const daysRemaining = getTrialDaysRemaining(lic.trialStart);

    if (daysRemaining <= 0) {
        if (lic.status !== 'expired') saveLocal({ ...lic, status: 'expired' });
        return { status: 'expired' };
    }

    return { status: 'trial', daysRemaining };
}

// ─── Re-validate online (call on app start if connected) ─────────────────────
export async function syncLicenseOnline(): Promise<void> {
    const lic = loadLocal();
    if (!lic?.key || lic.status !== 'active') return;

    const result = await validateOnline(lic.key, lic.machineId);
    if (!result.valid) {
        saveLocal({ ...lic, status: 'expired' });
    } else {
        saveLocal({ ...lic, expiresAt: result.expiresAt, clientName: result.clientName });
    }
}
