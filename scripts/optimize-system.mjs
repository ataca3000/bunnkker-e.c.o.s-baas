#!/usr/bin/env node
/**
 * BUNKKER E.C.O.S. — Script de Optimización y Liberación de Cachés (Móvil / Servidor)
 * 1. Purga archivos temporales de logs (.log/.tmp) y residuos de pruebas (devices_test-*).
 * 2. Limpia archivos incrementales de caché obsoletos (.tsbuildinfo fuera de compilación activa).
 * 3. Optimiza SQLite / compacto de store local si existe.
 * 4. Invoca al endpoint /api/system/optimize del servidor activo para liberar cachés en RAM.
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

function removeFileIfSafe(filePath, stats) {
    try {
        if (!fs.existsSync(filePath)) return;
        const st = fs.statSync(filePath);
        if (!st.isFile()) return;
        fs.unlinkSync(filePath);
        stats.removedFiles.push(path.relative(ROOT, filePath));
        stats.freedBytes += st.size;
    } catch {}
}

function purgeTemporaryArtifacts() {
    const stats = {
        removedFiles: [],
        truncatedLogs: [],
        freedBytes: 0,
    };

    // 1. Limpiar archivos de prueba en data/pairing (respetando devices_default.json y tenants reales)
    const pairingDir = path.join(ROOT, 'data', 'pairing');
    if (fs.existsSync(pairingDir)) {
        for (const entry of fs.readdirSync(pairingDir)) {
            if (entry.startsWith('devices_test-') && (entry.endsWith('.json') || entry.endsWith('.json.bak'))) {
                removeFileIfSafe(path.join(pairingDir, entry), stats);
            }
        }
    }

    // 2. Limpiar logs temporales o compactar security_audit.log si rebasa 256 KB
    const logsDir = path.join(ROOT, 'logs');
    if (fs.existsSync(logsDir)) {
        for (const entry of fs.readdirSync(logsDir)) {
            const fullPath = path.join(logsDir, entry);
            const st = fs.statSync(fullPath);
            if (!st.isFile()) continue;

            if (entry.endsWith('.tmp') || entry.startsWith('temp') || entry.startsWith('debug') || entry.endsWith('.old.log')) {
                removeFileIfSafe(fullPath, stats);
            } else if (entry.endsWith('.log')) {
                if (st.size === 0 || entry !== 'security_audit.log') {
                    removeFileIfSafe(fullPath, stats);
                } else if (st.size > 256 * 1024) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const lines = content.trim().split('\n').slice(-200).join('\n') + '\n';
                    fs.writeFileSync(fullPath, lines, 'utf8');
                    const reclaimed = Math.max(0, st.size - Buffer.byteLength(lines, 'utf8'));
                    stats.freedBytes += reclaimed;
                    stats.truncatedLogs.push(`${path.relative(ROOT, fullPath)} (-${(reclaimed / 1024).toFixed(2)} KB)`);
                }
            }
        }
    }

    // 3. Limpiar archivos .log sueltos en raíz o tsconfig.tsbuildinfo obsoleto
    for (const rootEntry of fs.readdirSync(ROOT)) {
        if (rootEntry.endsWith('.log') || rootEntry === 'tsconfig.tsbuildinfo') {
            removeFileIfSafe(path.join(ROOT, rootEntry), stats);
        }
    }

    // 4. Compactar .prisma_memory_store.json eliminando entradas temporales de prueba si existen
    const memStorePath = path.join(ROOT, '.prisma_memory_store.json');
    if (fs.existsSync(memStorePath)) {
        try {
            const raw = fs.readFileSync(memStorePath, 'utf8');
            const parsed = JSON.parse(raw);
            let changed = false;
            if (Array.isArray(parsed.order)) {
                const before = parsed.order.length;
                parsed.order = parsed.order.filter((o) => {
                    const id = String(o.id || '');
                    return !id.startsWith('TEST-') && !id.startsWith('TCK-TEST-') && !id.startsWith('ORD-TEST-');
                });
                if (parsed.order.length !== before) changed = true;
            }
            if (Array.isArray(parsed.auditLog) && parsed.auditLog.length > 500) {
                parsed.auditLog = parsed.auditLog.slice(-500);
                changed = true;
            }
            if (changed) {
                const nextRaw = JSON.stringify(parsed, null, 2);
                fs.writeFileSync(memStorePath, nextRaw, 'utf8');
                stats.freedBytes += Math.max(0, Buffer.byteLength(raw, 'utf8') - Buffer.byteLength(nextRaw, 'utf8'));
            }
        } catch {}
    }

    return stats;
}

async function releaseServerMemoryCaches() {
    const port = process.env.PORT || 3000;
    const url = `http://127.0.0.1:${port}/api/system/optimize`;
    const secret = process.env.INTERNAL_API_SECRET || 'bunkker-local-maintenance';
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-bunkker-optimize': secret,
            },
            signal: AbortSignal.timeout(4000),
        });
        if (!res.ok) return { reachable: true, ok: false, status: res.status };
        const json = await res.json();
        return { reachable: true, ok: true, ...json };
    } catch {
        return { reachable: false, ok: false };
    }
}

(async () => {
    console.log('⚡ [BUNKKER Optimize] Iniciando purga de logs temporales y liberación de memoria caché...');
    const diskStats = purgeTemporaryArtifacts();

    let gcTriggered = false;
    if (typeof global.gc === 'function') {
        global.gc();
        gcTriggered = true;
    }

    const serverStats = await releaseServerMemoryCaches();

    console.log(`🗑️  Archivos temporales eliminados: ${diskStats.removedFiles.length}`);
    console.log(`💾 Espacio en disco recuperado: ${(diskStats.freedBytes / 1024).toFixed(2)} KB (${diskStats.freedBytes} bytes)`);
    if (diskStats.truncatedLogs.length > 0) {
        console.log(`✂️  Logs compactados: ${diskStats.truncatedLogs.join(', ')}`);
    }
    if (serverStats.reachable && serverStats.ok) {
        console.log(`🧠 Caché RAM servidor liberado: Before ${serverStats.memory?.heapBeforeMb ?? '?'} MB -> After ${serverStats.memory?.heapAfterMb ?? '?'} MB`);
        console.log(`🧹 Entradas purgadas en memoria:`, JSON.stringify(serverStats.cachesPurged));
    } else {
        console.log(`🧠 Memoria proceso CLI: ${(process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2)} MB (GC explícito: ${gcTriggered ? 'sí' : 'auto'})`);
    }
    console.log('✅ [BUNKKER Optimize] Optimización para rendimiento móvil completada.');
})();
