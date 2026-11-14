import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import {
    savePickingDraft,
    loadPickingDraft,
    putPickingOperationOnHold,
    listHeldPickingDrafts,
    clearPickingDraft,
    saveMultiPickingDraft,
    loadMultiPickingDraft,
    clearMultiPickingDraft,
    putPosCartOnHold,
    listHeldPosCarts,
    takeHeldPosCart,
    discardHeldPosCart,
    pruneStaleOperationDrafts,
    hasStartedPickingProgress,
    countCheckedItems,
    PICKING_DRAFT_PREFIX,
} from '@/lib/operationGuard';
import { isValidStaffPinFormat, verifyStaffPin } from '@/lib/staffPinVerify';
import { hashPinSha256 } from '@/lib/apiAuth';

function createMockStorage(): Storage {
    const store = new Map<string, string>();
    return {
        get length() {
            return store.size;
        },
        clear() {
            store.clear();
        },
        getItem(key: string) {
            return store.has(key) ? store.get(key)! : null;
        },
        key(index: number) {
            return Array.from(store.keys())[index] ?? null;
        },
        removeItem(key: string) {
            store.delete(key);
        },
        setItem(key: string, value: string) {
            store.set(key, String(value));
        },
    };
}

describe('operationGuard — anti-abandonment & hold storage', () => {
    beforeEach(() => {
        const storage = createMockStorage();
        const dispatchEvent = vi.fn();
        (globalThis as any).window = {
            localStorage: storage,
            dispatchEvent,
        };
        if (typeof (globalThis as any).CustomEvent === 'undefined') {
            (globalThis as any).CustomEvent = class CustomEvent {
                type: string;
                constructor(type: string) {
                    this.type = type;
                }
            };
        }
    });

    it('saves, holds, lists and clears picking drafts cleanly', () => {
        expect(hasStartedPickingProgress({})).toBe(false);
        expect(countCheckedItems({ a: true, b: false, c: true })).toBe(2);

        savePickingDraft({
            orderId: 'ORD-001',
            mode: 'picking',
            checkedItems: { '0-P1': true },
            currentItemIndex: 1,
            holdStatus: 'ACTIVE',
        });

        const loaded = loadPickingDraft('ORD-001', 'picking');
        expect(loaded).not.toBeNull();
        expect(loaded?.checkedItems['0-P1']).toBe(true);
        expect(loaded?.holdStatus).toBe('ACTIVE');

        putPickingOperationOnHold({
            orderId: 'ORD-001',
            mode: 'picking',
            checkedItems: { '0-P1': true, '1-P2': true },
            currentItemIndex: 2,
            holdReason: 'Espera en pasillo B',
            operatorUid: 'user-1',
            operatorName: 'Carlos',
        });

        const heldList = listHeldPickingDrafts();
        expect(heldList).toHaveLength(1);
        expect(heldList[0].holdStatus).toBe('ON_HOLD');
        expect(heldList[0].operatorName).toBe('Carlos');

        clearPickingDraft('ORD-001', 'picking');
        expect(loadPickingDraft('ORD-001', 'picking')).toBeNull();
        expect(listHeldPickingDrafts()).toHaveLength(0);
    });

    it('persists and clears multi-picking batch drafts regardless of orderId order', () => {
        saveMultiPickingDraft({
            orderIds: ['ORD-B', 'ORD-A'],
            viewMode: 'by_shelf',
            selectedOrderIndex: 1,
            checkedItems: { 'ORD-A::0': true },
            completedOrderIds: { 'ORD-A': true },
            holdStatus: 'ON_HOLD',
        });

        const restored = loadMultiPickingDraft(['ORD-A', 'ORD-B']);
        expect(restored).not.toBeNull();
        expect(restored?.viewMode).toBe('by_shelf');
        expect(restored?.completedOrderIds['ORD-A']).toBe(true);

        clearMultiPickingDraft(['ORD-B', 'ORD-A']);
        expect(loadMultiPickingDraft(['ORD-A', 'ORD-B'])).toBeNull();
    });

    it('puts POS carts on hold, restores with takeHeldPosCart and discards cleanly', () => {
        const held = putPosCartOnHold({
            items: [
                { id: 'P1', name: 'Tubo PVC', price: 120, quantity: 2 },
                { id: 'P2', name: 'Codo 90', price: 15, quantity: 4 },
            ],
            orderType: 'local',
            reason: 'Cliente busca otro artículo',
            operatorUid: 'cashier-1',
            operatorName: 'Ana',
        });

        expect(held).not.toBeNull();
        expect(held?.itemCount).toBe(6);
        expect(held?.total).toBe(300);
        expect(listHeldPosCarts()).toHaveLength(1);

        const second = putPosCartOnHold({
            items: [{ id: 'P3', name: 'Llave', price: 80, quantity: 1 }],
            orderType: 'delivery',
            deliveryInfo: { customerName: 'Luis' },
        });
        expect(listHeldPosCarts()).toHaveLength(2);

        const restored = takeHeldPosCart(held!.id);
        expect(restored?.id).toBe(held!.id);
        expect(listHeldPosCarts()).toHaveLength(1);

        expect(discardHeldPosCart(second!.id)).toBe(true);
        expect(listHeldPosCarts()).toHaveLength(0);
    });

    it('prunes stale drafts older than maxAgeMs while keeping fresh drafts', () => {
        const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        (globalThis as any).window.localStorage.setItem(
            `${PICKING_DRAFT_PREFIX}picking__STALE`,
            JSON.stringify({
                orderId: 'STALE',
                mode: 'picking',
                checkedItems: {},
                currentItemIndex: 0,
                holdStatus: 'ACTIVE',
                updatedAt: oldDate,
            })
        );

        savePickingDraft({
            orderId: 'FRESH',
            mode: 'picking',
            checkedItems: { '0-X': true },
            currentItemIndex: 0,
            holdStatus: 'ON_HOLD',
        });

        const purged = pruneStaleOperationDrafts(24 * 60 * 60 * 1000);
        expect(purged).toBe(1);
        expect(loadPickingDraft('STALE', 'picking')).toBeNull();
        expect(loadPickingDraft('FRESH', 'picking')).not.toBeNull();
    });
});

describe('staffPinVerify — real database NIP validation', () => {
    it('validates 4-6 alphanumeric NIP format strictly', () => {
        expect(isValidStaffPinFormat('1234')).toBe(true);
        expect(isValidStaffPinFormat('A1234')).toBe(true);
        expect(isValidStaffPinFormat('AB1234')).toBe(true);
        expect(isValidStaffPinFormat('123')).toBe(false);
        expect(isValidStaffPinFormat('1234567')).toBe(false);
        expect(isValidStaffPinFormat('12-34')).toBe(false);
        expect(isValidStaffPinFormat('')).toBe(false);
    });

    it('rejects malformed PIN before hitting database', async () => {
        const result = await verifyStaffPin({ pin: '12', activeUserId: 'u1' });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.status).toBe(400);
        }
    });

    it('accepts active operator bcrypt pinHash with isSupervisorOverride=false', async () => {
        const opHash = await bcrypt.hash('4821', 6);
        const mockPrisma = {
            user: {
                findUnique: vi.fn().mockResolvedValue({
                    id: 'op-1',
                    name: 'Juan Operador',
                    role: 'inventory',
                    active: true,
                    tenantId: 't1',
                    pin: null,
                    pinHash: opHash,
                }),
                findMany: vi.fn().mockResolvedValue([]),
                findFirst: vi.fn().mockResolvedValue(null),
            },
        };

        const res = await verifyStaffPin({
            pin: '4821',
            tenantId: 't1',
            activeUserId: 'op-1',
            prismaInstance: mockPrisma,
        });

        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.verifiedBy.uid).toBe('op-1');
            expect(res.verifiedBy.isSupervisorOverride).toBe(false);
        }
    });

    it('allows admin/superadmin NIP override and rejects hardcoded 123456 fallback', async () => {
        const opHash = await bcrypt.hash('4821', 6);
        const adminPinSha = hashPinSha256('A9988');

        const mockPrisma = {
            user: {
                findUnique: vi.fn().mockResolvedValue({
                    id: 'op-1',
                    name: 'Juan Operador',
                    role: 'inventory',
                    active: true,
                    tenantId: 't1',
                    pin: null,
                    pinHash: opHash,
                }),
                findMany: vi.fn().mockResolvedValue([
                    {
                        id: 'sup-1',
                        name: 'Laura Supervisor',
                        role: 'admin',
                        active: true,
                        tenantId: 't1',
                        pin: adminPinSha,
                        pinHash: null,
                    },
                ]),
                findFirst: vi.fn().mockResolvedValue(null),
            },
        };

        // Hardcoded 123456 must fail
        const badRes = await verifyStaffPin({
            pin: '123456',
            tenantId: 't1',
            activeUserId: 'op-1',
            prismaInstance: mockPrisma,
        });
        expect(badRes.ok).toBe(false);
        if (!badRes.ok) {
            expect(badRes.status).toBe(401);
        }

        // Valid admin override NIP must succeed
        const supRes = await verifyStaffPin({
            pin: 'A9988',
            tenantId: 't1',
            activeUserId: 'op-1',
            prismaInstance: mockPrisma,
        });
        expect(supRes.ok).toBe(true);
        if (supRes.ok) {
            expect(supRes.verifiedBy.uid).toBe('sup-1');
            expect(supRes.verifiedBy.role).toBe('admin');
            expect(supRes.verifiedBy.isSupervisorOverride).toBe(true);
        }
    });
});
