import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function optimizeSQLite() {
    console.log("Optimizando SQLite para alta concurrencia...");
    // Activar Write-Ahead Logging (WAL) para permitir lecturas concurrentes con escrituras
    await prisma.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);
    // Reducir la rigidez de la sincronización de disco (NORMAL es muy seguro con WAL y mucho más rápido)
    await prisma.$executeRawUnsafe(`PRAGMA synchronous = NORMAL;`);
    // Incrementar el tamaño de caché en memoria a ~20MB
    await prisma.$executeRawUnsafe(`PRAGMA cache_size = -20000;`);
    // Poner el timeout a 5000ms para evitar Database Locked
    await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = 5000;`);
    
    console.log("¡SQLite optimizado a velocidad Edge!");
}

// Envolvemos la ejecución en una función autoejecutable para usar async/await de forma más limpia
(async () => {
    try {
        await optimizeSQLite();
        console.log("Optimización completada exitosamente.");
        process.exit(0);
    } catch (e) {
        console.error("Error al optimizar SQLite:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
})();
