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
            systemVersion: '1.0.0-PRO'
        });

        // Si estamos en Electron, guardamos una copia local inmediata (Local-First)
        if (isNode) {
            try {
                const req = (globalThis as any).require;
                if (!req) return;
                const fs = req('fs');
                const path = req('path');
                const os = req('os');

                const logsDir = path.join(os.homedir(), '.admincom_erp');
                const logFile = path.join(logsDir, 'audit_local.jsonl');

                if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

                const localEntry = JSON.stringify({
                    ...action,
                    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                    isLocal: true
                }) + '\n';

                fs.appendFileSync(logFile, localEntry, 'utf8');
            } catch (e) {
                console.error("Error writing local audit file:", e);
            }
        }

        await firebasePromise;
    } catch (error) {
        console.error("❌ CRITICAL: Failed to write audit log:", error);
    }
}
