import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, disableNetwork, enableNetwork, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseAppletConfig from '../../firebase-applet-config.json';

const DUMMY_KEYS = ['', 'MY_FIREBASE_API_KEY', 'AIzaSyLocalDummyKeyForOfflineMode000'];
const DUMMY_PROJECTS = ['', 'bunkker-local-app', 'demo-project'];

const appletProjectId = firebaseAppletConfig?.projectId || '';
const appletApiKey = firebaseAppletConfig?.apiKey || '';

const typedAppletConfig = firebaseAppletConfig as Record<string, string | undefined>;

export const firebasePublicConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || appletApiKey || 'AIzaSyLocalDummyKeyForOfflineMode000',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || typedAppletConfig?.authDomain || 'bunkker-local-app.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || appletProjectId || 'bunkker-local-app',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || typedAppletConfig?.storageBucket || 'bunkker-local-app.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || typedAppletConfig?.messagingSenderId || '848317819375',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || typedAppletConfig?.appId || '1:848317819375:web:29580474544fc9794e2e1a',
  firestoreDatabaseId: typedAppletConfig?.firestoreDatabaseId || '(default)',
};

export const app = getApps().length === 0 ? initializeApp(firebasePublicConfig) : getApp();

export const db =
  firebasePublicConfig.firestoreDatabaseId && firebasePublicConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebasePublicConfig.firestoreDatabaseId)
    : getFirestore(app);

export const hasRealCredentials =
  !DUMMY_KEYS.includes(firebasePublicConfig.apiKey) &&
  !DUMMY_PROJECTS.includes(firebasePublicConfig.projectId);

if (!hasRealCredentials) {
  disableNetwork(db).catch(() => {});
}

if (typeof window !== 'undefined') {
  if (hasRealCredentials) {
    let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let _backoffMs = 2000;
    const MAX_BACKOFF = 60_000;

    const scheduleReconnect = () => {
      if (_reconnectTimer) return;
      _reconnectTimer = setTimeout(async () => {
        _reconnectTimer = null;
        try {
          await disableNetwork(db);
          await enableNetwork(db);
          _backoffMs = 2000;
        } catch {
          _backoffMs = Math.min(_backoffMs * 2, MAX_BACKOFF);
          scheduleReconnect();
        }
      }, _backoffMs);
    };

    window.addEventListener('offline', () => disableNetwork(db).catch(() => {}));
    window.addEventListener('online', () => {
      _backoffMs = 2000;
      enableNetwork(db).catch(scheduleReconnect);
    });

    const _origConsoleError = console.error.bind(console);
    console.error = (...args: any[]) => {
      const msg = String(args[0] ?? '');
      if (
        msg.includes('stream reading error') ||
        msg.includes('wsarecv') ||
        msg.includes('WebChannelConnection') ||
        msg.includes('transport errored')
      ) {
        scheduleReconnect();
        return;
      }
      _origConsoleError(...args);
    };

    // Validación inicial de conectividad Firestore cuando existe sesión Firebase activa
    const firebaseAuth = getAuth(app);
    firebaseAuth.onAuthStateChanged((fbUser: unknown) => {
      if (!fbUser) return;
      getDocFromServer(doc(db, 'test', 'connection')).catch((error: unknown) => {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error('Please check your Firebase configuration.');
        }
      });
    });
  }
}

const mockAuth = {
  currentUser: null,
  onAuthStateChanged: (cb: any) => {
    cb(null);
    return () => {};
  },
  signOut: async () => {},
};

export const auth = hasRealCredentials ? getAuth(app) : (mockAuth as any);
export const storage = null as any;
