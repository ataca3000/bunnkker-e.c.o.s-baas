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

        // Si no vienen en los parámetros de la URL, intentamos leer del body JSON (Webhook estándar)
        if (!type || !dataId) {
            try {
                const body = await req.json();
                if (body) {
                    type = type || body.type || (body.action ? body.action.split('.')[0] : null);
                    dataId = dataId || (body.data?.id ? String(body.data.id) : (body.id ? String(body.id) : null));
                }
            } catch {
                // No hay body JSON o no se pudo parsear
            }
        }

        if (type === 'payment' && dataId) {
            // 1. Obtener token desde configuración local o Firestore
            const localConfig = loadPersistentSiteConfig('default');
            let accessToken = process.env.MP_ACCESS_TOKEN || localConfig?.mp_access_token;

            if (!accessToken) {
                try {
                    const settingsSnap = await adminDb.doc('settings/site_config').get();
                    if (settingsSnap.exists) {
                        const configData = settingsSnap.data() as any;
                        accessToken = configData?.mp_access_token;
                    }
                } catch {
                    // Continuar sin Firestore si es entorno local
                }
            }

            if (accessToken) {
                const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
                const payment = new Payment(client);

                // Buscar detalles del pago en MercadoPago
                const paymentInfo = await payment.get({ id: dataId });

                if (paymentInfo.status === 'approved') {
                    const orderId = paymentInfo.external_reference;
                    if (orderId) {
                        const paidAtDate = new Date();

                        // A. Actualizar en base de datos central (Prisma SQLite / PostgreSQL)
                        try {
                            const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
                            if (existingOrder) {
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
                                        details: JSON.stringify({ paymentId: dataId, paidAt: paidAtDate.toISOString() })
                                    }
                                }).catch(() => {});
                            }
                        } catch (prismaErr) {
                            console.warn(`[MP Webhook] Error actualizando orden ${orderId} en Prisma:`, prismaErr);
                        }

                        // B. Espejo opcional en Firebase si está disponible
                        try {
                            await adminDb.doc(`orders/${orderId}`).update({
                                status: 'paid',
                                paymentDetails: {
                                    provider: 'mercadopago',
                                    id: dataId,
                                    paidAt: paidAtDate.toISOString()
                                }
                            });
                        } catch {
                            // Non-fatal si Firestore no se usa
                        }

                        console.log(`[MP Webhook] Orden ${orderId} marcada como PAGADA en Prisma.`);
                    }
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("Error MercadoPago webhook:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
