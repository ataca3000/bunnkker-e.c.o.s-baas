import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateActiveDbUser, hashPinSha256, getTenantId } from '@/lib/apiAuth';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

// Next.js 15: params es una Promise en route handlers dinámicos
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await validateActiveDbUser(request);
    if (!auth.ok || (auth.role !== 'superadmin' && auth.role !== 'admin')) {
        return NextResponse.json({ success: false, error: 'Unauthorized. Only active superadmin or admin can edit users.' }, { status: 403 });
    }

    const tenantId = auth.tenantId || getTenantId(request);

    try {
        const { id } = await params;
        const body = await request.json();
        const { role, active, pin, name, email } = body;

        // Verificar que el usuario exista y pertenezca al tenant del solicitante
        const targetUser = await prisma.user.findFirst({
            where: { id, tenantId }
        });

        if (!targetUser) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado o no pertenece a esta sucursal.' }, { status: 404 });
        }

        // Restricción jerárquica: un admin ordinario no puede alterar a un superadmin ni auto-ascenderse
        if (auth.role !== 'superadmin') {
            if (targetUser.role === 'superadmin') {
                return NextResponse.json({ success: false, error: 'Acceso denegado: no puedes modificar a un superadministrador.' }, { status: 403 });
            }
            if (role === 'superadmin') {
                return NextResponse.json({ success: false, error: 'Acceso denegado: solo superadmin puede otorgar rol superadmin.' }, { status: 403 });
            }
        }

        const VALID_STAFF_ROLES = [
            'superadmin', 'admin', 'sales', 'caja', 'inventory', 'almacen',
            'marketing', 'driver', 'delivery', 'carga_descarga', 'pickup', 'billing', 'repartidor'
        ];
        if (role !== undefined && !VALID_STAFF_ROLES.includes(role)) {
            return NextResponse.json({ success: false, error: 'Rol de usuario inválido.' }, { status: 400 });
        }

        const updateData: any = {};
        if (role !== undefined) updateData.role = role;
        if (active !== undefined) updateData.active = Boolean(active);
        if (name !== undefined) updateData.name = name.trim();
        if (email !== undefined) updateData.email = email ? email.trim().toLowerCase() : null;

        // Si se actualiza el PIN, validar longitud y hashear con bcrypt + SHA-256
        if (pin !== undefined && pin !== null) {
            if (typeof pin !== 'string' || pin.trim().length < 4) {
                return NextResponse.json({ success: false, error: 'El PIN debe tener al menos 4 caracteres.' }, { status: 400 });
            }
            const cleanPin = pin.trim();
            const pinSha = hashPinSha256(cleanPin);

            // Validar que no choque con otro usuario del mismo tenant
            const duplicatePin = await prisma.user.findFirst({
                where: {
                    tenantId,
                    id: { not: id },
                    pin: { in: [pinSha, cleanPin] }
                }
            });
            if (duplicatePin) {
                return NextResponse.json({ success: false, error: 'El PIN ya está en uso por otro empleado en esta sucursal.' }, { status: 400 });
            }

            updateData.pin = pinSha;
            updateData.pinHash = await bcrypt.hash(cleanPin, SALT_ROUNDS);
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({
            success: true,
            data: { id: updatedUser.id, tenantId: updatedUser.tenantId, name: updatedUser.name, role: updatedUser.role, active: updatedUser.active }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await validateActiveDbUser(request);
    if (!auth.ok || auth.role !== 'superadmin') {
        return NextResponse.json({ success: false, error: 'Unauthorized. Only active superadmin can delete users.' }, { status: 403 });
    }

    const tenantId = auth.tenantId || getTenantId(request);

    try {
        const { id } = await params;

        // Evitar auto-eliminación de la cuenta en sesión actual
        if (id === auth.uid) {
            return NextResponse.json({ success: false, error: 'Operación denegada: no puedes eliminar tu propia cuenta en sesión.' }, { status: 400 });
        }

        // Verificar que el usuario pertenezca a la sucursal del solicitante
        const targetUser = await prisma.user.findFirst({
            where: { id, tenantId }
        });

        if (!targetUser) {
            return NextResponse.json({ success: false, error: 'Usuario no encontrado o no pertenece a esta sucursal.' }, { status: 404 });
        }

        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

