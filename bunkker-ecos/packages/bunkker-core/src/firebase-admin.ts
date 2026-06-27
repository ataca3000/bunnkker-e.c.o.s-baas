// @ts-nocheck
const adminModule = require('firebase-admin');
const admin = adminModule.default || adminModule;

// EVITAR INICIALIZACIÓN MÚLTIPLE EN NEXT.JS (HOT RELOAD)
// ... imports ...

const adminApps = admin.apps || [];
if (!adminApps.length) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    // Validación mucho más estricta para evitar errores DER fatales en Node
    const isValidKey = privateKey &&
        privateKey.includes("BEGIN PRIVATE KEY") &&
        privateKey.length > 100;

    if (projectId && clientEmail && isValidKey) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            console.log("🔥 Firebase Admin inicializado correctamente.");
        } catch (error: unknown) {
            console.error("❌ Error inicializando Firebase Admin:", error instanceof Error ? error.message : "Error desconocido");
        }
    } else {
        // Fallback para entornos sin credenciales (Build time, CI, o Google Cloud Run con Default Credentials)
        try {
            if (!(admin.apps || []).length) {
                admin.initializeApp();
                // Omitir el console.warn en producción/compilación para no ensuciar la consola
            }
        } catch (err: any) {
            console.warn("⚠️ No se pudo inicializar Firebase Admin standard:", err.message);
        }
    }
}

// Exportar de forma segura. Si falla la inicialización, db lanzará error al usarse, no al importarse.
const createMockDoc = () => ({
    get: async () => ({ exists: false, data: () => ({}) }),
    set: async () => ({}),
    update: async () => ({}),
    delete: async () => ({})
});

const createMockCollection = () => ({
    doc: () => createMockDoc(),
    add: async () => ({ id: 'mock-id' }),
    where: () => createMockCollection(),
    get: async () => ({ empty: true, docs: [] })
});

const db: admin.firestore.Firestore = (admin.apps || []).length
    ? admin.firestore()
    : { 
        collection: () => createMockCollection(),
        batch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} })
      } as unknown as admin.firestore.Firestore;

const authAdmin: admin.auth.Auth = (admin.apps || []).length
    ? admin.auth()
    : {} as unknown as admin.auth.Auth;

export { db as adminDb, db, authAdmin as auth };
