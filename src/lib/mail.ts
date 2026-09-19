import nodemailer from 'nodemailer';

// IMPORTANTE: Estas variables deben estar en el entorno del servidor (.env de Vercel/VPS)
// No se deben exponer al cliente.
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // Contraseña de Aplicación de Google
    },
});

interface MailOptions {
    to: string;
    subject: string;
    text?: string;
    html: string;
    attachments?: any[];
}

/**
 * Utilidad de servidor para enviar correos electrónicos vía Gmail.
 */
export async function sendMail(options: MailOptions) {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
        console.warn("⚠️ GMAIL_USER o GMAIL_PASS no configurados. Saltando envío de correo.");
        return { success: false, error: 'Credenciales no configuradas' };
    }

    try {
        const info = await transporter.sendMail({
            from: `"NOTIFICACIONES ERP" <${process.env.GMAIL_USER}>`,
            ...options,
        });
        console.log("📧 Correo enviado: %s", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("❌ Error enviando correo:", error);
        return { success: false, error };
    }
}
