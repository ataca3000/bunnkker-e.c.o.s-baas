import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function POST(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const type = url.searchParams.get('type') || url.searchParams.get('topic');
        const dataId = url.searchParams.get('data.id') || url.searchParams.get('id');

        if (type === 'payment' && dataId) {
            // 1. Fetch config from Firestore
            const settingsSnap = await adminDb.doc('settings/site_config').get();
            if (settingsSnap.exists) {
                const configData = settingsSnap.data() as any;
                const accessToken = configData.mp_access_token;

                if (accessToken) {
                    const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
                    const payment = new Payment(client);
                    
                    // Buscar detalles del pago
                    const paymentInfo = await payment.get({ id: dataId });
                    
                    if (paymentInfo.status === 'approved') {
                        const orderId = paymentInfo.external_reference;
                        if (orderId) {
                            // Marcar orden como PAGADA en Firebase
                            await adminDb.doc(`orders/${orderId}`).update({
                                status: 'paid',
                                paymentDetails: {
                                    provider: 'mercadopago',
                                    id: dataId,
                                    paidAt: new Date().toISOString()
                                }
                            });
                            console.log(`[MP Webhook] Orden ${orderId} marcada como PAGADA.`);
                        }
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
