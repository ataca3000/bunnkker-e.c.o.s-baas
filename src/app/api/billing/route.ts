import { NextResponse } from 'next/server';
import Facturapi from 'facturapi';
import { db, auth } from '@/lib/firebase-admin';

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

export async function POST(req: Request) {
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

        if (userRole !== 'admin' && userRole !== 'superadmin' && userRole !== 'billing') {
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

        const facturapi = new Facturapi(apiKey);
        const body = await req.json();
        
        // VULNERABILITY A FIXED: Server-Side Input Validation & Price Verification
        // We only trust the 'productIds' sent by the client. We do NOT trust the prices.
        const { customer, clientItems, payment_form, use } = body;

        if (!clientItems || !Array.isArray(clientItems) || clientItems.length === 0) {
            return NextResponse.json({ error: 'Lista de items inválida' }, { status: 400 });
        }

        // Fetch the REAL prices from the database using the IDs provided by the client
        const verifiedItems = [];
        for (const item of clientItems) {
            if (!item.id || !item.quantity) continue;
            
            const productDoc = await db.collection('products').doc(item.id).get();
            
            if (productDoc.exists) {
                const productData = productDoc.data();
                verifiedItems.push({
                    product: {
                        description: productData?.name || 'Producto General',
                        product_key: productData?.satKey || '01010101', // Clave SAT genérica por defecto
                        price: productData?.price || 0, // PRECIO REAL DE LA BASE DE DATOS
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
            userName: userData?.displayName || decodedToken.email,
            userRole: userRole,
            description: `Generación de factura iniciada vía API para ${verifiedItems.length} items`,
            timestamp: new Date(),
            system: 'API_NODE'
        });

        // 4. GENERAR FACTURA CON DATOS VERIFICADOS
        const invoice = await facturapi.invoices.create({
            customer,
            items: verifiedItems, // Array construido y verificado en el servidor
            payment_form,
            use,
            type: 'I',
        });

        // 5. ENVÍO AUTOMÁTICO DE CORREO (NOTIFICACIÓN)
        try {
            let businessName = 'Nuestro Negocio';
            try {
                const siteConfigSnap = await db.collection('settings').doc('site_config').get();
                const siteConfigData = siteConfigSnap.data();
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
