import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const actionFilter = url.searchParams.get('action');

    try {
        const whereClause: any = {};
        if (actionFilter) {
            whereClause.action = actionFilter;
        }

        const logs = await prisma.auditLog.findMany({
            where: whereClause,
            orderBy: { timestamp: 'desc' },
            take: 100 // limit to last 100 logs to prevent massive payloads
        });
        
        return NextResponse.json({ success: true, data: logs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = validateApiSession(request);
    // Audit logs can be created by any authenticated user

    try {
        const body = await request.json();
        const { action, details, userId } = body;

        if (!action) {
            return NextResponse.json({ success: false, error: 'Action is required.' }, { status: 400 });
        }

        const newLog = await prisma.auditLog.create({
            data: {
                action,
                details: details || '',
                userId: userId || auth.uid || 'unknown',
            }
        });

        return NextResponse.json({ success: true, data: newLog });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
