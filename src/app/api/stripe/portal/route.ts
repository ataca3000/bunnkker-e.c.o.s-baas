import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb, auth } from '@/lib/firebase-admin';
import { customerBillingPortalEnabled } from '@/flags';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    if (!(await customerBillingPortalEnabled())) {
      return NextResponse.json({ error: 'El portal de facturación está pausado.' }, { status: 403 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Stripe no está configurado.' }, { status: 503 });
    }

    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const decodedToken = await auth.verifyIdToken(authorization.slice(7).trim(), true);
    if (!decodedToken.uid) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const findCustomerId = (snapshot: { docs: Array<{ data: () => Record<string, unknown> }> }) =>
      snapshot.docs
        .map((document) => document.data().stripeCustomerId)
        .find((value): value is string => typeof value === 'string' && value.startsWith('cus_'));

    const userTenants = await adminDb
      .collection('tenants')
      .where('userId', '==', decodedToken.uid)
      .limit(10)
      .get();
    let customerId = findCustomerId(userTenants);

    const email = typeof decodedToken.email === 'string' ? decodedToken.email.trim().toLowerCase() : '';
    if (!customerId && email && decodedToken.email_verified === true) {
      const emailTenants = await adminDb
        .collection('tenants')
        .where('email', '==', email)
        .limit(10)
        .get();
      customerId = findCustomerId(emailTenants);
    }

    if (!customerId) {
      return NextResponse.json({ error: 'No se encontró una suscripción para esta cuenta.' }, { status: 404 });
    }

    const configuredBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const returnOrigin = configuredBaseUrl ? new URL(configuredBaseUrl).origin : new URL(request.url).origin;
    const requestOrigin = request.headers.get('origin');
    if (requestOrigin && new URL(requestOrigin).origin !== returnOrigin) {
      return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2026-06-24.dahlia' as any });
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: new URL('/dashboard/suscripcion', returnOrigin).toString(),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[stripe-portal]', error instanceof Error ? error.message : 'Error desconocido');
    return NextResponse.json({ error: 'No se pudo abrir el portal de facturación.' }, { status: 500 });
  }
}
