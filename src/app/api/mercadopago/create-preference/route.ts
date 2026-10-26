import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { adminDb } from '@/lib/firebase-admin';
import { prisma } from '@/lib/prisma';
import { loadPersistentSiteConfig } from '@/lib/persistentSettings';
import { MercadoPagoConfig, Preference } from 'mercadopago';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { orderId, customer } = body;

        if (!orderId || typeof orderId !== 'string') {
            return NextResponse.json({ error: 'orderId es obligatorio' }, { status: 400 });
        }

        // 1. Verificar la orden real en la base de datos (NUNCA confiar en precios/montos del cliente)
        const dbOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { include: { product: true } } }
        });

        if (!dbOrder) {
            return NextResponse.json({ error: 'La orden especificada no existe en el servidor' }, { status: 404 });
        }

        if (!['pending_payment', 'pending_confirmation', 'pending'].includes(dbOrder.status)) {
            return NextResponse.json({ error: 'Esta orden ya fue procesada o no admite pago' }, { status: 400 });
        }

        // 2. Obtener token de MercadoPago desde configuración local, env o Firestore
        const localConfig = loadPersistentSiteConfig(dbOrder.tenantId || 'default');
        let accessToken = process.env.MP_ACCESS_TOKEN || localConfig?.mp_access_token;

        if (!accessToken) {
            try {
                const settingsSnap = await adminDb.doc('settings/site_config').get();
                if (settingsSnap.exists) {
                    const configData = settingsSnap.data() as any;
                    accessToken = configData?.mp_access_token;
                }
            } catch {}
        }

        if (!accessToken) {
            return NextResponse.json({ error: 'MercadoPago no está configurado por el administrador' }, { status: 400 });
        }

        // 3. Construir el cobro usando el total autoritativo de la orden en BD
        const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
        const preference = new Preference(client);

        const response = await preference.create({
            body: {
                items: [
                    {
                        id: dbOrder.id,
                        title: `Pedido #${dbOrder.id}`,
                        quantity: 1,
                        unit_price: Number(dbOrder.total),
                        currency_id: 'MXN'
                    }
                ],
                payer: {
                    name: customer?.name || 'Cliente',
                    email: customer?.email || 'cliente@ejemplo.com',
                },
                external_reference: dbOrder.id,
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
        return NextResponse.json({ error: 'Error creando preferencia de pago' }, { status: 500 });
    }
}
