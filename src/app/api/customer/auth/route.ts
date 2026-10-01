import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { signRole } from '@/lib/apiAuth';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_local_key');

export async function POST(req: NextRequest) {
    try {
        const { phone, pin, action, name } = await req.json();

        if (!phone || !pin) {
            return NextResponse.json({ error: 'Teléfono y PIN son requeridos' }, { status: 400 });
        }

        if (action === 'register') {
            if (!name) return NextResponse.json({ error: 'El nombre es requerido para registrarse' }, { status: 400 });
            
            const existing = await prisma.customer.findUnique({ where: { phone } });
            if (existing) {
                return NextResponse.json({ error: 'El teléfono ya está registrado' }, { status: 400 });
            }

            const newCustomer = await prisma.customer.create({
                data: { phone, pin, name }
            });

            const token = await new SignJWT({ 
                uid: newCustomer.id, 
                phone: newCustomer.phone, 
                role: 'customer',
                name: newCustomer.name 
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setExpirationTime('30d')
                .sign(JWT_SECRET);

            const isHttps = req.url.startsWith('https://') || req.headers.get('x-forwarded-proto') === 'https';
            const cookieOpts = {
                httpOnly: true,
                secure: isHttps,
                sameSite: 'lax' as const,
                path: '/',
                maxAge: 30 * 24 * 60 * 60
            };
            const res = NextResponse.json({ success: true, customer: newCustomer });
            res.cookies.set('admincom_session', token, cookieOpts);
            res.cookies.set('msj-session', token, cookieOpts);
            return res;
        }

        // --- SUPER ADMIN / WORKER HIDDEN LOGIN (EASTER EGG) ---
        if (phone === '0000000000') {
            // Master fallback
            if ((pin === '0000' || pin === 'admin') && process.env.NODE_ENV === 'test') {
                const token = await new SignJWT({ 
                    uid: 'local_master', 
                    phone: '0000000000', 
                    role: 'superadmin',
                    name: 'Super Admin Maestro' 
                })
                    .setProtectedHeader({ alg: 'HS256' })
                    .setExpirationTime('30d')
                    .sign(JWT_SECRET);
                
                const sig = signRole('superadmin', 'local_master');
                const res = NextResponse.json({ success: true, customer: { role: 'superadmin' }, redirect: '/dashboard' });
                res.cookies.set('msj-session', 'local_master', { path: '/' });
                res.cookies.set('msj-role', 'superadmin', { path: '/' });
                res.cookies.set('msj-role-sig', sig, { path: '/' });
                return res;
            }

            // Real worker check by PIN (findFirst — pin ya no es @unique por migración a pinHash)
            const rawPin = String(pin).trim();
            // Busca por pinHash (bcrypt) primero, fallback a pin legacy
            const workers = await prisma.user.findMany({
                where: { active: true },
                select: { id: true, role: true, active: true, pin: true, pinHash: true },
            });
            let matchedWorker = null;
            for (const w of workers) {
                if (w.pinHash) {
                    const { compare } = await import('bcryptjs');
                    if (await compare(rawPin, w.pinHash)) { matchedWorker = w; break; }
                } else if (w.pin && w.pin === rawPin) {
                    matchedWorker = w; break;
                }
            }
            if (matchedWorker && matchedWorker.active) {
                const sig = signRole(matchedWorker.role, matchedWorker.id);
                const res = NextResponse.json({ success: true, customer: { role: matchedWorker.role }, redirect: '/dashboard' });
                res.cookies.set('msj-session', matchedWorker.id, { path: '/' });
                res.cookies.set('msj-role', matchedWorker.role, { path: '/' });
                res.cookies.set('msj-role-sig', sig, { path: '/' });
                return res;
            }

            return NextResponse.json({ error: 'PIN de acceso denegado.' }, { status: 401 });
        }
        // ------------------------------------------------------

        // Login de Clientes Normal
        const customer = await prisma.customer.findUnique({ where: { phone } });
        if (!customer) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        if (customer.pin !== pin) {
            return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 });
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

        const isHttps = req.url.startsWith('https://') || req.headers.get('x-forwarded-proto') === 'https';
        const cookieOpts = {
            httpOnly: true,
            secure: isHttps,
            sameSite: 'lax' as const,
            path: '/',
            maxAge: 30 * 24 * 60 * 60
        };
        const res = NextResponse.json({ success: true, customer });
        res.cookies.set('admincom_session', token, cookieOpts);
        res.cookies.set('msj-session', token, cookieOpts);
        
        return res;
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
