/**
 * build-guard.js — Perro Guardián del Build (Detector & Chocador de Bugs)
 * Corre justo detrás del build para colisionar con errores, capturar la causa raíz
 * y registrar el reporte de colisión en la memoria precacheada (lfeds/).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.resolve(__dirname, '../lfeds/.agents/BUILD_COLLISION_LOG.json');
const REPORT_FILE = path.resolve(__dirname, '../lfeds/.agents/BUILD_GUARD_REPORT.md');

console.log("🛡️ [BUILD GUARD] Iniciando inspección profunda del build...");

function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) return true;
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

try {
    // 1. Ejecutar chequeo de tipos TypeScript
    console.log("🔎 [BUILD GUARD] Verificando compilación de tipos TypeScript (tsc --noEmit)...");
    execSync('npx tsc --noEmit', { stdio: 'pipe' });

    // 2. Ejecutar Build de producción en modo web / local
    console.log("🔨 [BUILD GUARD] Ejecutando Next.js build con capturador de errores...");
    const buildOutput = execSync('npm run build', { 
        stdio: 'pipe',
        env: { ...process.env, DISABLE_PWA: 'true' }
    }).toString();

    console.log("✅ [BUILD GUARD] Build completado con 0 errores.");

    const successReport = `# 🛡️ Reporte de Guardián del Build (0 Colisiones)

> **Fecha:** ${new Date().toISOString()}
> **Estado:** 🟢 EXITOSO (0 ERRORES / 0 BUGS)

- **Chequeo TypeScript:** PASS
- **Next.js Build:** PASS
- **Resumen:** Ninguna colisión o error rompió la compilación del sistema.
`;

    ensureDirectoryExistence(REPORT_FILE);
    fs.writeFileSync(REPORT_FILE, successReport, 'utf-8');

} catch (error) {
    console.error("💥 [BUILD GUARD] COLISIÓN DETECTADA: El build fue interrumpido por un error.");

    const stdout = error.stdout ? error.stdout.toString() : '';
    const stderr = error.stderr ? error.stderr.toString() : '';
    const fullLog = `${stdout}\n${stderr}`;

    // Extraer líneas de error específicas
    const errorLines = fullLog
        .split('\n')
        .filter(line => line.includes('error TS') || line.includes('Error:') || line.includes('Failed to compile'))
        .slice(0, 20);

    const collisionData = {
        timestamp: new Date().toISOString(),
        status: 'COLLISION_DETECTED',
        exitCode: error.status,
        detectedErrors: errorLines,
        rawLog: fullLog.substring(0, 4000)
    };

    ensureDirectoryExistence(LOG_FILE);
    fs.writeFileSync(LOG_FILE, JSON.stringify(collisionData, null, 2), 'utf-8');

    const markdownReport = `# 💥 Reporte de Colisión de Bugs (Build Guard)

> **Fecha:** ${new Date().toISOString()}
> **Estado:** 🔴 FALLA EN BUILD (Colisión Detectada)

## 📌 Errores Capturados
\`\`\`
${errorLines.join('\n') || 'Falla durante la fase de empaquetado o tipos.'}
\`\`\`

## 🛠️ Diagnóstico Guardado en Caché
Se ha grabado el archivo de colisión en \`lfeds/.agents/BUILD_COLLISION_LOG.json\` para que el agente aplique la autoreparación inmediata.
`;

    fs.writeFileSync(REPORT_FILE, markdownReport, 'utf-8');
    process.exit(1);
}
