import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/firebase-admin';

// Requerimos la llave secreta en el entorno para mayor seguridad
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
    apiVersion: '2026-02-25.clover' as any,
});

export async function POST(req: Request) {
    try {
        // 1. VERIFICACIÓN DE IDENTIDAD: Extraer el token de autorización
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado: Falta Token' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        
        // 2. VALIDAR TOKEN: Firebase se encarga de validar la firma del token
        const decodedToken = await auth.verifyIdToken(idToken);
        const userId = decodedToken.uid; // ID real y verificado por el backend
        
        // 3. OBTENER DATOS DE LA PETICIÓN
        // Extraemos solo lo necesario. El email real del usuario lo sacamos de su token.
        const { priceId } = await req.json();
        const email = (decodedToken as any).email;

        if (!priceId) {
             return NextResponse.json({ error: 'Falta el identificador de precio (priceId)' }, { status: 400 });
        }

        // 4. CREAR SESIÓN EN STRIPE
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: email, // Usamos el email seguro extraído del token
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${req.headers.get('origin')}/dashboard?payment=success`,
            cancel_url: `${req.headers.get('origin')}/dashboard?payment=cancelled`,
            metadata: {
                userId: userId, // ID seguro para el webhook
            },
        });

        return NextResponse.json({ url: session.url });

    } catch (error: any) {
        console.error("Error en Checkout API:", error);
        return NextResponse.json(
            { error: error.message || 'Error interno al procesar el pago' },
            { status: 500 }
        );
    }
}
