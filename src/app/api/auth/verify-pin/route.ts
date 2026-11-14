import { NextRequest, NextResponse } from 'next/server';
import { validateActiveDbUser, getTenantId } from '@/lib/apiAuth';
import { verifyStaffPin } from '@/lib/staffPinVerify';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 180;

export async function POST(request: NextRequest) {
    const auth = await validateActiveDbUser(request);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json().catch(() => ({}));
        const pin = String(body.pin || '').trim();
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 240) : undefined;
        const operation = typeof body.operation === 'string' ? body.operation.trim().slice(0, 80) : 'OPERACION_PROTEGIDA';
        const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : undefined;

        const tenantId = auth.tenantId || getTenantId(request);
        const forwardedFor = request.headers.get('x-forwarded-for');
        const clientIp = (forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip')) || '127.0.0.1';
        const limitKey = `verify_pin_attempts:${clientIp}:${auth.uid}`;

        if (process.env.NODE_ENV !== 'test') {
            const currentAttempts = parseInt((await redis.get(limitKey)) || '0', 10);
            if (currentAttempts >= MAX_ATTEMPTS) {
                const ttl = await redis.ttl(limitKey);
                const secs = Math.max(10, ttl || LOCKOUT_SECONDS);
                return NextResponse.json(
                    {
                        success: false,
                        error: `Demasiados intentos fallidos de NIP. Espera ${Math.ceil(secs / 60)} min antes de volver a intentar.`,
                    },
                    { status: 429 }
                );
            }
        }

        const result = await verifyStaffPin({
            pin,
            tenantId,
            activeUserId: auth.uid,
            prismaInstance: prisma,
        });

        if (!result.ok) {
            if (process.env.NODE_ENV !== 'test') {
                const nextCount = await redis.incr(limitKey);
                if (nextCount === 1) {
                    await redis.expire(limitKey, LOCKOUT_SECONDS);
                }
            }
            return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }

        await redis.del(limitKey);

        try {
            await prisma.auditLog.create({
                data: {
                    tenantId,
                    action: 'PIN_AUTHORIZATION_VERIFIED',
                    details: JSON.stringify({
                        operation,
                        orderId: orderId || null,
                        reason: reason || null,
                        requestedBy: auth.uid,
                        verifiedBy: result.verifiedBy,
                    }),
                    userId: result.verifiedBy.uid,
                },
            });
        } catch {}

        return NextResponse.json({
            success: true,
            verifiedBy: result.verifiedBy,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Error al verificar NIP de autorización.' },
            { status: 500 }
        );
    }
}
