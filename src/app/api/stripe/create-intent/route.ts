import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { amount, orderId, customer } = body;

        // 1. Fetch config from local environment
        const secretKey = process.env.STRIPE_SECRET_KEY;

        if (!secretKey) {
            return NextResponse.json({ error: 'Stripe no está configurado (STRIPE_SECRET_KEY faltante en .env)' }, { status: 400 });
        }

        // 2. Initialize Stripe
        const stripe = new Stripe(secretKey, {
            apiVersion: '2026-06-24.dahlia' as any, // Updated to match installed stripe package version
        });

        // 3. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
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
