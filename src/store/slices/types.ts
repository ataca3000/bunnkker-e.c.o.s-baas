import type { CartItem, Product, Order, SiteConfig, FirebaseStatus } from '@/context/CartContext';

export interface CartSlice {
    cart: CartItem[];
    isCartOpen: boolean;
    addToCart: (product: Product, quantity?: number) => void;
    removeFromCart: (productId: string) => void;
    clearCart: () => void;
    openCart: () => void;
    closeCart: () => void;
    setCart: (cart: CartItem[]) => void;
    cleanExpiredReservations: () => void;
    getTotal: () => number;
    getItemCount: () => number;
}

export interface ProductsSlice {
    products: Product[];
    floatingStock: Record<string, number>;
    setProducts: (products: Product[]) => void;
    setFloatingStock: (data: Record<string, number>) => void;
    addProduct: (product: Product) => void;
    updateProduct: (product: Product) => void;
    deleteProduct: (id: string) => void;
}

export interface OrdersSlice {
    orders: Order[];
    setOrders: (orders: Order[]) => void;
}

export interface ConfigSlice {
    siteConfig: SiteConfig;
    setSiteConfig: (config: SiteConfig) => void;
    formatCurrency: (amount: number) => string;
}

export interface UISlice {
    loading: boolean;
    firebaseStatus: FirebaseStatus;
    setLoading: (loading: boolean) => void;
    setFirebaseStatus: (status: FirebaseStatus) => void;
    guidedTourActive: boolean;
    guidedTourStep: number;
    hasCustomizedCanvas: boolean;
    hasPublishedCanvas: boolean;
    hasAddedProductToSimulator: boolean;
    hasPaidInSimulator: boolean;
    startGuidedTour: () => void;
    nextGuidedTourStep: () => void;
    prevGuidedTourStep: () => void;
    stopGuidedTour: () => void;
    setGuidedTourStep: (step: number) => void;
    setHasCustomizedCanvas: (val: boolean) => void;
    setHasPublishedCanvas: (val: boolean) => void;
    setHasAddedProductToSimulator: (val: boolean) => void;
    setHasPaidInSimulator: (val: boolean) => void;
}

export interface FinanceSlice {
    ownerCredits: number;
    ownerBalance: number;
    maintenanceBalance: number;
    setOwnerConfig: (credits: number, balance: number, maintenance: number) => void;
}

export type ERPState = CartSlice & ProductsSlice & OrdersSlice & ConfigSlice & UISlice & FinanceSlice;
