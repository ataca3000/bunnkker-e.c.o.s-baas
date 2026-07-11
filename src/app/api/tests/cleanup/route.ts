import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { db as firestore } from '@/lib/firebase';
import { collection, query, getDocs, deleteDoc } from 'firebase/firestore';
import { requireRole } from '@/lib/apiAuth';


export async function DELETE(request: NextRequest) {
    const auth = requireRole(request, ['superadmin']);
    if (!auth.ok) return auth.response;

    try {
        // 1. Borrar de la base de datos local (Prisma)
        const localDeleted = await prisma.order.deleteMany({
            where: {
                id: {
                    startsWith: 'TEST-'
                }
            }
        });

        // 2. Borrar de Firebase (Nube)
        let fbDeletedCount = 0;
        try {
            const q = query(collection(firestore, 'orders'));
            const querySnapshot = await getDocs(q);
            const batch = [];
            
            for (const doc of querySnapshot.docs) {
                if (doc.id.startsWith('TEST-')) {
                    batch.push(deleteDoc(doc.ref));
                    fbDeletedCount++;
                }
            }
            await Promise.all(batch);
        } catch (e) {
            console.error('Error limpiando Firebase:', e);
        }

        return NextResponse.json({ 
            success: true, 
            count: localDeleted.count,
            firebaseCount: fbDeletedCount,
            message: `Eliminados ${localDeleted.count} pedidos locales y ${fbDeletedCount} en la Nube.`
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
