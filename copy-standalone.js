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

// CRÍTICO PARA EVITAR PANTALLA BLANCA: Copiar estáticos al servidor standalone
const staticSrc = path.join(__dirname, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
    fs.cpSync(staticSrc, staticDest, { recursive: true });
    console.log("✅ Assets Javascript y CSS (.next/static) copiados al standalone.");
}

const publicSrc = path.join(__dirname, 'public');
const publicDest = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true });
    console.log("✅ Carpeta public copiada al standalone.");
}

console.log("✅ Standalone preparado exitosamente.");
