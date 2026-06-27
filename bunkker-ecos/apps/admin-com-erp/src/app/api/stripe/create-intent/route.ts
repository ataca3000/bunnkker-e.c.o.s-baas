import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@bunkker/core';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { amount, orderId, customer } = body;

        // 1. Fetch config from Firestore Vault
        const secretSnap = await adminDb.doc('secrets/billing').get();
        if (!secretSnap.exists) {
            return NextResponse.json({ error: 'Configuración no encontrada. El dueño no ha configurado Stripe.' }, { status: 400 });
        }
        
        const secretData = secretSnap.data() as any;
        const secretKey = secretData.stripe_secret_key;

        if (!secretKey) {
            return NextResponse.json({ error: 'Stripe no está configurado por el administrador' }, { status: 400 });
        }

        // 2. Initialize Stripe
        const stripe = new Stripe(secretKey, {
            apiVersion: '2026-05-27.dahlia', // Updated to match expected version
        });

        // 3. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'mxn',
                        product_data: {
                            name: `Pedido ${orderId}`,
                        },
                        unit_amount: Math.round(amount * 100), // En centavos
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/catalogo?status=success`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/catalogo?status=failure`,
            metadata: {
                orderId,
                customerName: customer.name
            }
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error("Error Stripe create-intent:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
