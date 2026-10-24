import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, getTenantId } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
    try {
        const tenantId = getTenantId(req);
        const staffAuth = requireRole(req, ['superadmin', 'admin', 'sales', 'caja']);
        const { phone, email, rfc } = await req.json();
        const searchPhone = phone ? String(phone).trim() : '';
        const searchEmail = email ? String(email).trim().toLowerCase() : '';
        const searchRfc = rfc ? String(rfc).trim().toUpperCase() : '';

        if (!searchPhone && !searchEmail) {
            return NextResponse.json(
                { success: false, error: 'Proporciona tu número de teléfono o correo registrado.' },
                { status: 400 }
            );
        }

        // SEGURIDAD: Si no es personal de caja en mostrador, exigir doble factor de identidad (teléfono + email/RFC)
        if (!staffAuth.ok && (!searchPhone || (!searchEmail && !searchRfc))) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Por seguridad, para restablecer tu PIN sin acudir a mostrador debes proporcionar tu teléfono junto con tu correo o RFC registrado.'
                },
                { status: 403 }
            );
        }

        let customer = null;

        if (searchPhone) {
            customer = await prisma.customer.findFirst({
                where: { tenantId, phone: searchPhone }
            });
        }

        if (!customer && searchPhone.length >= 10) {
            const rawPhone = searchPhone.replace(/\D/g, '').slice(-10);
            customer = await prisma.customer.findFirst({
                where: { tenantId, phone: { contains: rawPhone } }
            });
        }

        if (!customer) {
            return NextResponse.json(
                { success: false, error: 'No encontramos ninguna cuenta registrada con esa información.' },
                { status: 404 }
            );
        }

        // Si es autogestión pública, validar coincidencia estricta del segundo factor (email o RFC)
        if (!staffAuth.ok) {
            const emailMatches = Boolean(searchEmail && customer.email && customer.email.trim().toLowerCase() === searchEmail);
            const rfcMatches = Boolean(searchRfc && customer.rfc && customer.rfc.trim().toUpperCase() === searchRfc);
            if (!emailMatches && !rfcMatches) {
                return NextResponse.json(
                    { success: false, error: 'Los datos de verificación (correo/RFC) no coinciden con la cuenta registrada.' },
                    { status: 403 }
                );
            }
        }

        // Generar PIN de recuperación seguro (4 dígitos)
        const pinArray = new Uint16Array(1);
        crypto.getRandomValues(pinArray);
        const newPin = String(1000 + (pinArray[0] % 9000));

        await prisma.customer.update({
            where: { id: customer.id },
            data: { pin: newPin }
        });

        return NextResponse.json({
            success: true,
            message: `¡Contraseña/PIN restablecido con éxito! Tu nuevo PIN temporal es: ${newPin}. Inicia sesión y modifícalo en tu perfil.`,
            newPin
        });

    } catch (error: any) {
        console.error('[RESET PASSWORD ERROR]', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Error al procesar la recuperación de contraseña.' },
            { status: 500 }
        );
    }
}
