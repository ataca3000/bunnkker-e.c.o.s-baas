import { NextResponse } from 'next/server';
import { prisma } from '@bunkker/core';
import { db as firestore } from '@bunkker/core';
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

export async function DELETE(request: Request) {
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
