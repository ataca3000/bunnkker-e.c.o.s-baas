import { getApps, initializeApp, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const createMockDoc = (_docId?: string) => ({
  get: async () => ({ exists: false, data: (): any => ({}) }),
  set: async (..._args: any[]) => ({}),
  update: async (..._args: any[]) => ({}),
  delete: async (..._args: any[]) => ({}),
});

const createMockCollection = (_colName?: string) => ({
  doc: (_docId?: string) => createMockDoc(_docId),
  add: async (..._args: any[]) => ({ id: 'mock-id' }),
  where: (..._args: any[]) => createMockCollection(_colName),
  orderBy: (..._args: any[]) => createMockCollection(_colName),
  limit: (..._args: any[]) => createMockCollection(_colName),
  get: async (): Promise<any> => ({ empty: true, docs: [] as any[] }),
});

const mockDb = {
  collection: (_name?: string) => createMockCollection(_name),
  doc: (_path?: string) => createMockDoc(_path),
  batch: () => ({
    set: (..._args: any[]) => {},
    update: (..._args: any[]) => {},
    delete: (..._args: any[]) => {},
    commit: async () => {},
  }),
};

const mockAuthAdmin = {
  verifyIdToken: async (token: string) => {
    if (token === 'valid-mock-token' || process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      return { uid: 'local-admin-uid', role: 'superadmin', email: 'admin@bunkker.local' };
    }
    throw new Error('FIREBASE_AUTH_UNAVAILABLE: No hay credenciales de Firebase Admin configuradas en el servidor de producción.');
  },
  getUser: async (uid: string) => ({ uid, email: 'admin@bunkker.local' }),
};

let realApp: App | null = null;

const serviceAccountKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
const hasEnvCredentials = Boolean(
  serviceAccountKeyJson ||
    (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
);

const configuredProjectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  firebaseAppletConfig?.projectId ||
  undefined;

if (hasEnvCredentials) {
  try {
    const apps = getApps();
    if (!apps.length) {
      let credential;
      if (serviceAccountKeyJson) {
        try {
          credential = cert(JSON.parse(serviceAccountKeyJson));
        } catch (e) {
          console.error('Error parseando FIREBASE_SERVICE_ACCOUNT_KEY:', e);
        }
      } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        credential = cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        credential = applicationDefault();
      }

      if (credential) {
        realApp = initializeApp({
          credential,
          ...(configuredProjectId ? { projectId: configuredProjectId } : {}),
        });
        console.log('🔥 [Firebase Admin] Conexión real inicializada con Google Cloud.');
      }
    } else {
      realApp = apps[0]!;
    }
  } catch (err) {
    console.warn('⚠️ [Firebase Admin] Error al inicializar con credenciales reales, usando cápsula mock:', err);
  }
}

export const hasAdminMessagingCredentials = Boolean(realApp);

const configuredDatabaseId =
  process.env.FIREBASE_DATABASE_ID ||
  (firebaseAppletConfig as Record<string, string | undefined>)?.firestoreDatabaseId;

export const adminDb = realApp
  ? ((configuredDatabaseId && configuredDatabaseId !== '(default)'
      ? getFirestore(realApp, configuredDatabaseId)
      : getFirestore(realApp)) as any)
  : (mockDb as any);
export const db = adminDb;
export const auth = realApp ? (getAuth(realApp) as any) : (mockAuthAdmin as any);
export const adminMessaging: Messaging | null = realApp ? getMessaging(realApp) : null;
