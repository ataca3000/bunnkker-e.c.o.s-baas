import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SignJWT } from 'jose';
import { signRole, getTenantId } from '@/lib/apiAuth';
import bcrypt from 'bcryptjs';
import { queueCloudSync, processCloudSyncQueue } from '@/lib/cloudSyncWorker';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || process.env.INTERNAL_API_SECRET || 'bunkker-ecos-default-local-dev-secret-key-2026'
);

function sanitizeCustomer(customer: any) {
    if (!customer) return null;
    const { pin: _pin, signatureData: _sig, photoData: _photo, ...safe } = customer;
    return safe;
}

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
                const isBcrypt = customer.pin.startsWith('$2a$') || customer.pin.startsWith('$2b$');
                const matches = cleanPin
                    ? (isBcrypt ? await bcrypt.compare(cleanPin, customer.pin) : customer.pin === cleanPin)
                    : false;

                if (!matches) {
                    return NextResponse.json(
                        { success: false, error: 'Esta cuenta ya está registrada. Por favor ingresa tu contraseña correcta en Iniciar Sesión.' },
                        { status: 401 }
                    );
                }
            } else {
                // Si la cuenta fue creada en mostrador sin PIN, no permitir que un tercero sin verificar correo/RFC la reclame libremente
                const emailMatches = Boolean(customer.email && customer.email.toLowerCase() === cleanEmail);
                const rfcMatches = Boolean(customer.rfc && rfc && customer.rfc.toUpperCase() === rfc.trim().toUpperCase());
                if (!emailMatches && !rfcMatches) {
                    return NextResponse.json(
                        { success: false, error: 'Este número ya cuenta con historial en tienda. Solicita tu activación en mostrador o verifica tu correo/RFC registrado.' },
                        { status: 403 }
                    );
                }
                if (cleanPin) {
                    const hashedPin = await bcrypt.hash(cleanPin, 10);
                    customer = await prisma.customer.update({
                        where: { id: customer.id },
                        data: { pin: hashedPin }
                    });
                }
            }
        } else {
            const hashedPin = cleanPin ? await bcrypt.hash(cleanPin, 10) : null;
            customer = await prisma.customer.create({
                data: {
                    tenantId,
                    name: name.trim(),
                    email: cleanEmail,
                    phone: cleanPhone,
                    pin: hashedPin,
                    address: address?.trim() || null,
                    rfc: rfc?.trim().toUpperCase() || null
                }
            });
        }

        // Replicación silenciosa en segundo plano a la nube / Supabase sin bloquear la respuesta local
        queueCloudSync({
            tenantId,
            collection: 'customers',
            documentId: customer.id,
            action: 'CREATE',
            payload: {
                id: customer.id,
                tenantId,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                address: customer.address,
                rfc: customer.rfc,
                createdAt: customer.createdAt,
            }
        }).then(() => {
            processCloudSyncQueue({ batchSize: 5 }).catch(() => {});
        }).catch(() => {});

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

        const sig = signRole('client', customer.id, tenantId);
        const safeCustomer = sanitizeCustomer(customer);

        const response = NextResponse.json({
            success: true,
            customer: safeCustomer,
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
