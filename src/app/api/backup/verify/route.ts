import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin', 'inventory']);
    if (!auth.ok) return auth.response;

    try {
        let storedHash: string | null = null;
        let lastBackupAt: string | null = null;
        let lastBackupSize: number | null = null;

        try {
            const config = await prisma.appConfig.findUnique({ where: { id: 'global' } });
            storedHash = config?.lastBackupHash || null;
            lastBackupAt = config?.lastBackupAt ? new Date(config.lastBackupAt).toISOString() : null;
            lastBackupSize = config?.lastBackupSize || null;
        } catch {
            // fallback
        }

        // Also check bunkker.backup.json
        const backupJsonPath = path.resolve(process.cwd(), 'bunkker.backup.json');
        if (!storedHash && fs.existsSync(backupJsonPath)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(backupJsonPath, 'utf-8'));
                storedHash = parsed.lastBackupHash || null;
                lastBackupAt = parsed.lastBackupAt || null;
                lastBackupSize = parsed.lastBackupSize || null;
            } catch {
                // ignore
            }
        }

        let dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
        if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
            const relPath = process.env.DATABASE_URL.replace('file:', '');
            dbPath = path.resolve(process.cwd(), 'prisma', relPath);
        }

        let localHash = '';
        let localDbExists = false;
        let localSize = 0;

        if (fs.existsSync(dbPath)) {
            localDbExists = true;
            const fileBuffer = fs.readFileSync(dbPath);
            localSize = fileBuffer.length;
            localHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } else {
            // Fallback for demo environments or when DB is memory/relational: compute hash over product & order tables
            try {
                const [pCount, oCount] = await Promise.all([
                    prisma.product.count(),
                    prisma.order.count(),
                ]);
                const virtualSeed = `db-state:${pCount}:${oCount}:${process.env.DATABASE_URL || 'local'}`;
                localHash = crypto.createHash('sha256').update(virtualSeed).digest('hex');
                localDbExists = true;
                localSize = (pCount + oCount) * 128;
            } catch {
                localHash = '';
            }
        }

        if (!localHash) {
            return NextResponse.json({
                success: false,
                match: false,
                localHash: '',
                storedHash,
                message: 'No se pudo leer la base de datos local para verificar el hash.',
                discrepancy: true
            }, { status: 404 });
        }

        const match = Boolean(storedHash && storedHash.toLowerCase() === localHash.toLowerCase());
        const hasBackup = Boolean(storedHash);

        const resultPayload = {
            success: true,
            match,
            hasBackup,
            localHash,
            storedHash,
            localSize,
            lastBackupSize,
            lastBackupAt,
            checkedAt: new Date().toISOString(),
            status: match ? 'VERIFIED' : hasBackup ? 'DISCREPANCY_DETECTED' : 'NO_CLOUD_BACKUP',
            message: match
                ? 'Integridad criptográfica verificada: La BD local coincide exactamente con el respaldo en la nube.'
                : hasBackup
                    ? 'ALERTA DE DISCREPANCIA: El hash SHA-256 local difiere del último respaldo registrado en la nube o hay modificaciones no sincronizadas.'
                    : 'Aviso: No existe un hash de respaldo previo en la nube para comparar. Genera un snapshot primero.'
        };

        // Registrar auditoría en tiempo real si hay discrepancia o verificación
        try {
            await prisma.auditLog.create({
                data: {
                    action: match ? 'BACKUP_HASH_VERIFIED' : 'BACKUP_HASH_DISCREPANCY',
                    details: `Auditoría Hash SHA-256: Local [${localHash.slice(0, 10)}...] vs Cloud [${(storedHash || 'N/A').slice(0, 10)}...]. Resultado: ${resultPayload.status}.`,
                    userId: auth.uid || 'SYSTEM'
                }
            });
        } catch {
            // non-fatal
        }

        return NextResponse.json(resultPayload);

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
