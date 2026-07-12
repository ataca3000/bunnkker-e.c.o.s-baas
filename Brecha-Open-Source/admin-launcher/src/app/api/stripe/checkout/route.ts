import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  // Omitimos la versión para que use el default de la cuenta
});

export async function POST(req: Request) {
  try {
    const { planName, price, tenantName } = await req.json();

    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY no está configurada en .env.local');
    }

    // Convertir el precio MXN a centavos (Stripe usa la unidad mínima de la moneda)
    const numericPrice = parseInt(price.replace(/[^0-9]/g, ''));
    if (isNaN(numericPrice) || numericPrice <= 0) {
        throw new Error('Monto inválido');
    }
    
    const unitAmount = numericPrice * 100;

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: `Suscripción ERP Admin.com - Plan ${planName}`,
              description: `Aprovisionamiento de Instancia Aislada: ${tenantName}.admin.com`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}?payment_success=true&tenant=${tenantName}`,
      cancel_url: `${origin}?payment_canceled=true`,
      metadata: {
        tenantName,
        planName
      }
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('Error generando Stripe Checkout:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
