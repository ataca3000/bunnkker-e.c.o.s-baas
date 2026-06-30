// Escape hatch to prevent Next.js ESM crashes with Firebase Admin
const admin = require('firebase-admin');

let adminDb;

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    adminDb = admin.firestore();
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
} else {
  adminDb = admin.firestore();
}

export { adminDb };
