import { logAudit } from './audit';
import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export class FirestoreError extends Error {
  constructor(public info: FirestoreErrorInfo) {
    super(info.error);
    this.name = 'FirestoreError';
  }
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

/**
 * Función robusta para interceptar y estructurar errores de Firestore
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.error('Firestore Error Detailed: ', JSON.stringify(errInfo));
  
  // Registrar el log detallado de manera asíncrona pero sin trabar la UI
  reportError(new Error(JSON.stringify(errInfo)), `Firestore - ${operationType} - ${path}`).catch(() => {});
  
  throw new FirestoreError(errInfo);
}

/**
 * Monitor global de errores. 
 * Registra en el log de auditoría y dispara notificaciones críticas.
 */
export async function reportError(error: any, context: string, user?: any) {
    console.error(`🚨 [Monitoring - ${context}]:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    // 1. Registrar en Auditoría (Firestore)
    try {
        await logAudit({
            type: 'SECURITY_ALERT',
            userId: user?.uid || auth?.currentUser?.uid || 'SYSTEM_MONITOR',
            userName: user?.displayName || auth?.currentUser?.email || 'Sistema Autónomo',
            userRole: user?.role || 'monitor',
            description: `ERROR CRÍTICO en ${context}: ${errorMessage}`,
            metadata: {
                stack: error instanceof Error ? error.stack : null,
                context
            }
        });
    } catch (auditErr) {
        console.error("El registro de auditoría también falló:", auditErr);
    }

    // 2. Disparar Correo de Alerta (Vía API para no exponer credenciales)
    try {
        await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'ERROR_CRITICAL',
                data: {
                    message: errorMessage,
                    userName: user?.displayName || auth?.currentUser?.email || 'Sistema',
                    userId: user?.uid || auth?.currentUser?.uid || 'N/A'
                }
            })
        });
    } catch (e) {
        console.error("Fallo al enviar notificación de error:", e);
    }
}
