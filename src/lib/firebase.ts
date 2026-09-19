import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, disableNetwork, enableNetwork } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSy-LOCAL-DEV-PLACEHOLDER-NOT-REAL",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:000000000000:web:000000000000000000",
};

// ─── Inicialización de Firebase App ───────────────────────────────────────────
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ─── Instancia Real de Firestore ──────────────────────────────────────────────
export const db = getFirestore(app);

// ─── Detección: ¿hay credenciales reales de nube? ────────────────────────────
const DUMMY_KEYS = ['', 'MY_FIREBASE_API_KEY', 'AIzaSyLocalDummyKeyForOfflineMode000'];
const hasRealCredentials = !DUMMY_KEYS.includes(
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? ''
);

if (typeof window !== 'undefined') {
  if (!hasRealCredentials) {
    // Modo local-first: sin red, cero latencia, sin errores de stream TCP
    disableNetwork(db).catch(() => {});
  } else {
    // Modo nube: reconexión automática cuando el stream TCP se corta
    // (Error: wsarecv / stream reading error — es normal en conexiones largas)
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
          _backoffMs = 2000; // reset al reconectar exitosamente
        } catch {
          _backoffMs = Math.min(_backoffMs * 2, MAX_BACKOFF);
          scheduleReconnect();
        }
      }, _backoffMs);
    };

    // Escuchar eventos de red del navegador para forzar reconexión
    window.addEventListener('offline', () => disableNetwork(db).catch(() => {}));
    window.addEventListener('online',  () => {
      _backoffMs = 2000;
      enableNetwork(db).catch(scheduleReconnect);
    });

    // Detectar errores de red de Firestore sin monkey-patching console.error.
    // Los errores de stream TCP (wsarecv, WebChannelConnection) son transitorios
    // y no requieren acción del usuario — solo reconexión silenciosa.
    window.addEventListener('unhandledrejection', (event) => {
      const msg = String(event?.reason?.message ?? event?.reason ?? '');
      if (
        msg.includes('stream reading error') ||
        msg.includes('wsarecv') ||
        msg.includes('WebChannelConnection') ||
        msg.includes('transport errored')
      ) {
        // Error de red transitorio de Firestore — ignorar y reconectar
        event.preventDefault();
        scheduleReconnect();
      }
    });
  }
}

// ─── Instancia de Auth & Storage ──────────────────────────────────────────────
export const auth = getAuth(app);
export const storage = null as any;
