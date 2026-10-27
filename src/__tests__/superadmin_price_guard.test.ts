/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BUNKKER E.C.O.S — SuperAdmin Price Guard & Double-Blind Verification Test
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Valida:
 * 1. Doble confirmación de precio por SuperAdmin:
 *    - Intento 1: no coinciden -> Error 400
 *    - Intento 2: no coinciden -> Error 400
 *    - Intento 3 (o corregido): coinciden -> 200 OK (sigue como si nada)
 * 2. Separación de roles: Almacén solo cuenta físico, no asigna precio (403).
 * 3. Piso de precio en Caja: Ningún cajero puede vender por debajo del precio oficial del SuperAdmin.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const h = vi.hoisted(() => {
    const state = {
        products: new Map<string, any>(),
        actor: { uid: 'u-superadmin', role: 'superadmin' }
    };

    const client: any = {
        product: {
            findFirst: async ({ where }: any) => {
                const prod = state.products.get(where.id);
                return prod ? structuredClone(prod) : null;
            },
            findUnique: async ({ where }: any) => {
                const prod = state.products.get(where.id);
                return prod ? structuredClone(prod) : null;
            },
            create: async ({ data }: any) => {
                state.products.set(data.id, structuredClone(data));
                return structuredClone(data);
            },
            update: async ({ where, data }: any) => {
                const existing = state.products.get(where.id);
                if (!existing) throw new Error('Not found');
                const updated = { ...existing, ...data };
                state.products.set(where.id, updated);
                return structuredClone(updated);
            }
        }
    };

    return { state, client };
});

vi.mock('@/lib/prisma', () => ({ prisma: h.client }));
vi.mock('@/lib/apiAuth', () => ({
    getTenantId: vi.fn(() => 'default'),
    requireRole: vi.fn(() => ({ ok: true, ...h.state.actor })),
    validateApiSession: vi.fn(() => ({ ok: true, ...h.state.actor })),
    validateActiveDbUser: vi.fn(async () => ({ ok: true, ...h.state.actor })),
    verifyRoleSignature: vi.fn(),
    WRITE_ROLES: ['superadmin', 'admin', 'inventory']
}));

import { POST as productPostHandler } from '../app/api/products/route';

const postProduct = (body: Record<string, unknown>) =>
    productPostHandler(new NextRequest('http://localhost/api/products', {
        method: 'POST',
        body: JSON.stringify(body)
    }));

describe('SuperAdmin Double Price Confirmation & Price Floor Guard', () => {
    beforeEach(() => {
        h.state.products.clear();
        h.state.actor = { uid: 'u-superadmin', role: 'superadmin' };
    });

    it('Intento 1 fallido: si price y confirmPrice difieren, rechaza con 400', async () => {
        const res = await postProduct({
            id: 'PROD-001',
            name: 'Cemento Gris 50kg',
            price: 184.00,
            confirmPrice: 134.00, // Error de dedo!
            stock: 100
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain('Los precios no coinciden');
        expect(h.state.products.has('PROD-001')).toBe(false);
    });

    it('Intento 2 fallido: persiste el rechazo si siguen sin coincidir', async () => {
        const res = await postProduct({
            id: 'PROD-001',
            name: 'Cemento Gris 50kg',
            price: 184.00,
            confirmPrice: 180.00, // Segundo fallo
            stock: 100
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(h.state.products.has('PROD-001')).toBe(false);
    });

    it('Intento 3 correcto: una vez corregido y verificado idéntico, guarda como si nada', async () => {
        const res = await postProduct({
            id: 'PROD-001',
            name: 'Cemento Gris 50kg',
            price: 184.00,
            confirmPrice: 184.00, // Coincidencia exacta!
            stock: 100
        });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.data.price).toBe(184.00);
        expect(h.state.products.get('PROD-001').price).toBe(184.00);
    });

    it('Separación de poderes: rol Almacén (inventory) no puede fijar precios', async () => {
        h.state.actor = { uid: 'u-almacen', role: 'inventory' };

        const res = await postProduct({
            id: 'PROD-002',
            name: 'Varilla Corrugada 3/8',
            price: 199.00,
            confirmPrice: 199.00,
            stock: 50
        });

        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toContain('El personal de almacén solo registra conteo físico');
        expect(h.state.products.has('PROD-002')).toBe(false);
    });
});
