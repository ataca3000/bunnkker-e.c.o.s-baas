import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getTenantId } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { db as firestoreAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateExpectedAmount, calculateDiscrepancy, ALLOWED_CLOSE_STATUSES, EXCLUDED_CLOSE_STATUSES, CASH_PAYMENT_METHODS, roundMoney } from '@/lib/financial';

export async function POST(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin', 'sales']);
    if (!auth.ok) return auth.response;
    try {
        const tenantId = getTenantId(request);
        const body = await request.json();
        const { declaredAmount } = body;
        if (declaredAmount === undefined) {
            return NextResponse.json({ error: 'Faltan datos requeridos: declaredAmount' }, { status: 400 });
        }

        // ANTI-SUPLANTACIÓN: El cajero que cierra se extrae de la sesión autenticada y verificada
        // Solo un administrador o superadministrador puede especificar un cashierId alterno de un empleado a su cargo
        const effectiveCashierId = (['superadmin', 'admin'].includes(auth.role) && body.cashierId) ? body.cashierId : auth.uid;
        const effectiveCashierName = body.cashierName || (auth as any).name || 'Cajero';

        const cleanDeclared = roundMoney(Number(declaredAmount));

        // 1. Obtener el último cierre de caja de este tenant
        const lastLog = await prisma.cashRegisterLog.findFirst({
            where: { tenantId },
            orderBy: { createdAt: 'desc' }
        });

        // 2. Sumar todas las ventas en efectivo completadas/enviadas desde el último corte
        // excluyendo órdenes canceladas o reembolsadas aunque hayan tenido confirmedAt previo.
        const cutoffDate = lastLog ? new Date(lastLog.createdAt) : (() => {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            return startOfDay;
        })();

        const candidateOrders = await prisma.order.findMany({
            where: {
                tenantId,
                paymentMethod: { in: CASH_PAYMENT_METHODS },
                status: { notIn: EXCLUDED_CLOSE_STATUSES },
                date: { gte: cutoffDate },
                OR: [
                    { status: { in: ALLOWED_CLOSE_STATUSES } },
                    { confirmedAt: { not: null } }
                ]
            }
        });

        const ordersToCount = candidateOrders.filter((ord) => {
            const effectivePaidAt = ord.confirmedAt ? new Date(ord.confirmedAt) : new Date(ord.date);
            return lastLog ? effectivePaidAt > cutoffDate : effectivePaidAt >= cutoffDate;
        });

        const expectedAmount = calculateExpectedAmount(ordersToCount);
        const discrepancy = calculateDiscrepancy(cleanDeclared, expectedAmount);

        // 3. Registrar de forma inmutable en Prisma
        const log = await prisma.cashRegisterLog.create({
            data: {
                tenantId,
                cashierId: effectiveCashierId,
                cashierName: cashierName || 'Cajero',
                declaredAmount: cleanDeclared,
                expectedAmount,
                discrepancy,
                synced: false
            }
        });

        // 4. Si hay descuadre negativo (faltante), registrar en auditoría Prisma y emitir alerta
        if (discrepancy < 0) {
            await prisma.auditLog.create({
                data: {
                    tenantId,
                    action: 'CASH_MISMATCH_DETECTED',
                    details: JSON.stringify({
                        cashierId: effectiveCashierId,
                        cashierName: cashierName || 'Cajero',
                        expectedAmount,
                        declaredAmount: cleanDeclared,
                        discrepancy
                    }),
                    userId: cashierId: effectiveCashierId,
                    synced: true
                }
            }).catch(() => {});

            try {
                await firestoreAdmin.collection('alerts').add({
                    type: 'CASH_MISMATCH',
                    tenantId,
                    cashierId: effectiveCashierId,
                    cashierName: cashierName || 'Cajero',
                    expectedAmount,
                    declaredAmount,
                    discrepancy,
                    timestamp: FieldValue.serverTimestamp(),
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
