import { NextResponse } from 'next/server';
import { extendSubscription } from '@bunkker/core';

export async function POST() {
    try {
        // En producción, este endpoint recibiría la confirmación firmada criptográficamente por Stripe.
        // Como estamos en fase beta/simulación, extendemos directamente 30 días.
        
        extendSubscription(30);
        
        return NextResponse.json({ success: true, message: 'Suscripción extendida por 30 días.' });
    } catch (err) {
        return NextResponse.json({ success: false, error: 'Error procesando el pago local' }, { status: 500 });
    }
}
