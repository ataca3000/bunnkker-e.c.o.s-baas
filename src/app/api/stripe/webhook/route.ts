import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text();
        const signature = req.headers.get('stripe-signature') as string;

        // 1. Fetch config from Firestore to get Webhook Secret
        const secretSnap = await adminDb.doc('secrets/billing').get();
        if (!secretSnap.exists) {
            console.error("[Stripe Webhook] Error: Secretos no configurados");
            return NextResponse.json({ error: 'Configuración de Stripe faltante' }, { status: 400 });
        }
        
        const secretData = secretSnap.data() as any;
        const secretKey = secretData.stripe_secret_key;
        const webhookSecret = secretData.stripe_webhook_secret || ''; // Debe añadirse en el futuro en setup, pero por ahora podemos procesar sin validación si no hay webhookSecret o ignorar

        const stripe = new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' });

        let event: Stripe.Event;

        try {
            if (!webhookSecret) {
                throw new Error("Webhook secret not configured");
            }
            event = stripe.webhooks.constructEvent(bodyText, signature, webhookSecret);
        } catch (err: any) {
            console.error(`⚠️ Webhook signature verification failed.`, err.message);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        // 2. Handle Event
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            const orderId = session.metadata?.orderId;

            if (orderId) {
                // Marcar orden como PAGADA en Firebase
                await adminDb.doc(`orders/${orderId}`).update({
                    status: 'paid',
                    paymentDetails: {
                        provider: 'stripe',
                        id: session.payment_intent,
                        paidAt: new Date().toISOString()
                    }
                });
                console.log(`[Stripe Webhook] Orden ${orderId} marcada como PAGADA.`);
            }
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("Error Stripe webhook:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
