import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orderId, customer } = body;

        if (!orderId || typeof orderId !== 'string') {
            return NextResponse.json({ error: 'orderId es obligatorio' }, { status: 400 });
        }

        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            return NextResponse.json({ error: 'Stripe no está configurado (STRIPE_SECRET_KEY faltante en .env)' }, { status: 400 });
        }

        // Obtener el monto real desde la base de datos (no confiar en amount del cliente)
        const dbOrder = await prisma.order.findUnique({ where: { id: orderId } });
        if (!dbOrder) {
            return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
        }

        if (!['pending_payment', 'pending_confirmation', 'pending'].includes(dbOrder.status)) {
            return NextResponse.json({ error: 'La orden ya fue pagada o procesada' }, { status: 400 });
        }

        const stripe = new Stripe(secretKey, {
            apiVersion: '2026-06-24.dahlia' as any,
        });

        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: 'mxn',
                        product_data: {
                            name: `Pedido ${dbOrder.id}`,
                        },
                        unit_amount: Math.round(Number(dbOrder.total) * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/catalogo?status=success`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/catalogo?status=failure`,
            metadata: {
                orderId: dbOrder.id,
                customerName: customer?.name || 'Cliente'
            }
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error("Error Stripe create-intent:", error);
        return NextResponse.json({ error: 'Error creando sesión de pago' }, { status: 500 });
    }
}
