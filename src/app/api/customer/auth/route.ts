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
        const { phone, pin, action, name } = await req.json();

        if (!phone || !pin) {
            return NextResponse.json({ error: 'Teléfono y PIN son requeridos' }, { status: 400 });
        }

        if (action === 'register') {
            if (!name) return NextResponse.json({ error: 'El nombre es requerido para registrarse' }, { status: 400 });
            
            const identifier = (phone || '').trim();
            const existing = await prisma.customer.findFirst({
                where: {
                    tenantId,
                    OR: [
                        { phone: identifier },
                        { email: identifier.toLowerCase() }
                    ]
                }
            });
            if (existing) {
                return NextResponse.json({ error: 'El teléfono o correo ya está registrado' }, { status: 400 });
            }

            const isEmail = identifier.includes('@');
            const hashedPin = await bcrypt.hash(String(pin).trim(), 10);
            const newCustomer = await prisma.customer.create({
                data: {
                    tenantId,
                    phone: isEmail ? `55${Date.now().toString().slice(-8)}` : identifier,
                    email: isEmail ? identifier.toLowerCase() : undefined,
                    pin: hashedPin,
                    name
                }
            });

            // Replicación silenciosa a la nube en segundo plano
            queueCloudSync({
                tenantId,
                collection: 'customers',
                documentId: newCustomer.id,
                action: 'CREATE',
                payload: {
                    id: newCustomer.id,
                    tenantId,
                    name: newCustomer.name,
                    email: newCustomer.email,
                    phone: newCustomer.phone,
                    createdAt: newCustomer.createdAt,
                }
            }).then(() => {
                processCloudSyncQueue({ batchSize: 5 }).catch(() => {});
            }).catch(() => {});

            const token = await new SignJWT({ 
                uid: newCustomer.id, 
                phone: newCustomer.phone, 
                role: 'customer',
                name: newCustomer.name 
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('30d')
                .sign(JWT_SECRET);

            const sig = signRole('client', newCustomer.id, tenantId);
            const isHttps = req.url.startsWith('https://') || req.headers.get('x-forwarded-proto') === 'https';
            const cookieOpts = {
                httpOnly: false,
                secure: isHttps,
                sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
                path: '/',
                maxAge: 30 * 24 * 60 * 60
            };
            const safeCustomer = sanitizeCustomer(newCustomer);
            const res = NextResponse.json({ 
                success: true, 
                customer: safeCustomer,
                uid: newCustomer.id,
                role: 'client',
                signature: sig,
                token
            });
            res.cookies.set('admincom_session', token, cookieOpts);
            res.cookies.set('msj-session', newCustomer.id, cookieOpts);
            res.cookies.set('msj-role', 'client', cookieOpts);
            res.cookies.set('msj-role-sig', sig, cookieOpts);
            return res;
        }

        // Login de Clientes Normal (sin backdoor de empleados)
        const identifier = (phone || '').trim();
        const customer = await prisma.customer.findFirst({
            where: {
                tenantId,
                OR: [
                    { phone: identifier },
                    { email: identifier.toLowerCase() }
                ]
            }
        });
        if (!customer || !customer.pin) {
            return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
        }

        const isBcrypt = customer.pin.startsWith('$2a$') || customer.pin.startsWith('$2b$');
        const pinValid = isBcrypt
            ? await bcrypt.compare(String(pin).trim(), customer.pin)
            : customer.pin === String(pin).trim();

        if (!pinValid) {
            return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
        }

        const token = await new SignJWT({ 
            uid: customer.id, 
            phone: customer.phone, 
            role: 'customer',
            name: customer.name 
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setExpirationTime('30d')
            .sign(JWT_SECRET);

        const sig = signRole('client', customer.id, tenantId);
        const isHttps = req.url.startsWith('https://') || req.headers.get('x-forwarded-proto') === 'https';
        const cookieOpts = {
            httpOnly: false,
            secure: isHttps,
            sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60
        };
        const safeCustomer = sanitizeCustomer(customer);
        const res = NextResponse.json({ 
            success: true, 
            customer: safeCustomer,
            uid: customer.id,
            role: 'client',
            signature: sig,
            token
        });
        res.cookies.set('admincom_session', token, cookieOpts);
        res.cookies.set('msj-session', customer.id, cookieOpts);
        res.cookies.set('msj-role', 'client', cookieOpts);
        res.cookies.set('msj-role-sig', sig, cookieOpts);
        
        return res;
    } catch {
        return NextResponse.json({ error: 'Error procesando autenticación de cliente' }, { status: 500 });
    }
}
