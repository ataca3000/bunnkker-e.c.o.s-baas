// Firebase Mock Capsule (Colmena B2B Local-First)
// Este archivo simula la API de Firebase para engañar al frontend
// y redirigir todo el tráfico a la lógica local (Tópicos / Excel / SQLite)

console.warn("🐝 [COLMENA B2B] Cápsula Firebase Activada. Modo Local-First estricto.");

// Mock de Auth (Acepta cualquier login)
const mockAuth = {
  currentUser: { uid: 'local-admin-uid', email: 'admin@bunkker.local' },
  signInWithEmailAndPassword: async (email, password) => {
    console.log(`[Mock Auth] Login simulado para ${email}`);
    return { user: { uid: 'local-admin-uid', email } };
  },
  signOut: async () => console.log('[Mock Auth] SignOut simulado'),
  onAuthStateChanged: (cb) => { cb({ uid: 'local-admin-uid' }); return () => {}; }
};

// Mock de Firestore (Usa localStorage o en memoria temporalmente para no romper UI)
const createMockDocRef = (path) => ({
  id: path.split('/').pop(),
  path,
  withConverter: () => createMockDocRef(path)
});

const createMockQuery = () => ({
  where: () => createMockQuery(),
  orderBy: () => createMockQuery(),
  limit: () => createMockQuery()
});

const mockDb = {
  // Simulador de Proxy para capturar cualquier llamada a db.collection, db.doc, etc.
};

// Implementaremos las funciones exportables que usa el SDK v9 de Firebase
export const initializeApp = () => ({ name: '[MockApp]' });
export const getApps = () => [];
export const getApp = () => ({ name: '[MockApp]' });
export const initializeFirestore = () => mockDb;
export const getAuth = () => mockAuth;
export const getStorage = () => ({});
export const enableMultiTabIndexedDbPersistence = async () => {};
export const CACHE_SIZE_UNLIMITED = -1;

export const collection = (db, path) => createMockQuery();
export const doc = (db, path, ...segments) => createMockDocRef(path + (segments.length ? '/' + segments.join('/') : ''));
export const getDoc = async (docRef) => ({ exists: () => false, data: () => ({}) });
export const getDocs = async (query) => ({ empty: true, docs: [], forEach: () => {} });
export const setDoc = async (docRef, data, options) => { console.log('[Mock DB] setDoc', docRef.path, data); };
export const addDoc = async (colRef, data) => { console.log('[Mock DB] addDoc', data); return { id: 'mock-id' }; };
export const updateDoc = async (docRef, data) => { console.log('[Mock DB] updateDoc', docRef.path, data); };
export const deleteDoc = async (docRef) => { console.log('[Mock DB] deleteDoc', docRef.path); };
export const onSnapshot = (ref, cb) => { cb({ docs: [], data: () => ({}), exists: () => true }); return () => {}; };

export const app = initializeApp();
export const db = mockDb;
export const auth = mockAuth;
export const storage = getStorage();
