"use client";

import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { ERPState } from './slices/types';
import { createCartSlice } from './slices/cartSlice';
import { createProductsSlice, createOrdersSlice, createFinanceSlice, createConfigSlice } from './slices/otherSlices';
import { createUISlice } from './slices/uiSlice';
import { fallbackProducts, defaultSiteConfig } from './fallbackData';

export { fallbackProducts, defaultSiteConfig };

export const useERPStore = create<ERPState>()(
    subscribeWithSelector(
        persist(
            immer((...a) => ({
                ...createCartSlice(...a),
                ...createProductsSlice(...a),
                ...createOrdersSlice(...a),
                ...createFinanceSlice(...a),
                ...createConfigSlice(...a),
                ...createUISlice(...a),
            })),
            {
                name: 'admincom-cart-storage',
                storage: createJSONStorage(() => localStorage),
                partialize: (state) => ({ cart: state.cart }),
            }
        )
    )
);

export const useCart_slice = () => useERPStore((s) => s.cart);
export const useProducts_slice = () => useERPStore((s) => s.products);
export const useOrders_slice = () => useERPStore((s) => s.orders);
export const useSiteConfig_slice = () => useERPStore((s) => s.siteConfig);
export const useConnectionStatus = () => useERPStore((s) => ({ firebaseStatus: s.firebaseStatus, loading: s.loading }));
