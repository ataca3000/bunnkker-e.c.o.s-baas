import type { StateCreator } from 'zustand';
import type { ERPState, CartSlice } from './types';

const RESERVATION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Transmite actualización de reserva 0/1 entre pestañas/cajas a 0ms
 */
function broadcastReservationChange(productId: string, action: 'RESERVE' | 'RELEASE', quantity: number) {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const bc = new BroadcastChannel('bunkker_tab_sync');
            bc.postMessage({
                type: 'POS_MUTEX_CHANGE',
                productId,
                action,
                quantity,
                timestamp: Date.now()
            });
            bc.close();
        } catch { }
    }
}

export const createCartSlice: StateCreator<
    ERPState,
    [['zustand/immer', never]],
    [],
    CartSlice
> = (set, get) => ({
    cart: [],
    isCartOpen: false,

    addToCart: (product, quantity = 1) =>
        set((state) => {
            const existing = state.cart.find((i: any) => i.id === product.id);
            const now = Date.now();
            if (existing) {
                if (existing.quantity + quantity > product.stock) return;
                existing.quantity += quantity;
                (existing as any).lastModified = now;
                (existing as any).reservedAt = now;
                (existing as any).mutexState = 1; // 1 = Reservado / In-flight (Mutex Multicaja)
            } else {
                state.cart.push({
                    ...product,
                    quantity,
                    lastModified: now,
                    reservedAt: now,
                    mutexState: 1 // 1 = Reservado / In-flight (Mutex Multicaja)
                } as any);
            }
            broadcastReservationChange(product.id, 'RESERVE', quantity);
        }),

    removeFromCart: (productId) =>
        set((state) => {
            const item = state.cart.find((i: any) => i.id === productId);
            if (item) {
                broadcastReservationChange(productId, 'RELEASE', item.quantity);
            }
            state.cart = state.cart.filter((i: any) => i.id !== productId);
        }),

    clearCart: () =>
        set((state) => {
            state.cart.forEach((item: any) => {
                broadcastReservationChange(item.id, 'RELEASE', item.quantity);
            });
            state.cart = [];
        }),

    cleanExpiredReservations: () =>
        set((state) => {
            const now = Date.now();
            const expired: string[] = [];
            state.cart = state.cart.filter((item: any) => {
                const reservedAt = item.reservedAt || item.lastModified || now;
                const isExpired = (now - reservedAt) > RESERVATION_TIMEOUT_MS;
                if (isExpired) {
                    expired.push(item.id);
                    broadcastReservationChange(item.id, 'RELEASE', item.quantity);
                }
                return !isExpired;
            });
            if (expired.length > 0) {
                console.warn(`[LFEDS Timer] ⏱️ ${expired.length} reservas en carrito expiran de 30min -> liberadas a Estado 0 (Estante)`);
            }
        }),

    openCart: () =>
        set((state) => {
            state.isCartOpen = true;
        }),

    closeCart: () =>
        set((state) => {
            state.isCartOpen = false;
        }),

    setCart: (cart) =>
        set((state) => {
            state.cart = cart;
        }),

    getTotal: () =>
        get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0),

    getItemCount: () =>
        get().cart.reduce((sum, item) => sum + item.quantity, 0),
});
