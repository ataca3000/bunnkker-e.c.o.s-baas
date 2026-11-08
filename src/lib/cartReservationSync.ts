import type { CartItem } from '@/lib/types';

const RESERVATION_ID_KEY = 'bunkker_cart_reservation_id';
const CHANNEL_NAME = 'bunkker_tab_sync';

type ReservationResponse = {
    success: boolean;
    failedItems?: string[];
};

function getReservationId(): string | null {
    if (typeof window === 'undefined') return null;

    try {
        let id = window.sessionStorage.getItem(RESERVATION_ID_KEY);
        if (!id) {
            id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? crypto.randomUUID()
                : `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            window.sessionStorage.setItem(RESERVATION_ID_KEY, id);
        }
        return id;
    } catch {
        return null;
    }
}

function broadcastLocalChange(items: Array<{ id: string; qty: number }>) {
    if (typeof BroadcastChannel === 'undefined') return;

    try {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage({ type: 'CART_RESERVATION_CHANGED', items, timestamp: Date.now() });
        channel.close();
    } catch {
        // Socket.IO remains the cross-device synchronization path.
    }
}

/**
 * Publishes the complete cart snapshot as this browser tab's temporary stock hold.
 * The local Socket.IO bridge remains authoritative; checkout must still validate
 * stock transactionally because a browser-side hold is only advisory.
 */
export function syncCartReservation(cart: CartItem[]): void {
    if (typeof window === 'undefined') return;

    const items = Array.from(
        cart.reduce((totals, item) => {
            if (item.id && Number.isFinite(item.quantity) && item.quantity > 0) {
                totals.set(item.id, (totals.get(item.id) || 0) + item.quantity);
            }
            return totals;
        }, new Map<string, number>())
    ).map(([id, qty]) => ({ id, qty }));

    broadcastLocalChange(items);

    const socket = (window as Window & { __inventorySocket?: {
        connected?: boolean;
        emit: (event: string, payload: unknown, callback?: (response: ReservationResponse) => void) => void;
    } }).__inventorySocket;
    const reservationId = getReservationId();
    if (!socket?.connected || !reservationId) return;

    if (items.length === 0) {
        socket.emit('release_stock', reservationId);
        return;
    }

    socket.emit('reserve_stock', { reservationId, items }, (response) => {
        if (response?.success) return;
        console.warn('[Inventory] No se pudo apartar temporalmente el carrito:', response?.failedItems || []);
        window.dispatchEvent(new CustomEvent('bunkker_reservation_rejected', {
            detail: { failedItems: response?.failedItems || [] }
        }));
    });
}
