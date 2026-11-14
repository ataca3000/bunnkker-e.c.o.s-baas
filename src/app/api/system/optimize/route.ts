import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { validateApiSession } from '@/lib/apiAuth';
import { purgeExpiredLeases } from '@/lib/chunkLeases';
import { pruneRealtimeBus } from '@/lib/realtimeBus';
import { purgeExpiredRedisMemory } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isLoopbackMaintenanceRequest(request: NextRequest): boolean {
    const token = request.headers.get('x-bunkker-optimize');
    const expected = process.env.INTERNAL_API_SECRET || 'bunkker-local-maintenance';
    if (!token || token !== expected) return false;
    const host = (request.headers.get('host') || '').toLowerCase();
    return host.startsWith('127.0.0.1') || host.startsWith('localhost');
}

export async function POST(request: NextRequest) {
    const isLocalCli = isLoopbackMaintenanceRequest(request);
    if (!isLocalCli) {
        const auth = validateApiSession(request);
        if (!auth.ok) return auth.response;
    }

    const heapBeforeMb = Number((process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2));
    const rootDir = process.cwd();

    let removedTempFiles = 0;
    let freedBytes = 0;

    // 1. Purgar archivos temporales de pairing generados por pruebas (`devices_test-*.json*`)
    const pairingDir = path.join(rootDir, 'data', 'pairing');
    if (fs.existsSync(pairingDir)) {
        for (const entry of fs.readdirSync(pairingDir)) {
            if (entry.startsWith('devices_test-') && (entry.endsWith('.json') || entry.endsWith('.json.bak'))) {
                const targetPath = path.join(pairingDir, entry);
                try {
                    const stat = fs.statSync(targetPath);
                    fs.unlinkSync(targetPath);
                    removedTempFiles++;
                    freedBytes += stat.size;
                } catch {}
            }
        }
    }

    // 2. Purgar logs temporales o recortar logs antiguos que excedan 512 KB
    const logsDir = path.join(rootDir, 'logs');
    if (fs.existsSync(logsDir)) {
        for (const entry of fs.readdirSync(logsDir)) {
            if (!entry.endsWith('.log') && !entry.endsWith('.tmp')) continue;
            const targetPath = path.join(logsDir, entry);
            try {
                const stat = fs.statSync(targetPath);
                if (entry.endsWith('.tmp') || entry.startsWith('temp') || entry.startsWith('debug')) {
                    fs.unlinkSync(targetPath);
                    removedTempFiles++;
                    freedBytes += stat.size;
                } else if (stat.size > 512 * 1024) {
                    const content = fs.readFileSync(targetPath, 'utf8');
                    const tail = content.split('\n').slice(-200).join('\n');
                    fs.writeFileSync(targetPath, tail, 'utf8');
                    freedBytes += Math.max(0, stat.size - Buffer.byteLength(tail, 'utf8'));
                    removedTempFiles++;
                }
            } catch {}
        }
    }

    // 3. Liberar cachés en memoria RAM no utilizados
    const busStats = pruneRealtimeBus(15 * 60 * 1000);
    const redisStats = purgeExpiredRedisMemory(false);
    const leaseStats = purgeExpiredLeases(Date.now());

    // 4. Optimización SQLite si la conexión es archivo local
    let sqliteOptimized = false;
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.startsWith('file:') || dbUrl.includes('.db') || dbUrl.includes('sqlite')) {
        try {
            await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);');
            await prisma.$executeRawUnsafe('PRAGMA optimize;');
            sqliteOptimized = true;
        } catch {}
    }

    // 5. Hint de recolección de basura si Node fue iniciado con --expose-gc
    try {
        const gc = (globalThis as { gc?: () => void }).gc;
        if (typeof gc === 'function') gc();
    } catch {}

    const heapAfterMb = Number((process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2));

    return NextResponse.json({
        success: true,
        removedTempFiles,
        freedBytes,
        freedKb: Number((freedBytes / 1024).toFixed(2)),
        sqliteOptimized,
        cachesPurged: {
            realtimeListeners: busStats.prunedListeners,
            realtimeEvents: busStats.prunedEvents,
            realtimeTxIds: busStats.prunedTxIds,
            redisKeys: redisStats.purgedKeys,
            expiredLeases: leaseStats.purgedLeases,
        },
        memory: {
            heapBeforeMb,
            heapAfterMb,
            reclaimedMb: Number(Math.max(0, heapBeforeMb - heapAfterMb).toFixed(2)),
        },
    });
}
