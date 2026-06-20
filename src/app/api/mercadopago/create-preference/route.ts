import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { items, orderId, customer } = body;

        // 1. Fetch config from Firestore
        const settingsSnap = await adminDb.doc('settings/site_config').get();
        if (!settingsSnap.exists) {
            return NextResponse.json({ error: 'Configuración no encontrada' }, { status: 400 });
        }
        
        const configData = settingsSnap.data() as any;
        const accessToken = configData.mp_access_token;

        if (!accessToken) {
            return NextResponse.json({ error: 'MercadoPago no está configurado por el administrador' }, { status: 400 });
        }

        // 2. Initialize MercadoPago SDK
        const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
        const preference = new Preference(client);

        // 3. Create Preference
        const response = await preference.create({
            body: {
                items: items.map((item: any) => ({
                    id: item.id,
                    title: item.name,
                    quantity: item.quantity,
                    unit_price: Number(item.price),
                    currency_id: 'MXN'
                })),
                payer: {
                    name: customer.name,
                    email: "cliente@ejemplo.com", // Puedes pedir email en el checkout después
                },
                external_reference: orderId,
                back_urls: {
                    success: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/catalogo?status=success`,
                    failure: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/catalogo?status=failure`,
                    pending: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/catalogo?status=pending`
                },
                auto_return: 'approved'
            }
        });

        return NextResponse.json({ preferenceId: response.id, init_point: response.init_point });
    } catch (error: any) {
        console.error("Error MercadoPago create-preference:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
