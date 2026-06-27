import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';
import { adminDb } from '@/lib/firebase-admin';

// ── Helper: generate license key ADMIN-XXXX-XXXX-XXXX ─────────────────────
function generateKey(): string {
    const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ADMIN-${seg()}-${seg()}-${seg()}`;
}

// ── POST /api/licenses — Create a new license ──────────────────────────────
export async function POST(req: NextRequest) {
    const auth = validateApiSession(req);
    if (!auth.ok) return auth.response;
    try {
        const { clientName, email, maxMachines = 1, expiresAt = null, devSecret } = await req.json();

        if (devSecret !== process.env.DEV_SECRET) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        if (!clientName || !email) {
            return NextResponse.json({ error: 'clientName y email son requeridos' }, { status: 400 });
        }

        const key = generateKey();

        await adminDb.collection('licenses').doc(key).set({
            key,
            clientName,
            email,
            maxMachines,
            machineIds: [],
            isActive: true,
            createdAt: Date.now(),
            expiresAt,   // null = licencia permanente
        });

        return NextResponse.json({ success: true, key, clientName });
    } catch (err) {
        console.error('[API/licenses POST]', err);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// ── GET /api/licenses — List all licenses ─────────────────────────────────
export async function GET(req: NextRequest) {
    const devSecret = req.nextUrl.searchParams.get('secret');
    if (devSecret !== process.env.DEV_SECRET) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const snap = await adminDb.collection('licenses').orderBy('createdAt', 'desc').get();
        const licenses = snap.docs.map((d: any) => d.data());
        return NextResponse.json({ licenses });
    } catch (err) {
        console.error('[API/licenses GET]', err);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// ── PATCH /api/licenses — Activate / Deactivate ────────────────────────────
export async function PATCH(req: NextRequest) {
    try {
        const { key, isActive, devSecret, resetMachines } = await req.json();

        if (devSecret !== process.env.DEV_SECRET) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }
        if (!key) {
            return NextResponse.json({ error: 'key requerida' }, { status: 400 });
        }

        const update: Record<string, unknown> = {};
        if (typeof isActive === 'boolean') update.isActive = isActive;
        if (resetMachines) update.machineIds = [];

        await adminDb.collection('licenses').doc(key).update(update);
        return NextResponse.json({ success: true, key, ...update });
    } catch (err) {
        console.error('[API/licenses PATCH]', err);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
