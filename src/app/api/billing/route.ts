import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';
import Facturapi from 'facturapi';
import { db, auth } from '@/lib/firebase-admin';
import { prisma } from '@/lib/prisma';

// VULNERABILITY B FIXED: Secure Key Retrieval
// The API key is ONLY retrieved from secure environment variables.
// It is no longer read from the public-facing Firestore 'config' collection.
async function getFacturapiKey() {
    const secretSnap = await db.collection('secrets').doc('billing').get();
    if (secretSnap.exists) {
        return secretSnap.data()?.facturapi_key;
    }
    return null;
}

export async function POST(req: NextRequest) {
    const sessionAuth = validateApiSession(req);
    if (!sessionAuth.ok) return sessionAuth.response;
    try {
        // 1. VERIFICACIÓN DE IDENTIDAD (SECURITY GATE)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado: Falta Token' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 2. VERIFICACIÓN DE ROL (RBAC) Y LICENCIA (FREEMIUM)
        const userDoc = await db.collection('users').doc(uid).get();
        const userData = userDoc.data();
        const userRole = userData?.role;
        const isPremium = userData?.isPremium === true;

        if (userRole !== 'superadmin' && userRole !== 'billing') {
            return NextResponse.json({ error: 'Permisos insuficientes para facturar' }, { status: 403 });
        }

        // BLOQUEO FREEMIUM
        if (!isPremium && userRole !== 'superadmin') {
             return NextResponse.json({ error: 'La facturación automática requiere una Licencia PRO' }, { status: 402 });
        }

        const apiKey = await getFacturapiKey();
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'API Key de Facturapi no configurada en el servidor' }, { status: 503 });
        }

        const body = await req.json();
        const { customer, items, payment_form, use, tenantId = 'default' } = body;

        if (!customer || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Datos de facturación o productos faltantes' }, { status: 400 });
        }

        const facturapiKey = await getFacturapiKey();
        if (!facturapiKey) {
            return NextResponse.json({ error: 'Sistema de facturación no configurado' }, { status: 500 });
        }

        const facturapi = new Facturapi(facturapiKey);

        const verifiedItems = [];
        for (const item of items) {
            const productDoc = await db.collection('products').doc(item.id).get();
            
            if (productDoc.exists) {
                const productData = productDoc.data() as any;
                verifiedItems.push({
                    product: {
                        description: productData?.name || 'Producto General',
                        product_key: productData?.satKey || '01010101',
                        price: productData?.price || 0,
                    },
                    quantity: item.quantity
                });
            }
        }

        if (verifiedItems.length === 0) {
             return NextResponse.json({ error: 'No se encontraron productos válidos en la base de datos' }, { status: 400 });
        }

        // 3. LOG DE ACCIÓN (AUDIT)
        await db.collection('audit_logs').add({
            type: 'INVOICE_GENERATE',
            userId: uid,
            userName: userData?.displayName || (decodedToken as any).email,
            userRole: userRole,
            description: `Generación de factura iniciada vía API para ${verifiedItems.length} items`,
            timestamp: new Date(),
            system: 'API_NODE'
        });

        // 4. GENERAR FACTURA CON DATOS VERIFICADOS
        let invoice: any;
        let isQueued = false;

        try {
            invoice = await facturapi.invoices.create({
                customer,
                items: verifiedItems,
                payment_form,
                use,
                type: 'I',
            });
        } catch (apiError: any) {
            console.error("Facturapi is offline or failed. Queuing invoice generation:", apiError);
            
            await prisma.syncQueue.create({
                data: {
                    collection: 'invoices',
                    action: 'CREATE',
                    payload: JSON.stringify({
                        customer,
                        items: verifiedItems,
                        payment_form,
                        use,
                        type: 'I',
                        uid,
                        userEmail: (decodedToken as any)?.email || 'unknown',
                        tenantId
                    }),
                    status: 'PENDING',
                    errorMsg: apiError.message
                }
            });
            isQueued = true;
        }

        if (isQueued) {
            return NextResponse.json({ 
                success: true, 
                queued: true, 
                message: 'La factura ha sido encolada para timbrado automático debido a una caída temporal del SAT o Facturapi. Se enviará por correo una vez emitida.' 
            });
        }

        // 5. ENVÍO AUTOMÁTICO DE CORREO (NOTIFICACIÓN)
        try {
            let businessName = 'Nuestro Negocio';
            try {
                const siteConfigSnap = await db.collection('settings').doc('site_config').get();
                const siteConfigData = siteConfigSnap.data() as any;
                if (siteConfigSnap.exists && siteConfigData?.businessName) {
                    businessName = siteConfigData.businessName;
                }
            } catch (e) {
                console.error("Error leyendo configuración del negocio:", e);
            }

            await import('@/lib/mail').then(m => m.sendMail({
                to: customer.email,
                subject: `📄 Su Factura - ${businessName} - Orden #${invoice.id}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #0ea5e9;">${businessName}</h2>
                        <p>Estimado cliente, su factura ha sido generada con éxito.</p>
                        <hr>
                        <p><b>Folio:</b> ${invoice.id}</p>
                        <p><b>Total:</b> $${invoice.total} MXN</p>
                        <p>Puede descargar su factura desde el portal del SAT o contactarnos si tiene dudas.</p>
                        <br>
                        <p style="font-size: 0.8rem; color: #888;">Este es un correo automático, por favor no responda.</p>
                    </div>
                `
            }));

            if (process.env.ADMIN_EMAIL) {
                await import('@/lib/mail').then(m => m.sendMail({
                    to: process.env.ADMIN_EMAIL!,
                    subject: `🚨 [COPIA ADMIN] Factura Generada - ${customer.legal_name}`,
                    html: `<p>Se ha generado una nueva factura para <b>${customer.legal_name}</b> por un total de <b>$${invoice.total}</b>.</p>`
                }));
            }
        } catch (mailErr) {
            console.error("Error enviando correos de factura:", mailErr);
        }

        return NextResponse.json({ success: true, data: invoice });
    } catch (error: any) {
        console.error("Error en Billing API:", error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error interno' },
            { status: 500 }
        );
    }
}
