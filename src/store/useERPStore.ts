"use client";

import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import type { ERPState } from './slices/types';
import { createCartSlice } from './slices/cartSlice';
import { createProductsSlice, createOrdersSlice, createFinanceSlice, createConfigSlice } from './slices/otherSlices';
import { createUISlice } from './slices/uiSlice';
import { fallbackProducts, defaultSiteConfig } from './fallbackData';
import { createIdbStorageAdapter, createFallbackStorageAdapter } from './idb-storage-adapter';

export { fallbackProducts, defaultSiteConfig };

/**
 * Resuelve el storeId activo.
 * 1. Busca ?s= en la URL (acceso via QR del cliente)
 * 2. Busca cache en localStorage (puente rapido entre renders)
 * 3. Fallback a 'default'
 */
function resolveActiveStoreId(): string {
    if (typeof window === 'undefined') return 'default';
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('s');
    if (fromUrl && fromUrl.length > 8) return fromUrl;
    return localStorage.getItem('_bunkker_active_store') ?? 'default';
}

const activeStoreId = resolveActiveStoreId();

/**
 * Storage adapter: IndexedDB en el cliente, fallback localStorage para SSR.
 * Cada tienda usa su propio namespace (activeStoreId) → aislamiento total.
 */
const storageAdapter = typeof window !== 'undefined'
    ? createIdbStorageAdapter(activeStoreId)
    : createFallbackStorageAdapter();

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
                name: `bunkker-erp-${activeStoreId}`,
                storage: createJSONStorage(() => storageAdapter),
                // Persiste todas las entidades del negocio en IDB del dispositivo
                partialize: (state) => ({
                    cart:       state.cart,
                    products:   state.products,
                    orders:     state.orders,
                    siteConfig: state.siteConfig,
                    finance:    state.finance,
                }),
            }
        )
    )
);

export const useCart_slice       = () => useERPStore((s) => s.cart);
export const useProducts_slice   = () => useERPStore((s) => s.products);
export const useOrders_slice     = () => useERPStore((s) => s.orders);
export const useSiteConfig_slice = () => useERPStore((s) => s.siteConfig);
export const useConnectionStatus = () => useERPStore((s) => ({ firebaseStatus: s.firebaseStatus, loading: s.loading }));
export const useActiveStoreId    = () => activeStoreId;
