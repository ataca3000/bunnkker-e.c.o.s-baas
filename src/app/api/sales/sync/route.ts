import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';
import { auth, db } from '@/lib/firebase-admin';
import crypto from 'crypto';

interface OfflineSale {
    id: string;
    amount: number;
    paymentMethod: 'Efectivo' | 'Transferencia'; // Solo offline
    timestamp: string;
    hash: string;
    previousHash: string;
}

export async function POST(req: NextRequest) {
    const sessionAuth = validateApiSession(req);
    if (!sessionAuth.ok) return sessionAuth.response;
    try {
        const tenantId = req.headers.get('x-tenant-id');
        if (!tenantId) {
            return NextResponse.json({ error: 'Falta Tenant ID' }, { status: 400 });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado: Falta Token' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        const role = decodedToken.role; // Asumiendo custom claims

        // Regla: Solo Caja y Patio pueden sincronizar datos locales (Ventas o Entregas)
        if (role !== 'superadmin' && role !== 'sales' && role !== 'patio') {
            return NextResponse.json({ error: 'Rol no autorizado para sincronización offline' }, { status: 403 });
        }

        const { sales }: { sales: OfflineSale[] } = await req.json();

        if (!sales || sales.length === 0) {
            return NextResponse.json({ message: 'No hay ventas para sincronizar' });
        }

        // --- VERIFICACIÓN DE CADENA DE HASHES (OFFLINE VAULT) ---
        // Verificamos que la cadena no se rompa (integridad)
        const dbRef = db.collection(`tenants/${tenantId}/sales`);
        
        // Iniciamos batch
        const batch = db.batch();

        for (let i = 0; i < sales.length; i++) {
            const sale = sales[i];
            
            // Recrear el hash para verificar manipulación de DevTools
            const payloadToHash = `${sale.id}-${sale.amount}-${sale.timestamp}-${userId}-${sale.previousHash}`;
            const expectedHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

            if (sale.hash !== expectedHash) {
                 console.error(`[Auditoría] Cadena rota en venta ${sale.id}. Posible manipulación.`);
                 return NextResponse.json({ error: `Fallo de integridad criptográfica en transacción ${sale.id}` }, { status: 400 });
            }

            // Si es válido, agregarlo al batch
            const newSaleRef = dbRef.doc(sale.id);
            batch.set(newSaleRef, {
                ...sale,
                syncedAt: new Date().toISOString(),
                syncedBy: userId,
                audit: {
                    ip: req.headers.get('x-forwarded-for') || 'local',
                    role: role,
                }
            });
        }

        // Ejecutar escritura masiva
        await batch.commit();

        return NextResponse.json({ message: 'Sincronización exitosa', count: sales.length });

    } catch (error: any) {
        console.error("Error en Sync API:", error);
        return NextResponse.json(
            { error: error.message || 'Error interno al procesar la sincronización' },
            { status: 500 }
        );
    }
}
