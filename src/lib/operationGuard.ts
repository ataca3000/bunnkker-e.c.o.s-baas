export type OperationHoldStatus = 'ACTIVE' | 'ON_HOLD';

export interface PickingDraft {
    orderId: string;
    mode: 'picking' | 'deconstruction';
    checkedItems: Record<string, boolean>;
    currentItemIndex: number;
    holdStatus: OperationHoldStatus;
    holdReason?: string;
    operatorUid?: string;
    operatorName?: string;
    heldAt?: string;
    updatedAt: string;
}

export interface MultiPickingDraft {
    batchKey: string;
    orderIds: string[];
    viewMode: 'by_order' | 'by_shelf';
    selectedOrderIndex: number;
    checkedItems: Record<string, boolean>;
    completedOrderIds: Record<string, boolean>;
    holdStatus: OperationHoldStatus;
    holdReason?: string;
    heldAt?: string;
    updatedAt: string;
}

export interface PosHeldCart {
    id: string;
    label: string;
    items: Array<Record<string, any>>;
    orderType: 'local' | 'delivery';
    deliveryInfo?: Record<string, any>;
    reason?: string;
    operatorUid?: string;
    operatorName?: string;
    heldAt: string;
    itemCount: number;
    total: number;
}

export const PICKING_DRAFT_PREFIX = '_bunkker_picking_draft_';
export const MULTI_PICKING_DRAFT_PREFIX = '_bunkker_multi_picking_draft_';
export const POS_HELD_CARTS_KEY = '_bunkker_pos_held_carts_v1';
export const OPERATION_HOLD_UPDATED_EVENT = 'bunkker:operation-hold-updated';

const DEFAULT_STALE_DRAFT_MS = 24 * 60 * 60 * 1000;

function getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function notifyHoldUpdated() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(OPERATION_HOLD_UPDATED_EVENT));
    }
}

export function getPickingDraftKey(orderId: string, mode: 'picking' | 'deconstruction' = 'picking'): string {
    return `${PICKING_DRAFT_PREFIX}${mode}__${orderId}`;
}

export function normalizeBatchKey(orderIds: string[]): string {
    return [...orderIds].filter(Boolean).sort().join('|');
}

export function getMultiPickingDraftKey(orderIds: string[]): string {
    return `${MULTI_PICKING_DRAFT_PREFIX}${normalizeBatchKey(orderIds)}`;
}

export function hasStartedPickingProgress(checkedItems: Record<string, boolean> | undefined | null): boolean {
    if (!checkedItems) return false;
    return Object.values(checkedItems).some(Boolean);
}

export function countCheckedItems(checkedItems: Record<string, boolean> | undefined | null): number {
    if (!checkedItems) return 0;
    return Object.values(checkedItems).filter(Boolean).length;
}

export function savePickingDraft(draft: Omit<PickingDraft, 'updatedAt'> & { updatedAt?: string }): PickingDraft {
    const payload: PickingDraft = {
        ...draft,
        updatedAt: draft.updatedAt || new Date().toISOString(),
    };
    const storage = getStorage();
    if (storage && payload.orderId) {
        try {
            storage.setItem(getPickingDraftKey(payload.orderId, payload.mode), JSON.stringify(payload));
            notifyHoldUpdated();
        } catch {}
    }
    return payload;
}

export function loadPickingDraft(
    orderId: string,
    mode: 'picking' | 'deconstruction' = 'picking'
): PickingDraft | null {
    const storage = getStorage();
    if (!storage || !orderId) return null;
    try {
        const raw = storage.getItem(getPickingDraftKey(orderId, mode));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PickingDraft;
        if (!parsed || parsed.orderId !== orderId) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function clearPickingDraft(orderId: string, mode: 'picking' | 'deconstruction' = 'picking'): void {
    const storage = getStorage();
    if (!storage || !orderId) return;
    try {
        storage.removeItem(getPickingDraftKey(orderId, mode));
        notifyHoldUpdated();
    } catch {}
}

export function putPickingOperationOnHold(params: {
    orderId: string;
    mode: 'picking' | 'deconstruction';
    checkedItems: Record<string, boolean>;
    currentItemIndex: number;
    holdReason?: string;
    operatorUid?: string;
    operatorName?: string;
}): PickingDraft {
    const now = new Date().toISOString();
    return savePickingDraft({
        orderId: params.orderId,
        mode: params.mode,
        checkedItems: { ...params.checkedItems },
        currentItemIndex: params.currentItemIndex,
        holdStatus: 'ON_HOLD',
        holdReason: params.holdReason || 'En espera por atención en estación',
        operatorUid: params.operatorUid,
        operatorName: params.operatorName,
        heldAt: now,
        updatedAt: now,
    });
}

export function listHeldPickingDrafts(): PickingDraft[] {
    const storage = getStorage();
    if (!storage) return [];
    const results: PickingDraft[] = [];
    try {
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (!key || !key.startsWith(PICKING_DRAFT_PREFIX)) continue;
            const raw = storage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw) as PickingDraft;
            if (parsed && parsed.holdStatus === 'ON_HOLD') {
                results.push(parsed);
            }
        }
    } catch {}
    return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function saveMultiPickingDraft(
    draft: Omit<MultiPickingDraft, 'batchKey' | 'updatedAt'> & { updatedAt?: string }
): MultiPickingDraft {
    const batchKey = normalizeBatchKey(draft.orderIds);
    const payload: MultiPickingDraft = {
        ...draft,
        batchKey,
        updatedAt: draft.updatedAt || new Date().toISOString(),
    };
    const storage = getStorage();
    if (storage && batchKey) {
        try {
            storage.setItem(getMultiPickingDraftKey(draft.orderIds), JSON.stringify(payload));
            notifyHoldUpdated();
        } catch {}
    }
    return payload;
}

export function loadMultiPickingDraft(orderIds: string[]): MultiPickingDraft | null {
    const storage = getStorage();
    const batchKey = normalizeBatchKey(orderIds);
    if (!storage || !batchKey) return null;
    try {
        const raw = storage.getItem(getMultiPickingDraftKey(orderIds));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as MultiPickingDraft;
        if (!parsed || parsed.batchKey !== batchKey) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function clearMultiPickingDraft(orderIds: string[]): void {
    const storage = getStorage();
    const batchKey = normalizeBatchKey(orderIds);
    if (!storage || !batchKey) return;
    try {
        storage.removeItem(getMultiPickingDraftKey(orderIds));
        notifyHoldUpdated();
    } catch {}
}

export function listHeldPosCarts(): PosHeldCart[] {
    const storage = getStorage();
    if (!storage) return [];
    try {
        const raw = storage.getItem(POS_HELD_CARTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function putPosCartOnHold(input: {
    items: Array<Record<string, any>>;
    orderType: 'local' | 'delivery';
    deliveryInfo?: Record<string, any>;
    reason?: string;
    label?: string;
    operatorUid?: string;
    operatorName?: string;
}): PosHeldCart | null {
    if (!Array.isArray(input.items) || input.items.length === 0) return null;
    const itemCount = input.items.reduce((acc, it) => acc + Math.max(1, Number(it.quantity || 1)), 0);
    const total = input.items.reduce(
        (acc, it) => acc + Number(it.price || 0) * Math.max(1, Number(it.quantity || 1)),
        0
    );
    const id = `HOLD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const entry: PosHeldCart = {
        id,
        label:
            input.label?.trim() ||
            (input.deliveryInfo?.customerName ? `Cliente: ${input.deliveryInfo.customerName}` : `Ticket en Espera #${id.slice(-4)}`),
        items: input.items,
        orderType: input.orderType,
        deliveryInfo: input.deliveryInfo,
        reason: input.reason || 'En espera en mostrador',
        operatorUid: input.operatorUid,
        operatorName: input.operatorName,
        heldAt: new Date().toISOString(),
        itemCount,
        total,
    };

    const storage = getStorage();
    if (storage) {
        try {
            const current = listHeldPosCarts();
            const next = [entry, ...current].slice(0, 12);
            storage.setItem(POS_HELD_CARTS_KEY, JSON.stringify(next));
            notifyHoldUpdated();
        } catch {}
    }
    return entry;
}

export function takeHeldPosCart(holdId: string): PosHeldCart | null {
    const storage = getStorage();
    if (!storage) return null;
    const current = listHeldPosCarts();
    const target = current.find((c) => c.id === holdId) || null;
    if (!target) return null;
    try {
        const next = current.filter((c) => c.id !== holdId);
        storage.setItem(POS_HELD_CARTS_KEY, JSON.stringify(next));
        notifyHoldUpdated();
    } catch {}
    return target;
}

export function discardHeldPosCart(holdId: string): boolean {
    const storage = getStorage();
    if (!storage) return false;
    const current = listHeldPosCarts();
    const next = current.filter((c) => c.id !== holdId);
    if (next.length === current.length) return false;
    try {
        storage.setItem(POS_HELD_CARTS_KEY, JSON.stringify(next));
        notifyHoldUpdated();
        return true;
    } catch {
        return false;
    }
}

export function pruneStaleOperationDrafts(maxAgeMs = DEFAULT_STALE_DRAFT_MS): number {
    const storage = getStorage();
    if (!storage) return 0;
    const cutoff = Date.now() - Math.max(60_000, maxAgeMs);
    let purged = 0;

    try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (!key) continue;
            if (!key.startsWith(PICKING_DRAFT_PREFIX) && !key.startsWith(MULTI_PICKING_DRAFT_PREFIX)) {
                continue;
            }
            const raw = storage.getItem(key);
            if (!raw) continue;
            try {
                const parsed = JSON.parse(raw);
                const updatedMs = new Date(parsed?.updatedAt || parsed?.heldAt || 0).getTime();
                // Mantener borradores explícitos ON_HOLD recientes o activos dentro de 24h; purgar expirados
                if (!Number.isFinite(updatedMs) || updatedMs < cutoff) {
                    keysToRemove.push(key);
                }
            } catch {
                keysToRemove.push(key);
            }
        }
        for (const k of keysToRemove) {
            storage.removeItem(k);
            purged++;
        }
        if (purged > 0) notifyHoldUpdated();
    } catch {}

    return purged;
}
