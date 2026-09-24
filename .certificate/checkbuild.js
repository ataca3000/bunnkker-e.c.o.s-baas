/**
 * .certificate/checkbuild.js
 * Script de validación y diagnóstico del pipeline de compilación de BUNKKER E.C.O.S.
 * 
 * Uso: node .certificate/checkbuild.js
 */

const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('🏗️  BUNKKER E.C.O.S. — DIAGNÓSTICO DEL PIPELINE BUILD');
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

// 1. Archivos base de compilación
check('Verificar package.json', () => fs.existsSync(path.join(ROOT_DIR, 'package.json')));
check('Verificar copy-standalone.js', () => fs.existsSync(path.join(ROOT_DIR, 'copy-standalone.js')));
check('Verificar scripts/run-next-build.js', () => fs.existsSync(path.join(ROOT_DIR, 'scripts', 'run-next-build.js')));
check('Verificar next.config.ts', () => fs.existsSync(path.join(ROOT_DIR, 'next.config.ts')));
check('Verificar prisma/schema.prisma', () => fs.existsSync(path.join(ROOT_DIR, 'prisma', 'schema.prisma')));
check('Verificar electron-main.js y preload.js', () => 
    fs.existsSync(path.join(ROOT_DIR, 'electron-main.js')) && 
    fs.existsSync(path.join(ROOT_DIR, 'preload.js'))
);

// 2. Inspección del esquema Prisma
check('Inspección de Binary Targets en Prisma', () => {
    const schema = fs.readFileSync(path.join(ROOT_DIR, 'prisma', 'schema.prisma'), 'utf8');
    if (!schema.includes('binaryTargets')) return 'No tiene binaryTargets explícitos';
    if (!schema.includes('windows')) return 'Falta target windows para Electron local';
    return true;
});

// 3. Inspección de configuración Electron Builder
check('Configuración de extraResources para Electron', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
    if (!pkg.build || !pkg.build.extraResources) return 'Falta build.extraResources en package.json';
    return true;
});

console.log('\n--- RESUMEN DIAGNÓSTICO ---');
console.log(`✅ Aprobados: ${results.passed.length}`);
console.log(`⚠️ Advertencias: ${results.warnings.length}`);
console.log(`❌ Errores: ${results.errors.length}`);
console.log('====================================================\n');
