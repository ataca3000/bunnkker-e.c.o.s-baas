/**
 * .certificate/checklogic.js
 * Script de validación y diagnóstico de pasillos lógicos y comunicación local.
 * 
 * Uso: node .certificate/checklogic.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('====================================================');
console.log('⚡  BUNKKER E.C.O.S. — DIAGNÓSTICO DE LÓGICA Y ENLACE');
console.log('====================================================\n');

const ROOT_DIR = path.resolve(__dirname, '..');
const results = { passed: [], warnings: [], errors: [] };

function check(label, fn) {
    try {
        const res = fn();
        if (res === true) {
            results.passed.push(label);
            console.log(`[OK] ${label}`);
        } else if (typeof res === 'string') {
            results.warnings.push(`${label}: ${res}`);
            console.log(`[WARN] ${label}: ${res}`);
        }
    } catch (err) {
        results.errors.push(`${label}: ${err.message}`);
        console.log(`[FAIL] ${label}: ${err.message}`);
    }
}

// 1. Módulos de Lógica Crítica
check('Verificar radio-server.js', () => fs.existsSync(path.join(ROOT_DIR, 'radio-server.js')));
check('Verificar sqlite-service.ts', () => fs.existsSync(path.join(ROOT_DIR, 'src', 'lib', 'sqlite-service.ts')));
check('Verificar audit.ts (Auditoría Cifrada)', () => fs.existsSync(path.join(ROOT_DIR, 'src', 'lib', 'audit.ts')));
check('Verificar localSync.ts (P2P WebSocket)', () => fs.existsSync(path.join(ROOT_DIR, 'src', 'lib', 'localSync.ts')));
check('Verificar engine.ts (Motor IA Local)', () => fs.existsSync(path.join(ROOT_DIR, 'src', 'lib', 'ai', 'engine.ts')));
check('Verificar balanceEffect.ts (Efecto Balanza)', () => fs.existsSync(path.join(ROOT_DIR, 'src', 'lib', 'ai', 'balanceEffect.ts')));
check('Verificar spintax.ts (Omnipulse Marketing)', () => fs.existsSync(path.join(ROOT_DIR, 'src', 'lib', 'omnipulse', 'spintax.ts')));

// 2. Comprobar endpoints del Radio Server si está activo
function checkRadioServer(port) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
            resolve(true);
        });
        req.on('error', () => {
            resolve(`Puerto ${port} inactivo (servidor detenido)`);
        });
        req.setTimeout(1000, () => {
            req.destroy();
            resolve(`Timeout en puerto ${port}`);
        });
    });
}

(async () => {
    const radio3001 = await checkRadioServer(3001);
    if (radio3001 === true) {
        console.log('[OK] Radio Server (Data Sync Puerto 3001): En línea');
    } else {
        console.log(`[INFO] Radio Server Data (Puerto 3001): ${radio3001}`);
    }

    console.log('\n--- RESUMEN DIAGNÓSTICO ---');
    console.log(`✅ Aprobados: ${results.passed.length}`);
    console.log(`⚠️ Advertencias: ${results.warnings.length}`);
    console.log(`❌ Errores: ${results.errors.length}`);
    console.log('====================================================\n');
})();
