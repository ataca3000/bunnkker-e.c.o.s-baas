/**
 * Atomicidad claim + OrderEvent en PATCH /api/orders (Invariante: historial append-only).
 *
 * Ejercita el handler REAL contra una BD en memoria cuyo $transaction revierte el
 * estado si el callback lanza. Si el claim y el evento no estuvieran en la misma
 * transacción, el caso "fallo al escribir el evento" dejaría el pedido tomado sin historial.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => {
    const state = {
        orders: new Map<string, any>(),
        events: [] as any[],
        failEventWrite: false,
        actor: { uid: 'u-ana', role: 'inventory' },
    };

    const matches = (row: any, where: any) =>
        Object.entries(where).every(([k, v]) => (row[k] ?? null) === v);

    const client: any = {
        user: { findUnique: async () => ({ name: 'Ana' }) },
        order: {
            findUnique: async ({ where }: any) => {
                const row = state.orders.get(where.id);
                return row ? structuredClone(row) : null;
            },
            updateMany: async ({ where, data }: any) => {
                const row = state.orders.get(where.id);
                if (!row || !matches(row, where)) return { count: 0 };
                Object.assign(row, data);
                return { count: 1 };
            },
        },
        orderEvent: {
            create: async ({ data }: any) => {
                if (state.failEventWrite) throw new Error('SIMULATED_DISK_IO_ERROR');
                state.events.push(data);
                return data;
            },
        },
    };

    client.$transaction = async (fn: (tx: any) => Promise<any>) => {
        const snapshot = {
            orders: structuredClone([...state.orders.entries()]),
            events: structuredClone(state.events),
        };
        try {
            return await fn(client);
        } catch (err) {
            state.orders = new Map(snapshot.orders);
            state.events = snapshot.events;
            throw err;
        }
    };

    return { state, client };
});

vi.mock('@/lib/prisma', () => ({ prisma: h.client }));
vi.mock('@/lib/apiAuth', () => ({
    validateActiveDbUser: vi.fn(async () => ({ ok: true, ...h.state.actor })),
    validateApiSession: vi.fn(),
    verifyRoleSignature: vi.fn(),
}));
vi.mock('@/lib/salesCounter', () => ({
    getSalesTrialStatus: vi.fn(() => ({ isLocked: false })),
    recordPersistentSale: vi.fn(() => ({})),
}));

import { PATCH } from '../app/api/orders/route';

const patch = (body: Record<string, unknown>) =>
    PATCH(new NextRequest('http://localhost/api/orders', { method: 'PATCH', body: JSON.stringify(body) }));

const seedOrder = (overrides: Record<string, unknown> = {}) => {
    h.state.orders.set('o-1', {
        id: 'o-1', status: 'pending', deliveryType: 'PICKUP', isLoaded: false,
        loadedBy: null, loadedByUid: null, confirmedAt: null, assignedDriverId: null,
        ...overrides,
    });
};

beforeEach(() => {
    h.state.orders = new Map();
    h.state.events = [];
    h.state.failEventWrite = false;
    h.state.actor = { uid: 'u-ana', role: 'inventory' };
});

describe('claim_loading — claim y evento atómicos', () => {
    it('camino feliz: toma el pedido y registra exactamente un LOADING_CLAIMED', async () => {
        seedOrder();
        const res = await patch({ id: 'o-1', action: 'claim_loading' });

        expect(res.status).toBe(200);
        expect(h.state.orders.get('o-1')).toMatchObject({ loadedByUid: 'u-ana', status: 'PREPARANDO' });
        expect(h.state.events).toHaveLength(1);
        expect(h.state.events[0]).toMatchObject({ eventType: 'LOADING_CLAIMED', fromStatus: 'pending', toStatus: 'PREPARANDO' });
    });

    it('fallo al escribir el evento: revierte el claim (no queda pedido tomado sin historial)', async () => {
        seedOrder();
        h.state.failEventWrite = true;
        const res = await patch({ id: 'o-1', action: 'claim_loading' });

        expect(res.status).not.toBe(200);
        expect(h.state.orders.get('o-1')).toMatchObject({ loadedByUid: null, status: 'pending' });
        expect(h.state.events).toHaveLength(0);
    });

    it('entrada inválida: pedido inexistente → 404 sin eventos', async () => {
        const res = await patch({ id: 'no-existe', action: 'claim_loading' });
        expect(res.status).toBe(404);
        expect(h.state.events).toHaveLength(0);
    });

    it('conflicto: pedido tomado por otro operador → 409 sin eventos ni cambios', async () => {
        seedOrder({ loadedByUid: 'u-luis', loadedBy: 'Luis', status: 'PREPARANDO' });
        const res = await patch({ id: 'o-1', action: 'claim_loading' });

        expect(res.status).toBe(409);
        expect(h.state.orders.get('o-1').loadedByUid).toBe('u-luis');
        expect(h.state.events).toHaveLength(0);
    });

    it('idempotencia: reintento del mismo operador → alreadyClaimed y sigue habiendo un solo evento', async () => {
        seedOrder();
        await patch({ id: 'o-1', action: 'claim_loading' });
        const retry = await patch({ id: 'o-1', action: 'claim_loading' });
        const json = await retry.json();

        expect(retry.status).toBe(200);
        expect(json.alreadyClaimed).toBe(true);
        expect(h.state.events).toHaveLength(1);
    });
});

describe('complete_loading — cambio de estado y evento atómicos', () => {
    it('camino feliz: marca isLoaded y registra LOADING_COMPLETED con details serializado una vez', async () => {
        seedOrder({ loadedByUid: 'u-ana', loadedBy: 'Ana', status: 'PREPARANDO' });
        const res = await patch({ id: 'o-1', action: 'complete_loading', targetLocation: 'caja' });

        expect(res.status).toBe(200);
        expect(h.state.orders.get('o-1')).toMatchObject({ isLoaded: true, status: 'READY_FOR_PICKUP' });
        expect(h.state.events).toHaveLength(1);
        expect(JSON.parse(h.state.events[0].details)).toMatchObject({ targetLocation: 'caja', deliveryType: 'PICKUP' });
    });

    it('fallo al escribir el evento: revierte isLoaded y el estado', async () => {
        seedOrder({ loadedByUid: 'u-ana', loadedBy: 'Ana', status: 'PREPARANDO' });
        h.state.failEventWrite = true;
        const res = await patch({ id: 'o-1', action: 'complete_loading', targetLocation: 'caja' });

        expect(res.status).not.toBe(200);
        expect(h.state.orders.get('o-1')).toMatchObject({ isLoaded: false, status: 'PREPARANDO' });
        expect(h.state.events).toHaveLength(0);
    });

    it('idempotencia: completar dos veces → el segundo es 409 y no duplica el evento', async () => {
        seedOrder({ loadedByUid: 'u-ana', loadedBy: 'Ana', status: 'PREPARANDO' });
        await patch({ id: 'o-1', action: 'complete_loading', targetLocation: 'caja' });
        const retry = await patch({ id: 'o-1', action: 'complete_loading', targetLocation: 'caja' });

        expect(retry.status).toBe(409);
        expect(h.state.events).toHaveLength(1);
    });
});

describe('claim_delivery — toma de ruta y evento atómicos', () => {
    beforeEach(() => { h.state.actor = { uid: 'u-driver', role: 'driver' }; });

    it('camino feliz: asigna repartidor y registra DRIVER_CLAIMED', async () => {
        seedOrder({ status: 'OUT_FOR_DELIVERY', deliveryType: 'DELIVERY', isLoaded: true });
        const res = await patch({ id: 'o-1', action: 'claim_delivery' });

        expect(res.status).toBe(200);
        expect(h.state.orders.get('o-1')).toMatchObject({ status: 'claimed', assignedDriverId: 'u-driver' });
        expect(h.state.events.map((e) => e.eventType)).toEqual(['DRIVER_CLAIMED']);
    });

    it('fallo al escribir el evento: el pedido vuelve a estar libre para ruta', async () => {
        seedOrder({ status: 'OUT_FOR_DELIVERY', deliveryType: 'DELIVERY', isLoaded: true });
        h.state.failEventWrite = true;
        const res = await patch({ id: 'o-1', action: 'claim_delivery' });

        expect(res.status).not.toBe(200);
        expect(h.state.orders.get('o-1')).toMatchObject({ status: 'OUT_FOR_DELIVERY', assignedDriverId: null });
        expect(h.state.events).toHaveLength(0);
    });

    it('conflicto: ya tomado por otro repartidor → 409 sin eventos', async () => {
        seedOrder({ status: 'claimed', deliveryType: 'DELIVERY', isLoaded: true, assignedDriverId: 'u-otro' });
        const res = await patch({ id: 'o-1', action: 'claim_delivery' });

        expect(res.status).toBe(409);
        expect(h.state.events).toHaveLength(0);
    });
});
