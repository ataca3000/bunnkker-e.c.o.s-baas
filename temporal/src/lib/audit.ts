import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type AuditAction =
    | 'LOGIN'
    | 'LOGOUT'
    | 'PRICE_CHANGE'
    | 'STOCK_UPDATE'
    | 'ORDER_CREATE'
    | 'ORDER_CANCEL'
    | 'USER_CREATE'
    | 'ROLE_CHANGE'
    | 'CONFIG_UPDATE'
    | 'SECURITY_ALERT'
    | 'AUTH_SUCCESS'
    | 'AUTH_FAILURE'
    | 'AUTH_RESCUE_FAILURE'
    | 'AI_CLASSIFICATION'
    | 'INVENTORY_MOVE'
    | 'CORTE_CAJA_CIEGO'
    | 'ORDER_CANCELLED';

export interface AuditLog {
    type: AuditAction;
    userId: string;
    userName: string;
    userRole: string;
    description: string;
    metadata?: {
        total?: number;
        paymentMethod?: string;
        cashierId?: string;
        cashierName?: string;
        declaredAmount?: number;
        expectedAmount?: number;
        discrepancy?: number;
        productId?: string;
        productName?: string;
        oldPrice?: number;
        newPrice?: number;
        stockIncrement?: number;
        errorDetails?: string;
        [key: string]: unknown;
    };
    timestamp?: any;
    isLocal?: boolean; // Campo extra para identificar el origen en la UI
}

/**
 * Registra una acción en el log de auditoría inmutable.
 * Como las reglas de Firestore bloquean edición/borrado, esto crea un rastro permanente.
 */
export async function logAudit(action: AuditLog) {
    const isNode = typeof window === 'undefined';

    try {
        const logRef = collection(db, 'audit_logs');
        const firebasePromise = addDoc(logRef, {
            ...action,
            isoDate: new Date().toISOString(),
            timestamp: serverTimestamp(),
            systemVersion: 'BUNKKER-1.0.0-PRO'
        });

        // Si estamos en Electron, guardamos una copia local inmediata (Local-First) cifrada
        if (isNode) {
            try {
                const req = (globalThis as any).require;
                if (!req) return;
                const fs = req('fs');
                const path = req('path');
                const os = req('os');
                const nodeCrypto = req('crypto');

                const logsDir = path.join(os.homedir(), '.bunkker_erp');
                const legacyDir = path.join(os.homedir(), '.admincom_erp');
                const logFile = path.join(logsDir, 'audit_local.jsonl');

                if (!fs.existsSync(logsDir)) {
                    fs.mkdirSync(logsDir, { recursive: true });
                    // Migrar logs existentes del directorio antiguo
                    const legacyLog = path.join(legacyDir, 'audit_local.jsonl');
                    if (fs.existsSync(legacyLog)) {
                        try {
                            fs.copyFileSync(legacyLog, logFile);
                            console.info('[BUNKKER/Audit] Migración de audit log: .admincom_erp → .bunkker_erp');
                        } catch { /* si falla la migración, no es crítico */ }
                    }
                }

                const localEntry = JSON.stringify({
                    ...action,
                    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                    isLocal: true
                });

                // Cifrar la línea de log con AES-256-CBC usando el secreto del servidor
                let encryptedLine = localEntry;
                try {
                    const secret = process.env.INTERNAL_API_SECRET;
                    if (!secret || secret.trim() === '') {
                        if (process.env.NODE_ENV === 'production') {
                            // En producción, NO ciframos con un secreto conocido — fallamos explícitamente
                            throw new Error('[AUDIT/SECURITY] INTERNAL_API_SECRET no configurado en producción. El log de auditoría no puede escribirse de forma segura.');
                        }
                        console.warn('[AUDIT] ⚠️ INTERNAL_API_SECRET no configurado. El log de auditoría local usa secreto de desarrollo.');
                    }
                    const effectiveSecret = secret || 'dev-only-audit-secret-not-for-production';
                    const key = nodeCrypto.createHash('sha256').update(effectiveSecret).digest();
                    const iv = nodeCrypto.randomBytes(16);
                    const cipher = nodeCrypto.createCipheriv('aes-256-cbc', key, iv);
                    let encrypted = cipher.update(localEntry, 'utf8', 'hex');
                    encrypted += cipher.final('hex');
                    encryptedLine = `${iv.toString('hex')}:${encrypted}`;
                } catch (cryptErr) {
                    console.error("Failed to encrypt audit line:", cryptErr);
                }

                fs.appendFileSync(logFile, encryptedLine + '\n', 'utf8');
            } catch (e) {
                console.error("Error writing local audit file:", e);
            }
        }

        // Hacemos que Firebase guarde en segundo plano para que no congele la UI
        // si la conexión a internet está inestable o es lenta.
        firebasePromise.catch(err => {
            console.warn("⚠️ [AUDIT] Error o demora guardando auditoría en Firebase:", err);
        });
    } catch (error) {
        console.error("❌ CRITICAL: Failed to write audit log:", error);
    }
}
