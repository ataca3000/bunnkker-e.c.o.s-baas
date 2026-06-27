import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { db as firestore } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { calculateExpectedAmount, calculateDiscrepancy, ALLOWED_CLOSE_STATUSES } from '@/lib/financial';

export async function POST(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;
    try {
        const tenantId = request.headers.get('x-tenant-id') || 'default-local';
        const body = await request.json();
        const { declaredAmount, cashierId, cashierName } = body;

        if (declaredAmount === undefined || !cashierId) {
            return NextResponse.json({ error: 'Faltan datos requeridos (declaredAmount, cashierId)' }, { status: 400 });
        }

        // 1. Obtener el último cierre de caja de este tenant
        const lastLog = await prisma.cashRegisterLog.findFirst({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Sumar todas las ventas en efectivo (cash) completadas/enviadas desde ese momento
        const whereClause: any = {
            tenantId,
            paymentMethod: 'cash',
            status: { in: ALLOWED_CLOSE_STATUSES }
        };

        if (lastLog) {
            whereClause.date = { gt: lastLog.createdAt };
        } else {
            // Si no hay corte previo, calculamos del día de hoy
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            whereClause.date = { gte: startOfDay };
        }

        const ordersToCount = await prisma.order.findMany({
            where: whereClause
        });

        const expectedAmount = calculateExpectedAmount(ordersToCount);
        const discrepancy = calculateDiscrepancy(declaredAmount, expectedAmount);

        // 3. Registrar de forma inmutable en Prisma
        const log = await prisma.cashRegisterLog.create({
            data: {
                tenantId,
                cashierId,
                cashierName: cashierName || 'Cajero',
                declaredAmount,
                expectedAmount,
                discrepancy,
                synced: false
            }
        });

        // 4. Si hay descuadre negativo (faltante), mandamos alerta push silenciosa a Firebase
        if (discrepancy < 0) {
            try {
                await addDoc(collection(firestore, 'alerts'), {
                    type: 'CASH_MISMATCH',
                    tenantId,
                    cashierId,
                    cashierName: cashierName || 'Cajero',
                    expectedAmount,
                    declaredAmount,
                    discrepancy,
                    timestamp: serverTimestamp(),
                    read: false
                });
            } catch (err) {
                console.error('[Alerta Firebase] No se pudo enviar alerta de caja', err);
            }
        }

        return NextResponse.json({ 
            success: true, 
            data: log,
            message: discrepancy < 0 ? 'Faltante detectado y registrado.' : 'Corte exitoso.'
        });

    } catch (error: any) {
        console.error(`[Close Register Error]: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
