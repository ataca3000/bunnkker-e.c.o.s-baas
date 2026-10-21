import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SignJWT } from 'jose';
import { signRole, getTenantId } from '@/lib/apiAuth';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_local_key');

export async function POST(req: NextRequest) {
    try {
        const tenantId = getTenantId(req);
        const body = await req.json();
        const { name, email, phone, password, address, rfc } = body;

        if (!name || !email) {
            return NextResponse.json({ success: false, error: 'Nombre y Correo Electrónico obligatorios' }, { status: 400 });
        }

        const rawInput = (email || '').trim();
        const isEmailInput = rawInput.includes('@');
        const cleanEmail = isEmailInput ? rawInput.toLowerCase() : `${rawInput.replace(/\D/g, '')}@cliente.local`;
        
        let cleanPhone = phone ? phone.replace(/\D/g, '') : '';
        if (!cleanPhone) {
            if (!isEmailInput) {
                cleanPhone = rawInput.replace(/\D/g, '');
            } else {
                // Generar identificador telefónico sintético determinista para clientes que solo ingresan email
                cleanPhone = `00${Buffer.from(cleanEmail).toString('hex').slice(0, 10)}`;
            }
        }
        const cleanPin = password ? password.trim() : null;

        let customer = await prisma.customer.findFirst({
            where: {
                tenantId,
                OR: [
                    ...(cleanPhone ? [{ phone: cleanPhone }] : []),
                    ...(cleanEmail ? [{ email: cleanEmail }] : [])
                ]
            }
        });

        if (customer) {
            // Anti-suplantación: Si el cliente ya existe y tiene un PIN registrado, validar credenciales
            if (customer.pin) {
                if (!cleanPin || customer.pin !== cleanPin) {
                    return NextResponse.json(
                        { success: false, error: 'Esta cuenta ya está registrada. Por favor ingresa tu contraseña correcta en Iniciar Sesión.' },
                        { status: 401 }
                    );
                }
            } else if (cleanPin) {
                // Asignar PIN si la cuenta existía previamente sin PIN (ej. venta en mostrador)
                customer = await prisma.customer.update({
                    where: { id: customer.id },
                    data: { pin: cleanPin }
                });
            }
        } else {
            customer = await prisma.customer.create({
                data: {
                    tenantId,
                    name: name.trim(),
                    email: cleanEmail,
                    phone: cleanPhone,
                    pin: cleanPin,
                    address: address?.trim() || null,
                    rfc: rfc?.trim().toUpperCase() || null
                }
            });
        }

        const isHttps =
            req.url.startsWith('https://') ||
            req.headers.get('x-forwarded-proto') === 'https' ||
            req.headers.get('origin')?.startsWith('https://') ||
            req.headers.get('referer')?.startsWith('https://');

        const cookieOpts = {
            httpOnly: false,
            secure: isHttps,
            sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30
        };

        const token = await new SignJWT({
            uid: customer.id,
            role: 'customer',
            name: customer.name,
            phone: customer.phone,
            email: customer.email
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('30d')
            .sign(JWT_SECRET);

        const sig = signRole('client', customer.id);

        const response = NextResponse.json({
            success: true,
            customer,
            uid: customer.id,
            role: 'client',
            signature: sig,
            token
        });

        response.cookies.set('admincom_session', token, cookieOpts);
        response.cookies.set('msj-session', customer.id, cookieOpts);
        response.cookies.set('msj-role', 'client', cookieOpts);
        response.cookies.set('msj-role-sig', sig, cookieOpts);

        return response;
    } catch (error: any) {
        console.error('[Register Client API] Error:', error);
        return NextResponse.json({ success: false, error: 'Error registrando datos de cliente' }, { status: 500 });
    }
}
