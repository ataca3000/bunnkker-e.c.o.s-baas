import { StateCreator } from 'zustand';
import type { ERPState, ProductsSlice, OrdersSlice, ConfigSlice, FinanceSlice } from './types';
import { fallbackProducts, defaultSiteConfig } from '../fallbackData';

export const createProductsSlice: StateCreator<ERPState, [['zustand/immer', never]], [], ProductsSlice> = (set) => ({
    products: [],
    floatingStock: {},
    setProducts: (products) => set((state) => { state.products = products; }),
    setFloatingStock: (data) => set((state) => { state.floatingStock = data; }),
    addProduct: (product) => set((state) => { state.products.push(product as any); }),
    updateProduct: (product) => set((state) => { 
        const i = state.products.findIndex(p => p.id === product.id);
        if (i !== -1) state.products[i] = product as any;
    }),
    deleteProduct: (id) => set((state) => { 
        state.products = state.products.filter(p => p.id !== id);
    }),
});

export const createOrdersSlice: StateCreator<ERPState, [['zustand/immer', never]], [], OrdersSlice> = (set) => ({
    orders: [],
    setOrders: (orders) => set((state) => { state.orders = orders; }),
});

export const createFinanceSlice: StateCreator<ERPState, [['zustand/immer', never]], [], FinanceSlice> = (set) => ({
    ownerCredits: 0,
    ownerBalance: 0,
    maintenanceBalance: 0,
    setOwnerConfig: (credits, balance, maintenance) => set((state) => {
        state.ownerCredits = credits;
        state.ownerBalance = balance;
        state.maintenanceBalance = maintenance;
    }),
});

export const createConfigSlice: StateCreator<ERPState, [['zustand/immer', never]], [], ConfigSlice> = (set, get) => ({
    siteConfig: defaultSiteConfig,
    setSiteConfig: (config) => set((state) => { state.siteConfig = config; }),
    formatCurrency: (amount: number) => {
        const { currencySymbol = '$', currency = 'MXN' } = get().siteConfig;
        return `${currencySymbol}${amount.toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })} ${currency}`;
    },
});
