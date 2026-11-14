import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

async function optimizeSQLite() {
    const dbUrl = process.env.DATABASE_URL || '';
    const isSqlite = dbUrl.startsWith('file:') || dbUrl.includes('.db') || dbUrl.includes('sqlite');

    if (!isSqlite) {
        console.log('ℹ️ [SQLite] DATABASE_URL no apunta a un archivo SQLite local. Omitiendo PRAGMAs de SQLite.');
        return;
    }

    const prisma = new PrismaClient();
    try {
        console.log('Optimizando SQLite para alta concurrencia y dispositivos móviles...');
        await prisma.$executeRawUnsafe(`PRAGMA journal_mode = WAL;`);
        await prisma.$executeRawUnsafe(`PRAGMA synchronous = NORMAL;`);
        await prisma.$executeRawUnsafe(`PRAGMA cache_size = -20000;`);
        await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = 5000;`);
        await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE);`);
        await prisma.$executeRawUnsafe(`PRAGMA optimize;`);
        console.log('¡SQLite optimizado a velocidad Edge!');
    } finally {
        await prisma.$disconnect();
    }
}

async function purgeTempFiles() {
    const rootDir = process.cwd();
    let purgedCount = 0;
    let freedBytes = 0;

    const pairingDir = path.join(rootDir, 'data', 'pairing');
    if (fs.existsSync(pairingDir)) {
        for (const entry of fs.readdirSync(pairingDir)) {
            if (entry.startsWith('devices_test-')) {
                const file = path.join(pairingDir, entry);
                const size = fs.statSync(file).size;
                fs.unlinkSync(file);
                purgedCount++;
                freedBytes += size;
            }
        }
    }
    return { purgedCount, freedBytes };
}

(async () => {
    try {
        await optimizeSQLite();
        const { purgedCount, freedBytes } = await purgeTempFiles();
        console.log(`Optimización completada: ${purgedCount} archivos temporales purgados (${(freedBytes / 1024).toFixed(2)} KB).`);
        process.exit(0);
    } catch (e) {
        console.error('Error al optimizar SQLite:', e);
        process.exit(1);
    }
})();
