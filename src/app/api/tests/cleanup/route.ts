import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireActiveRole, getTenantId } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
    // Blindaje de seguridad: deshabilitar purga de tests en producción
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({
            success: false,
            error: 'Endpoint de pruebas deshabilitado en entorno de producción.'
        }, { status: 403 });
    }

    const auth = await requireActiveRole(request, ['superadmin']);
    if (!auth.ok) return auth.response;

    const tenantId = getTenantId(request);

    try {
        // Borrar de la base de datos local (Prisma) aislando estrictamente por tenantId
        const localDeleted = await prisma.order.deleteMany({
            where: {
                tenantId,
                id: {
                    startsWith: 'TEST-'
                }
            }
        });

        return NextResponse.json({ 
            success: true, 
            count: localDeleted.count,
            firebaseCount: 0,
            message: `Eliminados ${localDeleted.count} pedidos de prueba locales para el tenant ${tenantId}.`
        });
    } catch (error: any) {
        console.error('[TEST CLEANUP ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al limpiar datos de prueba' }, { status: 500 });
    }
}
