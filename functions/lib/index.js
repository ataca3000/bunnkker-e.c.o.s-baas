"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadBackup = exports.uploadBackup = exports.pairDesktopNode = exports.generatePairingCode = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
// Generates a secure 6-digit pairing code for a PRO Tenant
exports.generatePairingCode = functions.https.onCall(async (data, context) => {
    // In a real app, require context.auth to verify the tenant is logged in online
    const tenantId = data.tenantId || (context.auth ? context.auth.uid : 'demo-tenant');
    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await db.collection('pairings').doc(code).set({
        tenantId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
    });
    return { success: true, code };
});
// The Desktop App calls this to pair itself using the 6-digit code
exports.pairDesktopNode = functions.https.onCall(async (data, context) => {
    const { code, machineId } = data;
    if (!code || !machineId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing code or machineId');
    }
    const pairingRef = db.collection('pairings').doc(code);
    const doc = await pairingRef.get();
    if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Pairing code not found or expired');
    }
    const pairingData = doc.data();
    if (pairingData.status !== 'pending') {
        throw new functions.https.HttpsError('failed-precondition', 'Code already used');
    }
    // Create the Node record
    await db.collection('nodes').doc(machineId).set({
        tenantId: pairingData.tenantId,
        pairedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSync: null,
        status: 'active'
    });
    // Mark code as used
    await pairingRef.update({ status: 'used', machineId });
    return { success: true, tenantId: pairingData.tenantId };
});
// ─── Edge Computing Sync Engine (Snapshots Encriptados) ───
exports.uploadBackup = functions.https.onRequest(async (req, res) => {
    // Enable CORS for potential web clients
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    try {
        const { tenantId, token, payload } = req.body;
        if (!tenantId || !token || !payload) {
            res.status(400).json({ success: false, error: 'Missing tenantId, token, or payload' });
            return;
        }
        // Verify token (In a real app, query SQLite/Firestore to validate token against tenantId)
        // Here we just ensure they provided the required fields.
        const bucket = admin.storage().bucket('admin-erp-pro-1.firebasestorage.app');
        const file = bucket.file(`backups/${tenantId}/BUNKKER_SECURE_BACKUP.txt`);
        await file.save(payload, {
            contentType: 'text/plain',
            metadata: {
                metadata: {
                    uploadedAt: new Date().toISOString()
                }
            }
        });
        // Register the sync log in Firestore for auditing
        await db.collection('tenants').doc(tenantId).collection('sync_logs').add({
            action: 'UPLOAD_BACKUP',
            receivedAt: admin.firestore.FieldValue.serverTimestamp(),
            dataSize: payload.length
        });
        res.status(200).json({ success: true, message: 'Backup successfully stored in Edge Cloud' });
    }
    catch (error) {
        console.error('Error uploading backup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.downloadBackup = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    try {
        const { tenantId, token } = req.body;
        if (!tenantId || !token) {
            res.status(400).json({ success: false, error: 'Missing tenantId or token' });
            return;
        }
        const bucket = admin.storage().bucket('admin-erp-pro-1.firebasestorage.app');
        const file = bucket.file(`backups/${tenantId}/BUNKKER_SECURE_BACKUP.txt`);
        const [exists] = await file.exists();
        if (!exists) {
            res.status(404).json({ success: false, error: 'No cloud backup found for this tenant.' });
            return;
        }
        const [content] = await file.download();
        const payload = content.toString('utf8');
        res.status(200).json({ success: true, payload });
    }
    catch (error) {
        console.error('Error downloading backup:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
//# sourceMappingURL=index.js.map