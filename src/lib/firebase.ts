import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, disableNetwork, enableNetwork } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyLocalDummyKeyForOfflineMode000",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "bunkker-local-app.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bunkker-local-app",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "bunkker-local-app.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "848317819375",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:848317819375:web:29580474544fc9794e2e1a",
};

// ─── Inicialización de Firebase App ───────────────────────────────────────────
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ─── Instancia Real de Firestore ──────────────────────────────────────────────
export const db = getFirestore(app);

// ─── Detección: ¿hay credenciales reales de nube? ────────────────────────────
const DUMMY_KEYS = ['', 'MY_FIREBASE_API_KEY', 'AIzaSyLocalDummyKeyForOfflineMode000'];
const DUMMY_PROJECTS = ['', 'bunkker-local-app', 'demo-project'];
export const hasRealCredentials =
  !DUMMY_KEYS.includes(process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '') &&
  !DUMMY_PROJECTS.includes(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'bunkker-local-app');

if (!hasRealCredentials) {
  // Modo local-first (tanto cliente como servidor Node.js): sin red, cero latencia, sin errores GrpcConnection PERMISSION_DENIED
  disableNetwork(db).catch(() => {});
}

if (typeof window !== 'undefined') {
  if (hasRealCredentials) {
    // Modo nube: reconexión automática cuando el stream TCP se corta
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
    window.addEventListener('online',  () => {
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
  }
}

// ─── Instancia de Auth & Storage ──────────────────────────────────────────────
export const auth = getAuth(app);
export const storage = null as any;
