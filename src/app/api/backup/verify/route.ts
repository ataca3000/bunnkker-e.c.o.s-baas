import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    const auth = requireRole(request, ['superadmin']);
    if (!auth.ok) return auth.response;

    try {
        const config = await prisma.appConfig.findUnique({ where: { id: 'global' } });
        
        const storedHash = config?.lastBackupHash || null;

        let dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
        if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
            const relPath = process.env.DATABASE_URL.replace('file:', '');
            dbPath = path.resolve(process.cwd(), 'prisma', relPath);
        }
        
        if (!fs.existsSync(dbPath)) {
            return NextResponse.json({
                match: false,
                localHash: '',
                storedHash,
                message: 'No se encontró la base de datos local'
            }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(dbPath);
        const localHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        const match = storedHash === localHash;
        
        return NextResponse.json({
            match,
            localHash,
            storedHash,
            message: match ? 'Integridad verificada correctamente' : (storedHash ? 'El hash no coincide con el último respaldo' : 'No hay respaldo previo registrado')
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
