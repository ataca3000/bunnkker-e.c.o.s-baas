import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateActiveDbUser, hashPinSha256, getTenantId } from '@/lib/apiAuth';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function GET(request: NextRequest) {
    const auth = await validateActiveDbUser(request);
    if (!auth.ok) return auth.response;

    const tenantId = auth.tenantId || getTenantId(request);

    try {
        const users = await prisma.user.findMany({
            where: { tenantId },
            select: {
                id: true,
                tenantId: true,
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
    const auth = await validateActiveDbUser(request);
    if (!auth.ok || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Only active superadmin or admin can create users.' }, { status: 403 });
    }

    const tenantId = auth.tenantId || getTenantId(request);

    try {
        const body = await request.json();
        const { name, email, pin, role } = body;

        if (!name || !pin || !role) {
            return NextResponse.json({ success: false, error: 'Name, PIN and role are required.' }, { status: 400 });
        }

        if (typeof pin !== 'string' || pin.trim().length < 4) {
            return NextResponse.json({ success: false, error: 'El PIN debe tener al menos 4 dígitos.' }, { status: 400 });
        }

        const cleanPin = pin.trim();
        const pinSha = hashPinSha256(cleanPin);

        // Verificar PIN duplicado en la sucursal actual usando hash SHA-256
        const existingPin = await prisma.user.findFirst({ 
            where: { 
                tenantId,
                pin: { in: [pinSha, cleanPin] }
            } 
        });
        if (existingPin) {
            return NextResponse.json({ success: false, error: 'PIN ya está en uso por otro empleado en esta sucursal.' }, { status: 400 });
        }

        // Si se provee email, verificar que no esté duplicado en la misma sucursal
        if (email) {
            const cleanEmail = email.trim().toLowerCase();
            const existingEmail = await prisma.user.findFirst({
                where: {
                    tenantId,
                    email: cleanEmail
                }
            });
            if (existingEmail) {
                return NextResponse.json({ success: false, error: 'El correo electrónico ya está registrado en esta sucursal.' }, { status: 400 });
            }
        }

        // Hashear el PIN con bcrypt (cost factor 10)
        const pinHash = await bcrypt.hash(cleanPin, SALT_ROUNDS);

        const newUser = await prisma.user.create({
            data: {
                tenantId,
                name: name.trim(),
                email: email ? email.trim().toLowerCase() : null,
                pin: pinSha,      // retrocompatibilidad SHA-256
                pinHash,          // hash seguro bcrypt
                role,
            }
        });

        return NextResponse.json({
            success: true,
            data: { id: newUser.id, tenantId: newUser.tenantId, name: newUser.name, email: newUser.email, role: newUser.role, active: newUser.active }
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

