// Firebase Admin Mock Capsule (Colmena B2B Local-First)
// Evita que el servidor Next.js intente conectarse a los servicios de Google Cloud

console.warn("🐝 [COLMENA B2B] Firebase Admin MOCK Activado. Sin dependencias externas.");

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

const mockDb = {
    collection: () => createMockCollection(),
    batch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} })
};

const mockAuthAdmin = {
    verifyIdToken: async (token: string) => ({ uid: 'local-admin-uid', role: 'superadmin' }),
    getUser: async (uid: string) => ({ uid, email: 'admin@bunkker.local' })
};

export const adminDb = mockDb;
export const db = mockDb;
export const auth = mockAuthAdmin;

