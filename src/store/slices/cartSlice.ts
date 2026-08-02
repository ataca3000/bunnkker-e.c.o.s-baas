import type { StateCreator } from 'zustand';
import type { ERPState, CartSlice } from './types';

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
            if (existing) {
                if (existing.quantity + quantity > product.stock) return;
                existing.quantity += quantity;
                (existing as any).lastModified = Date.now();
            } else {
                state.cart.push({ ...product, quantity, lastModified: Date.now() } as any);
            }
        }),

    removeFromCart: (productId) =>
        set((state) => {
            state.cart = state.cart.filter((i: any) => i.id !== productId);
        }),

    clearCart: () =>
        set((state) => {
            state.cart = [];
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
