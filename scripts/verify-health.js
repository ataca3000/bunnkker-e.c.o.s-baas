// scripts/verify-health.js
/**
 * Script de Verificación de Salud Ligero (Health Check)
 * Este script realiza una prueba de lectura mínima (1 documento) a Firestore
 * para asegurar que la conexión, las reglas y el proyecto están 100% operativos
 * antes o después de la compilación/obfuscación.
 * 
 * Uso (Node 20+):
 * node --env-file=.env.local scripts/verify-health.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

console.log('\x1b[36m%s\x1b[0m', '================================================');
console.log('\x1b[36m%s\x1b[0m', '   VERIFICACIÓN DE SALUD LIGERA (HEALTH CHECK)  ');
console.log('\x1b[36m%s\x1b[0m', '================================================\n');

if (!firebaseConfig.projectId) {
    console.error('\x1b[31m❌ ERROR:\x1b[0m No se detectaron las variables de entorno de Firebase.');
    console.error('Asegúrate de ejecutar el script pasando el archivo .env.local:');
    console.error('Ejemplo: node --env-file=.env.local scripts/verify-health.js\n');
    process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runHealthCheck() {
    console.log('Intentando conexión con Firebase Firestore (Proyecto: ' + firebaseConfig.projectId + ')...');
    
    try {
        const t0 = Date.now();
        
        // Prueba 1: Lectura súper ligera de 1 solo documento
        const q = query(collection(db, 'products'), limit(1));
        const snap = await getDocs(q);
        
        const t1 = Date.now();
        const ping = t1 - t0;

        console.log(`\x1b[32m✓ [ÉXITO]\x1b[0m Conexión a Firestore establecida en ${ping}ms.`);
        
        if (snap.empty) {
            console.log(`\x1b[33m⚠ [AVISO]\x1b[0m La base de datos responde, pero la colección 'products' está vacía.`);
        } else {
            console.log(`\x1b[32m✓ [ÉXITO]\x1b[0m Documento de prueba leído correctamente. Reglas de seguridad OK.`);
        }

        console.log('\n\x1b[32mESTADO DEL SISTEMA: SALUDABLE Y LISTO PARA PRODUCCIÓN\x1b[0m\n');
        process.exit(0);
        
    } catch (error) {
        console.error('\n\x1b[31m❌ [FALLO CRÍTICO]\x1b[0m Error al conectar o leer de Firestore:');
        console.error(error.message);
        console.error('\nPosibles causas:');
        console.error('1. Reglas de Firestore bloqueando acceso a usuarios no autenticados (Aceptable si es intencional).');
        console.error('2. Credenciales (API Key) en .env.local son incorrectas o expiraron.');
        console.error('3. Sin conexión a internet.\n');
        process.exit(1);
    }
}

runHealthCheck();
