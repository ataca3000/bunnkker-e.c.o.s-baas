// Firebase Admin Mock Capsule (Colmena B2B Local-First)
// Evita que el servidor Next.js intente conectarse a los servicios de Google Cloud

console.warn("🐝 [COLMENA B2B] Firebase Admin MOCK Activado. Sin dependencias externas.");

const createMockDoc = (_docId?: string) => ({
    get: async () => ({ exists: false, data: (): any => ({}) }),
    set: async (..._args: any[]) => ({}),
    update: async (..._args: any[]) => ({}),
    delete: async (..._args: any[]) => ({})
});

const createMockCollection = (_colName?: string) => ({
    doc: (_docId?: string) => createMockDoc(_docId),
    add: async (..._args: any[]) => ({ id: 'mock-id' }),
    where: (..._args: any[]) => createMockCollection(_colName),
    orderBy: (..._args: any[]) => createMockCollection(_colName),
    limit: (..._args: any[]) => createMockCollection(_colName),
    get: async (): Promise<any> => ({ empty: true, docs: [] as any[] })
});

const mockDb = {
    collection: (_name?: string) => createMockCollection(_name),
    doc: (_path?: string) => createMockDoc(_path),
    batch: () => ({ set: (..._args: any[]) => {}, update: (..._args: any[]) => {}, delete: (..._args: any[]) => {}, commit: async () => {} })
};

const mockAuthAdmin = {
    verifyIdToken: async (_token: string) => ({ uid: 'local-admin-uid', role: 'superadmin' }),
    getUser: async (uid: string) => ({ uid, email: 'admin@bunkker.local' })
};

export const adminDb = mockDb;
export const db = mockDb;
export const auth = mockAuthAdmin;

