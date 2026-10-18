import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SignJWT } from 'jose';
import { signRole } from '@/lib/apiAuth';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_local_key');

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, email, phone, password, address, rfc } = body;

        if (!name || !email) {
            return NextResponse.json({ success: false, error: 'Nombre y Correo Electrónico obligatorios' }, { status: 400 });
        }

        const rawInput = (email || '').trim();
        const isEmailInput = rawInput.includes('@');
        const cleanEmail = isEmailInput ? rawInput.toLowerCase() : `${rawInput.replace(/\D/g, '')}@cliente.local`;
        const cleanPhone = isEmailInput 
            ? (phone ? phone.replace(/\D/g, '') : `55${Date.now().toString().slice(-8)}`)
            : rawInput.replace(/\D/g, '');
        const cleanPin = password ? password.trim() : null;

        let customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { phone: cleanPhone },
                    { email: cleanEmail }
                ]
            }
        });

        if (customer) {
            if (cleanPin && !customer.pin) {
                customer = await prisma.customer.update({
                    where: { id: customer.id },
                    data: { pin: cleanPin }
                });
            }
        } else {
            customer = await prisma.customer.create({
                data: {
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
            phone: customer.phone
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
