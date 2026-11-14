import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantId, validateApiSession } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

import {
    leasesByProduct,
    DEFAULT_LEASE_TTL_MS,
    purgeExpiredLeases,
    getActiveLeasesSnapshot,
    type LeaseEntry,
} from '@/lib/chunkLeases';

export type { LeaseEntry };

export async function GET() {
    const now = Date.now();
    const { floatingStock, activeLeases } = getActiveLeasesSnapshot(now);
    return NextResponse.json({
        success: true,
        serverTime: now,
        floatingStock,
        activeLeases,
    });
}

export async function POST(request: NextRequest) {
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        const tenantId = getTenantId(request);
        const body = await request.json();
        const action = String(body.action || 'lease');
        const sessionId = String(body.sessionId || 'POS-LOCAL');
        const ownerName = String(body.ownerName || 'Cajero / Vendedor');
        const ttlMs = Number(body.ttlMs) > 5000 ? Number(body.ttlMs) : DEFAULT_LEASE_TTL_MS;
        const now = Date.now();

        purgeExpiredLeases(now);

        if (action === 'release_session') {
            for (const [productId, sessionMap] of leasesByProduct.entries()) {
                sessionMap.delete(sessionId);
                if (sessionMap.size === 0) {
                    leasesByProduct.delete(productId);
                }
            }
            const snapshot = getActiveLeasesSnapshot(now);
            return NextResponse.json({
                success: true,
                ...snapshot,
            });
        }

        if (action === 'release_item') {
            const productId = String(body.productId || '');
            const targetSession = String(body.targetSessionId || sessionId);
            const sessionMap = leasesByProduct.get(productId);
            if (sessionMap) {
                sessionMap.delete(targetSession);
                if (sessionMap.size === 0) {
                    leasesByProduct.delete(productId);
                }
            }
            const snapshot = getActiveLeasesSnapshot(now);
            return NextResponse.json({
                success: true,
                ...snapshot,
            });
        }

        // Standard atomic RAM lease request for 1 product
        const productId = String(body.productId || '').trim();
        const requestedQty = Math.max(0, Number(body.qty || 0));

        if (!productId) {
            return NextResponse.json({ success: false, error: 'productId requerido' }, { status: 400 });
        }

        // Read product physical & reserved stock once, then perform synchronous RAM mutex lock
        const product = await prisma.product.findFirst({
            where: { id: productId, tenantId },
            select: {
                id: true,
                name: true,
                stock: true,
                reservedStock: true,
                estante: true,
                fila: true,
            },
        });

        if (!product) {
            return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 });
        }

        // --- SYNCHRONOUS ATOMIC SECTION IN RAM (0ms race-free) ---
        purgeExpiredLeases(Date.now());
        let sessionMap = leasesByProduct.get(productId);
        if (!sessionMap) {
            sessionMap = new Map();
            leasesByProduct.set(productId, sessionMap);
        }

        if (requestedQty <= 0) {
            sessionMap.delete(sessionId);
            if (sessionMap.size === 0) {
                leasesByProduct.delete(productId);
            }
            const snapshot = getActiveLeasesSnapshot(Date.now());
            return NextResponse.json({
                success: true,
                grantedQty: 0,
                availableForOthers: Math.max(0, (product.stock || 0) - (product.reservedStock || 0) - (snapshot.floatingStock[productId] || 0)),
                ...snapshot,
            });
        }

        let leasedByOthers = 0;
        for (const [otherSessionId, entry] of sessionMap.entries()) {
            if (otherSessionId !== sessionId) {
                leasedByOthers += entry.qty;
            }
        }

        const physicalAvailable = Math.max(0, (product.stock || 0) - (product.reservedStock || 0));
        const maxPossibleForThisSession = Math.max(0, physicalAvailable - leasedByOthers);

        if (requestedQty > maxPossibleForThisSession) {
            const snapshot = getActiveLeasesSnapshot(Date.now());
            return NextResponse.json(
                {
                    success: false,
                    error: `Concurrencia bloqueada en Chunk [${product.estante || 'GENERAL'}]: Solo quedan ${maxPossibleForThisSession} unidades libres (${leasedByOthers} en otros carritos, ${product.reservedStock || 0} en Patio).`,
                    maxAllowed: maxPossibleForThisSession,
                    ...snapshot,
                },
                { status: 409 }
            );
        }

        const leaseEntry: LeaseEntry = {
            sessionId,
            ownerName,
            productId,
            chunkId: (product.estante || 'GENERAL').toUpperCase().trim(),
            layerId: (product.fila || 'GENERAL').toUpperCase().trim(),
            qty: requestedQty,
            reservedAt: Date.now(),
            expiresAt: Date.now() + ttlMs,
        };

        sessionMap.set(sessionId, leaseEntry);
        const snapshot = getActiveLeasesSnapshot(Date.now());

        return NextResponse.json({
            success: true,
            grantedQty: requestedQty,
            lease: leaseEntry,
            ...snapshot,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Error en motor de Chunks' },
            { status: 500 }
        );
    }
}
