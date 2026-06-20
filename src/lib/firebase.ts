import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, CACHE_SIZE_UNLIMITED, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "placeholder",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "placeholder",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "placeholder",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "placeholder",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "placeholder",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "placeholder",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "placeholder"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
// Configuración de cache ilimitada para funcionamiento offline de larga duración
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
});

const auth    = getAuth(app);
const storage = getStorage(app);


// ── Offline persistence (works in browser & Electron) ──────────────────────
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err: Error & { code?: string }) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firebase] Offline persistence unavailable: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] Offline persistence not supported in this browser.');
    }
  });
}

export { app, db, auth, storage };
