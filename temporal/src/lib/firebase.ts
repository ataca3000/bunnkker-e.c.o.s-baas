import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, disableNetwork } from 'firebase/firestore';
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
// Al ser una instancia real de FirebaseFirestore, satisface las validaciones internas
// del SDK de Firebase (como doc(db, ...)), eliminando el error "Expected first argument to doc() to be...".
export const db = getFirestore(app);

// Si estamos en modo Local-First o sin credenciales de la nube, desactivamos la red
// para que Firestore trabaje en modo offline local de 0 latencia sin lanzar errores.
if (typeof window !== 'undefined') {
  const isLocalFirst = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 
                       process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'MY_FIREBASE_API_KEY' ||
                       process.env.NEXT_PUBLIC_FIREBASE_API_KEY === '';
  if (isLocalFirst) {
    disableNetwork(db).catch(() => {});
  }
}

// ─── Instancia de Auth & Storage ──────────────────────────────────────────────
export const auth = getAuth(app);
export const storage = null as any;
