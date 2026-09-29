const fs = require('fs');
const path = require('path');

console.log("==> Copiando archivos para Standalone Build <==");

const projectRoot = path.resolve(__dirname, '..');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');

if (!fs.existsSync(standaloneDir)) {
    console.error("ERROR: No se encontró la carpeta .next/standalone. Asegúrate de compilar con Next.js primero.");
    process.exit(1);
}

// Si Next.js anidó server.js dentro de una subcarpeta, elevarlo a la raíz de standalone
const nestedServer = path.join(standaloneDir, 'bunnkker-e.c.o.s-baas');
if (fs.existsSync(nestedServer) && fs.existsSync(path.join(nestedServer, 'server.js')) && !fs.existsSync(path.join(standaloneDir, 'server.js'))) {
    fs.cpSync(nestedServer, standaloneDir, { recursive: true, force: true });
    console.log("✅ Se elevaron los archivos del servidor anidado a la raíz de standalone.");
}

// Copiar Prisma (Schema y BD Local)
const prismaSrc = path.join(projectRoot, 'prisma');
const prismaDest = path.join(standaloneDir, 'prisma');
if (fs.existsSync(prismaSrc)) {
    fs.cpSync(prismaSrc, prismaDest, { recursive: true });
    console.log("✅ Prisma (SQLite) copiado al standalone.");
}

// Copiar motor de consulta de Linux para Prisma Standalone
const linuxEngineSrc = path.join(projectRoot, 'node_modules', '.prisma', 'client', 'libquery_engine-linux-musl-openssl-3.0.x.so.node');
const linuxEngineDest = path.join(standaloneDir, 'node_modules', '.prisma', 'client', 'libquery_engine-linux-musl-openssl-3.0.x.so.node');
if (fs.existsSync(linuxEngineSrc)) {
    fs.mkdirSync(path.dirname(linuxEngineDest), { recursive: true });
    fs.copyFileSync(linuxEngineSrc, linuxEngineDest);
    console.log("✅ Motor de Prisma para Linux copiado al standalone.");
}

// Copiar .env.local
const envSrc = path.join(projectRoot, '.env.local');
const envDest = path.join(standaloneDir, '.env.local');
if (fs.existsSync(envSrc)) {
    fs.copyFileSync(envSrc, envDest);
    console.log("✅ .env.local copiado al standalone.");
}

// CRÍTICO PARA EVITAR PANTALLA BLANCA: Copiar estáticos al servidor standalone
const staticSrc = path.join(projectRoot, '.next', 'static');
const staticDest = path.join(standaloneDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
    fs.cpSync(staticSrc, staticDest, { recursive: true });
    console.log("✅ Assets Javascript y CSS (.next/static) copiados al standalone.");
}

const publicSrc = path.join(projectRoot, 'public');
const publicDest = path.join(standaloneDir, 'public');
if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true });
    console.log("✅ Carpeta public copiada al standalone.");
}

// CRÍTICO: Copiar módulo 'next' porque electron-builder a veces lo ignora o Next.js no lo traza bien en Windows
const nextModuleSrc = path.join(projectRoot, 'node_modules', 'next');
const nextModuleDest = path.join(standaloneDir, 'node_modules', 'next');
if (fs.existsSync(nextModuleSrc)) {
    fs.cpSync(nextModuleSrc, nextModuleDest, { recursive: true, force: true });
    console.log("✅ Módulo 'next' forzado en standalone/node_modules.");
}

// CRÍTICO: Renombrar node_modules a node_modules_backup para engañar a electron-builder
const nmPath = path.join(standaloneDir, 'node_modules');
const nmBackupPath = path.join(standaloneDir, 'node_modules_backup');
if (fs.existsSync(nmPath)) {
    // Si ya existe un backup de una corrida anterior, borrarlo
    if (fs.existsSync(nmBackupPath)) {
        fs.rmSync(nmBackupPath, { recursive: true, force: true });
    }
    fs.renameSync(nmPath, nmBackupPath);
    console.log("✅ node_modules ocultado como node_modules_backup para el empaquetador.");
}

console.log("✅ Standalone preparado exitosamente.");
