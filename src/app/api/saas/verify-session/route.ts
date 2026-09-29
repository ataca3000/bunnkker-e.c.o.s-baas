import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase-admin';

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16' as any,
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    // Call Stripe API to retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 400 });
    }

    // Look up in Firestore 'pairings' collection for a doc where checkoutSessionId === session.id
    const pairingsSnapshot = await adminDb
      .collection('pairings')
      .where('checkoutSessionId', '==', sessionId)
      .limit(1)
      .get();

    if (pairingsSnapshot.empty) {
      // Webhook hasn't processed yet, return 202 so frontend can retry
      return NextResponse.json({ pending: true }, { status: 202 });
    }

    const doc = pairingsSnapshot.docs[0];
    const data = doc.data();

    return NextResponse.json({
      success: true,
      code: doc.id,
      tenantId: data.tenantId,
    });
  } catch (error: any) {
    console.error('[Verify Session] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
