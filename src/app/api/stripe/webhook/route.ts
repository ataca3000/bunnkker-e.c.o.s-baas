import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2025-01-27.acacia' as any,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    // Validate Stripe webhook signature if secret is provided
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: any) {
        console.error('⚠️  Webhook signature verification failed.', err.message);
        return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
      }
    } else {
      // Fallback for local testing / parsing without signature
      event = JSON.parse(body);
    }

    // Handle the checkout.session.completed event (Successful PRO Purchase)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const customerEmail = session.customer_details?.email || session.customer_email;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      
      console.log(`[Stripe Webhook] Pago exitoso detectado para: ${customerEmail}`);

      // 1. Generate the 6-digit Serial
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 2. Generate a unique Tenant ID
      const tenantId = `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      // 3. Provision the Tenant in Firebase
      await adminDb.collection('tenants').doc(tenantId).set({
        email: customerEmail,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: 'active',
        plan: 'PRO',
        createdAt: new Date().toISOString(),
      });

      // 4. Save the pairing code (Serial) mapped to this tenant
      // We also store the checkout session ID so the frontend can auto-verify the user after payment redirection.
      await adminDb.collection('pairings').doc(code).set({
        tenantId,
        checkoutSessionId: session.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      console.log(`[Stripe Webhook] Inquilino ${tenantId} provisionado. Serial generado: ${code}`);
    }

    // Handle successful monthly renewals
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        console.log(`[Stripe Webhook] Renovación exitosa para suscripción: ${invoice.subscription}`);
        // We could update the tenant's 'lastPaid' field here
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error interno:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
