import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { prisma } from '@/lib/prisma';
import { loadPersistentSiteConfig } from '@/lib/persistentSettings';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function POST(req: NextRequest) {
    try {
        const url = new URL(req.url);
        let type = url.searchParams.get('type') || url.searchParams.get('topic');
        let dataId = url.searchParams.get('data.id') || url.searchParams.get('id');

        if (!type || !dataId) {
            try {
                const body = await req.json();
                if (body) {
                    type = type || body.type || (body.action ? body.action.split('.')[0] : null);
                    dataId = dataId || (body.data?.id ? String(body.data.id) : (body.id ? String(body.id) : null));
                }
            } catch {}
        }

        if (type === 'payment' && dataId) {
            const localConfig = loadPersistentSiteConfig('default');
            let accessToken = process.env.MP_ACCESS_TOKEN || localConfig?.mp_access_token;

            if (!accessToken) {
                try {
                    const settingsSnap = await adminDb.doc('settings/site_config').get();
                    if (settingsSnap.exists) {
                        const configData = settingsSnap.data() as any;
                        accessToken = configData?.mp_access_token;
                    }
                } catch {}
            }

            if (accessToken) {
                const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
                const payment = new Payment(client);

                const paymentInfo = await payment.get({ id: dataId });

                if (paymentInfo.status === 'approved') {
                    const orderId = paymentInfo.external_reference;
                    const paidAmount = Number(paymentInfo.transaction_amount || 0);

                    if (orderId) {
                        const paidAtDate = new Date();

                        try {
                            const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
                            if (existingOrder) {
                                // 1. Idempotencia y máquina de estados: solo aprobar órdenes que están pendientes de pago
                                const allowedFromStatuses = ['pending_payment', 'pending_confirmation', 'pending'];
                                if (!allowedFromStatuses.includes(existingOrder.status)) {
                                    return NextResponse.json({ received: true, skipped: 'Order already processed' });
                                }

                                // 2. Validación estricta de monto: rechazar pagos parciales o manipulados ($1 por $10,000)
                                if (paidAmount + 0.05 < Number(existingOrder.total)) {
                                    console.error(`[MP Webhook FRAUD ALERT] Orden ${orderId} requiere $${existingOrder.total} pero se pagó $${paidAmount}`);
                                    await prisma.orderEvent.create({
                                        data: {
                                            tenantId: existingOrder.tenantId || 'default',
                                            orderId,
                                            eventType: 'PAYMENT_AMOUNT_MISMATCH',
                                            fromStatus: existingOrder.status,
                                            toStatus: existingOrder.status,
                                            actorId: 'mercadopago_webhook',
                                            actorName: 'MercadoPago Anti-Fraud',
                                            actorRole: 'system',
                                            details: JSON.stringify({ paymentId: dataId, paidAmount, expectedTotal: existingOrder.total })
                                        }
                                    }).catch(() => {});
                                    return NextResponse.json({ error: 'Monto pagado insuficiente' }, { status: 400 });
                                }

                                const nextStatus = existingOrder.deliveryType === 'DELIVERY' ? 'READY_TO_SHIP' : 'paid';
                                await prisma.order.update({
                                    where: { id: orderId },
                                    data: {
                                        status: nextStatus,
                                        paymentMethod: 'MercadoPago',
                                        confirmedAt: paidAtDate,
                                    }
                                });
                                await prisma.orderEvent.create({
                                    data: {
                                        tenantId: existingOrder.tenantId || 'default',
                                        orderId,
                                        eventType: 'PAYMENT_APPROVED_MP',
                                        fromStatus: existingOrder.status,
                                        toStatus: nextStatus,
                                        actorId: 'mercadopago_webhook',
                                        actorName: 'MercadoPago Webhook',
                                        actorRole: 'system',
                                        details: JSON.stringify({ paymentId: dataId, paidAmount, paidAt: paidAtDate.toISOString() })
                                    }
                                }).catch(() => {});
                            }
                        } catch (prismaErr) {
                            console.warn(`[MP Webhook] Error actualizando orden ${orderId} en Prisma:`, prismaErr);
                        }

                        try {
                            await adminDb.doc(`orders/${orderId}`).update({
                                status: 'paid',
                                paymentDetails: {
                                    provider: 'mercadopago',
                                    id: dataId,
                                    paidAmount,
                                    paidAt: paidAtDate.toISOString()
                                }
                            });
                        } catch {}

                        console.log(`[MP Webhook] Orden ${orderId} marcada como PAGADA en Prisma.`);
                    }
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("Error MercadoPago webhook:", error);
        return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 });
    }
}
