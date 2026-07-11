/**
 * Terraform ERP — Generador de PINs de Activación Offline
 * Uso: node scripts/generate-activation-pin.js [MACHINE_ID] [FECHA_EXPIRACION: YYYY-MM-DD]
 * Ejemplo: node scripts/generate-activation-pin.js 1a2b3c4d5e6f 2026-07-15
 */

const machineId = process.argv[2];
const expDateStr = process.argv[3];

if (!machineId || !expDateStr) {
    console.log('\x1b[31m%s\x1b[0m', '❌ ERROR: Faltan argumentos.');
    console.log('Uso: node scripts/generate-activation-pin.js [MACHINE_ID] [FECHA_EXPIRACION: YYYY-MM-DD]');
    console.log('Ejemplo: node scripts/generate-activation-pin.js 1a2b3c4d5e6f 2026-07-15\n');
    process.exit(1);
}

// Validar formato de fecha
if (!/^\d{4}-\d{2}-\d{2}$/.test(expDateStr)) {
    console.log('\x1b[31m%s\x1b[0m', '❌ ERROR: Formato de fecha inválido. Debe ser YYYY-MM-DD (Ejemplo: 2026-07-15).\n');
    process.exit(1);
}

function generatePinForHardware(mid, dateStr) {
    const salt = "terraform-secret-salt-2026";
    const input = `${mid}-${dateStr}-${salt}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return String(Math.abs(hash) % 1000000).padStart(6, '0');
}

const pin = generatePinForHardware(machineId, expDateStr);

console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log('\x1b[36m%s\x1b[0m', '   TERRAFORM ERP - GENERACIÓN DE PIN OFFLINE      ');
console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log(`🤖 ID de Máquina:    \x1b[33m${machineId}\x1b[0m`);
console.log(`📅 Expira el:        \x1b[33m${expDateStr}\x1b[0m`);
console.log('--------------------------------------------------');
console.log(`🔑 PIN DE ACTIVACIÓN: \x1b[32m\x1b[1m${pin}\x1b[0m`);
console.log('\x1b[36m%s\x1b[0m', '==================================================\n');
