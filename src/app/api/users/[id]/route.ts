import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession } from '@/lib/apiAuth';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const auth = validateApiSession(request);
    if (!auth.ok || auth.role !== 'superadmin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { role, active } = body;

        const updatedUser = await prisma.user.update({
            where: { id: params.id },
            data: {
                ...(role !== undefined && { role }),
                ...(active !== undefined && { active })
            }
        });

        return NextResponse.json({ 
            success: true, 
            data: { id: updatedUser.id, role: updatedUser.role, active: updatedUser.active } 
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const auth = validateApiSession(request);
    if (!auth.ok || auth.role !== 'superadmin') {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        await prisma.user.delete({
            where: { id: params.id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
