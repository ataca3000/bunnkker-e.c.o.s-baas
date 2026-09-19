import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';
import { sendMail } from '@/lib/mail';
import { auth, db } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    const auth = validateApiSession(req);
    if (!auth.ok) return auth.response;
    try {
        const body = await req.json();
        const { type, data, targetEmail, securityToken } = body;

        // VERIFICACIÓN DE SEGURIDAD BÁSICA
        // En producción, esto debería ser un secreto compartido o un JWT
        if (process.env.INTERNAL_API_SECRET && securityToken !== process.env.INTERNAL_API_SECRET) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        let businessName = 'Nuestro Negocio';
        try {
            const siteConfigSnap = await db.collection('settings').doc('site_config').get();
            const siteConfigData = siteConfigSnap.data() as any;
            if (siteConfigSnap.exists && siteConfigData?.businessName) {
                businessName = siteConfigData.businessName;
            }
        } catch (e) {
            console.error("Error leyendo configuración del negocio en API:", e);
        }

        let subject = '';
        let html = '';

        switch (type) {
            case 'ERROR_CRITICAL':
                subject = `🚨 ALERTA CRÍTICA: Error en Sistema`;
                html = `
                    <div style="font-family: sans-serif; border: 2px solid #E30613; padding: 20px; border-radius: 10px;">
                        <h2 style="color: #E30613;">Se ha detectado un error crítico</h2>
                        <p><b>Descripción:</b> ${data.message}</p>
                        <p><b>Usuario:</b> ${data.userName} (${data.userId})</p>
                        <hr>
                        <p style="font-size: 0.8rem; color: #666;">Enviado automáticamente por el monitor de salud de ${businessName}.</p>
                    </div>
                `;
                break;

            case 'INVOICE_SENT':
                subject = `📄 Su Factura de ${businessName} - Orden #${data.orderId}`;
                html = `
                    <div style="font-family: sans-serif; padding: 20px;">
                        <h2>Gracias por su compra</h2>
                        <p>Adjunto encontrará su factura por su pedido reciente.</p>
                        <p><b>Orden:</b> #${data.orderId}</p>
                        <p><b>Total:</b> $${data.total} MXN</p>
                        <br>
                        <p><i>${businessName} - Agradece su preferencia.</i></p>
                    </div>
                `;
                break;

            case 'PANIC_ALERT':
                subject = `🚨 BOTÓN DE PÁNICO ACTIVADO - REPARTIDOR EN PELIGRO`;
                html = `
                    <div style="background-color: #E30613; color: white; padding: 30px; border-radius: 10px; font-family: sans-serif;">
                        <h1>¡EMERGENCIA DETECTADA!</h1>
                        <p>Un repartidor ha presionado el botón de pánico.</p>
                        <p><b>Nombre:</b> ${data.driverName}</p>
                        <p><b>Ubicación:</b> <a href="${data.mapsUrl}" style="color: yellow; font-weight: bold;">VER EN GOOGLE MAPS</a></p>
                        <p><b>Hora:</b> ${new Date().toLocaleString()}</p>
                    </div>
                `;
                break;

            default:
                subject = `Notificación de Sistema`;
                html = `<p>${JSON.stringify(data)}</p>`;
        }

        const result = await sendMail({
            to: targetEmail || process.env.ADMIN_EMAIL || '',
            subject,
            html
        });

        // Registrar el envío en los logs de auditoría (opcional)
        if (result.success) {
            await db.collection('audit_logs').add({
                type: 'EMAIL_SENT',
                description: `Correo enviado: ${subject} a ${targetEmail}`,
                timestamp: new Date(),
                system: 'NOTIFICATION_SERVICE'
            });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error en Notification API:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
