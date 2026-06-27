import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiSession } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                active: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' }
        });
        return NextResponse.json({ success: true, data: users });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok || auth.role !== 'superadmin') {
        return NextResponse.json({ success: false, error: 'Unauthorized. Only superadmin can create users.' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, email, pin, role } = body;

        if (!name || !pin || !role) {
            return NextResponse.json({ success: false, error: 'Name, PIN and role are required.' }, { status: 400 });
        }

        // Check if PIN already exists
        const existingPin = await prisma.user.findUnique({ where: { pin } });
        if (existingPin) {
            return NextResponse.json({ success: false, error: 'PIN ya está en uso por otro empleado.' }, { status: 400 });
        }

        const newUser = await prisma.user.create({
            data: {
                name,
                email: email || null,
                pin,
                role,
            }
        });

        // We don't return the PIN back to the client for security
        return NextResponse.json({ 
            success: true, 
            data: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, active: newUser.active } 
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
