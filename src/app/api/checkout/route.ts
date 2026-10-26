import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/firebase-admin';
import { isConfiguredPriceId } from '@/lib/products';
import { membershipCheckoutEnabled } from '@/flags';

export async function POST(req: Request) {
  try {
    if (!(await membershipCheckoutEnabled())) {
      return NextResponse.json({ error: 'El checkout de membresías está pausado.' }, { status: 403 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) return NextResponse.json({ error: 'Stripe no está configurado.' }, { status: 503 });

    const authorization = req.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const decodedToken = await auth.verifyIdToken(authorization.slice(7));
    const email = (decodedToken as { email?: string }).email;
    if (!email) return NextResponse.json({ error: 'La cuenta no tiene correo de facturación.' }, { status: 400 });
    const { priceId } = await req.json();
    if (!isConfiguredPriceId(priceId)) {
      return NextResponse.json({ error: 'Plan no disponible o Price ID no configurado.' }, { status: 400 });
    }

    const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const origin = configuredBaseUrl ? new URL(configuredBaseUrl).origin : new URL(req.url).origin;
    const requestOrigin = req.headers.get('origin');
    if (requestOrigin && new URL(requestOrigin).origin !== origin) {
      return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' as any });
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${origin}/dashboard/suscripcion?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard/suscripcion?checkout=cancelled`,
        metadata: { userId: decodedToken.uid },
      },
      { idempotencyKey: req.headers.get('idempotency-key') || crypto.randomUUID() },
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[checkout]', error);
    return NextResponse.json({ error: 'No se pudo iniciar el checkout.' }, { status: 500 });
  }
}
