import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { db as firestore, hasRealCredentials } from '@/lib/firebase';
import { collection, query, getDocs, deleteDoc, where } from 'firebase/firestore';
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
        // 1. Borrar de la base de datos local (Prisma) aislando estrictamente por tenantId
        const localDeleted = await prisma.order.deleteMany({
            where: {
                tenantId,
                id: {
                    startsWith: 'TEST-'
                }
            }
        });

        // 2. Borrar de Firebase (Nube) si hay credenciales activas
        let fbDeletedCount = 0;
        if (hasRealCredentials) {
            try {
                const q = query(collection(firestore, 'orders'), where('tenantId', '==', tenantId));
                const querySnapshot = await getDocs(q);
                const batch = [];
                
                for (const docSnapshot of querySnapshot.docs) {
                    if (docSnapshot.id.startsWith('TEST-')) {
                        batch.push(deleteDoc(docSnapshot.ref));
                        fbDeletedCount++;
                    }
                }
                await Promise.all(batch);
            } catch (e) {
                console.warn('[TEST CLEANUP] Error limpiando en Firestore:', e);
            }
        }

        return NextResponse.json({ 
            success: true, 
            count: localDeleted.count,
            firebaseCount: fbDeletedCount,
            message: `Eliminados ${localDeleted.count} pedidos de prueba locales y ${fbDeletedCount} en la nube para el tenant ${tenantId}.`
        });
    } catch (error: any) {
        console.error('[TEST CLEANUP ERROR]:', error?.message);
        return NextResponse.json({ success: false, error: 'Error al limpiar datos de prueba' }, { status: 500 });
    }
}
