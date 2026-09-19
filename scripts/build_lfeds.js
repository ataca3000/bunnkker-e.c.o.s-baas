// Script para generar la Memoria de Mediano Plazo (LFEDS Espejo)
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const lfedsDir = path.join(rootDir, 'lfeds');

// Carpetas a ignorar en el espejo
const ignoreDirs = ['node_modules', '.git', '.next', 'dist', 'dist-build-win', 'build-resources', 'lfeds', 'playwright-report', 'test-results', '.firebase'];

function mirrorDirectory(currentPath, currentLfedsPath) {
    if (!fs.existsSync(currentLfedsPath)) {
        fs.mkdirSync(currentLfedsPath, { recursive: true });
    }

    const items = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const item of items) {
        if (ignoreDirs.includes(item.name)) continue;

        const srcPath = path.join(currentPath, item.name);
        const destPath = path.join(currentLfedsPath, item.name);

        if (item.isDirectory()) {
            mirrorDirectory(srcPath, destPath);
        } else {
            // Solo creamos un archivo índice/espejo vacío (caché estructural)
            // Guardamos solo la firma o un texto básico para no ocupar espacio
            if (!fs.existsSync(destPath)) {
                fs.writeFileSync(destPath, `[ESPEJO LFEDS] Archivo original: ${item.name}\nEstado: Pendiente de revisión profunda.`);
            }
        }
    }
}

console.log("🐝 Generando Memoria de Mediano Plazo (Espejo LFEDS)...");
mirrorDirectory(rootDir, lfedsDir);
console.log("✅ Caché estructural creado con éxito en /lfeds");
