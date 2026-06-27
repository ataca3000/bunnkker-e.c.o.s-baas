import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma'; // Database local

export async function POST(req: NextRequest) {
    try {
        const bodyText = await req.text();
        const signature = req.headers.get('stripe-signature') as string;

        // 1. Fetch config from local environment
        const secretKey = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        if (!secretKey || !webhookSecret) {
            console.error("[Stripe Webhook] Error: Secretos no configurados en .env");
            return NextResponse.json({ error: 'Configuración de Stripe faltante en .env' }, { status: 400 });
        }
        
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
                // Marcar orden como PAGADA en Prisma (SQLite local)
                await prisma.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'paid',
                        paymentMethod: 'stripe'
                    }
                });
                
                // Opcional: También registramos en Auditoría para que el sistema local sepa
                await prisma.auditLog.create({
                    data: {
                        action: 'PAYMENT_RECEIVED',
                        details: `Stripe PaymentIntent: ${session.payment_intent}`,
                        userId: 'SYSTEM',
                        synced: false
                    }
                });

                console.log(`[Stripe Webhook] Orden local ${orderId} marcada como PAGADA a través del Túnel.`);
            }
        }

        return NextResponse.json({ received: true });
    } catch (error: any) {
        console.error("Error Stripe webhook:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
