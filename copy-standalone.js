const fs = require('fs');
const path = require('path');

console.log("==> Copiando archivos para Standalone Build <==");

const standaloneDir = path.join(__dirname, '.next', 'standalone');

if (!fs.existsSync(standaloneDir)) {
    console.error("ERROR: No se encontró la carpeta .next/standalone. Asegúrate de compilar con Next.js primero.");
    process.exit(1);
}

// Copiar Prisma (Schema y BD Local)
const prismaSrc = path.join(__dirname, 'prisma');
const prismaDest = path.join(standaloneDir, 'prisma');
if (fs.existsSync(prismaSrc)) {
    fs.cpSync(prismaSrc, prismaDest, { recursive: true });
    console.log("✅ Prisma (SQLite) copiado al standalone.");
}

// Copiar .env.local
const envSrc = path.join(__dirname, '.env.local');
const envDest = path.join(standaloneDir, '.env.local');
if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, envDest);
    console.log("✅ .env.local copiado al standalone.");
}

console.log("✅ Standalone preparado exitosamente.");
