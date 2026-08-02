import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin']);
    if (!auth.ok) return auth.response;

    try {
        const config = await prisma.appConfig.findUnique({ where: { id: 'global' } });
        
        if (!config) {
            return NextResponse.json({
                lastBackupAt: null,
                lastBackupSize: null,
                lastBackupHash: null,
                status: 'never',
                nextBackupIn: 120
            });
        }

        const { lastBackupAt, lastBackupSize, lastBackupHash } = config;

        let status = 'never';
        let nextBackupIn = 120; // Default 2 hours

        if (lastBackupAt) {
            const now = new Date();
            const lastBackupTime = new Date(lastBackupAt);
            const diffMs = now.getTime() - lastBackupTime.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours > 3) {
                status = 'stale';
            } else {
                status = 'ok';
            }

            const nextBackupTimeMs = lastBackupTime.getTime() + (2 * 60 * 60 * 1000);
            const nextInMs = nextBackupTimeMs - now.getTime();
            nextBackupIn = Math.max(0, Math.floor(nextInMs / (1000 * 60)));
        }

        return NextResponse.json({
            lastBackupAt,
            lastBackupSize,
            lastBackupHash,
            status,
            nextBackupIn
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
