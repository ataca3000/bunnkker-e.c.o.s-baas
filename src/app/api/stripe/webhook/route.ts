import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2024-06-20' as any,
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
      const code = crypto.randomInt(100000, 999999).toString();
      
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
      const invoice = event.data.object as any;
      if (invoice.subscription) {
        console.log(`[Stripe Webhook] Renovación exitosa para suscripción: ${invoice.subscription}`);
        // We could update the tenant's 'lastPaid' field here
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantsSnapshot = await adminDb.collection('tenants').where('stripeSubscriptionId', '==', subscription.id).get();
      if (!tenantsSnapshot.empty) {
        for (const doc of tenantsSnapshot.docs) {
          await doc.ref.update({
            status: 'suspended',
            suspendedAt: new Date().toISOString()
          });
        }
        console.log(`[Stripe Webhook] Inquilino(s) suspendido(s) por cancelación de suscripción: ${subscription.id}`);
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.customer) {
        const tenantsSnapshot = await adminDb.collection('tenants').where('stripeCustomerId', '==', invoice.customer as string).get();
        if (!tenantsSnapshot.empty) {
          for (const doc of tenantsSnapshot.docs) {
            const data = doc.data();
            await doc.ref.update({
              status: 'payment_failed',
              paymentFailedAt: new Date().toISOString(),
              failedPaymentCount: (data.failedPaymentCount || 0) + 1
            });
          }
          console.log(`[Stripe Webhook] Inquilino(s) marcado(s) con pago fallido para cliente: ${invoice.customer}`);
        }
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantsSnapshot = await adminDb.collection('tenants').where('stripeSubscriptionId', '==', subscription.id).get();
      if (!tenantsSnapshot.empty) {
        const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
        const newPriceId = subscription.items.data[0]?.price.id;
        const newPlan = newPriceId === proPriceId ? 'PRO' : 'BASIC';

        for (const doc of tenantsSnapshot.docs) {
          const updateData: any = { plan: newPlan };
          if (doc.data().status === 'payment_failed' || doc.data().status === 'suspended') {
            updateData.status = 'active';
          }
          await doc.ref.update(updateData);
        }
        console.log(`[Stripe Webhook] Suscripción actualizada para ${subscription.id}. Plan: ${newPlan}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error interno:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
