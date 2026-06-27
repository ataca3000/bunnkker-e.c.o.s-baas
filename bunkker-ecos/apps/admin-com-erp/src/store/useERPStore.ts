/**
 * useERPStore.ts — Admin.com ERP Universal
 * Store central con Zustand que reemplaza los useState dispersos del CartContext.
 * Diseño: slices independientes para cart, products, orders y UI.
 * Compatible con SSR (Next.js 15 App Router) mediante el patrón `createStore`.
 */

"use client";

import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
    CartItem,
    Product,
    Order,
    SiteConfig,
    FirebaseStatus,
} from '@/context/CartContext';

// ─── Fallback/Default Data ────────────────────────────────────────────────────

export const fallbackProducts: Product[] = [
    {
        id: 'FERR-CEM-01', name: 'Cemento Cruz Azul Gris 50kg', price: 185, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 128, barcode: '7501020304050', description: 'Cemento gris de alta resistencia para todo tipo de construcciones.'
    },
    {
        id: 'FERR-TLD-02', name: 'Taladro Percutor DeWalt 20V Max', price: 2499, stock: 10, category: 'Ofertas', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 84, barcode: '0885911432561', description: 'Taladro inalámbrico profesional con 2 baterías de litio incluidas.'
    },
    {
        id: 'FERR-PNT-03', name: 'Pintura Vinílica Comex Pro 1000 Blanco 19L', price: 1150, stock: 10, category: 'Liquidación', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&auto=format&fit=crop', rating: 4.6, reviewCount: 45, barcode: '7501234567890', description: 'Pintura vinil acrílica para interiores y exteriores. Alto rendimiento.'
    },
    {
        id: 'FERR-MRT-04', name: 'Martillo Truper de Uña Curva 16oz', price: 145, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&auto=format&fit=crop', rating: 4.7, reviewCount: 230, barcode: '7509876543210', description: 'Martillo forjado en acero con mango de madera de encino.'
    },
    {
        id: 'FERR-CBL-05', name: 'Cable THW Calibre 12 AWG Indiana (Caja 100m)', price: 980, stock: 10, category: 'Electricidad', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 312, barcode: '7504445556667', description: 'Cable de cobre con aislamiento termoplástico para instalaciones domésticas.'
    },
    {
        id: 'FERR-SRR-06', name: 'Sierra Circular Makita 7-1/4"', price: 1850, stock: 10, category: 'Ofertas', image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 67, barcode: '088381001234', description: 'Potente motor de 1,050W para cortes precisos en madera.'
    },
    {
        id: 'FERR-CLV-07', name: 'Caja de Clavos Standard 2.5" 1Kg', price: 45, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1510166089176-b57564a5b7d5?w=800&auto=format&fit=crop', rating: 4.5, reviewCount: 32, barcode: '7509998887776', description: 'Clavo de acero standard con cabeza plana.'
    },
    {
        id: 'FERR-PLM-08', name: 'Tubo CPVC 1/2" Tramo de 3 Metros', price: 68, stock: 10, category: 'Plomería', image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop', rating: 4.6, reviewCount: 55, barcode: '7502223334445', description: 'Tubería para agua fría y caliente de alta resistencia.'
    },
    {
        id: 'FERR-FOCO-09', name: 'Foco LED Philips 9W Luz Blanca', price: 35, stock: 10, category: 'Electricidad', image: 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 420, barcode: '8718696577395', description: 'Foco LED ahorrador, equivalente a 60W tradicionales.'
    },
    {
        id: 'FERR-ESM-10', name: 'Esmeriladora Angular Bosch 4-1/2"', price: 1299, stock: 10, category: 'Ofertas', image: 'https://images.unsplash.com/photo-1586864387789-228f4277bc79?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 112, barcode: '3165140823223', description: 'Herramienta profesional con disco de corte incluido.'
    },
    {
        id: 'FERR-IMP-11', name: 'Impermeabilizante Fester Acriton 5 Años 19L', price: 1450, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop', rating: 4.7, reviewCount: 88, barcode: '7501112223334', description: 'Impermeabilizante acrílico rojo, de secado rápido.'
    },
    {
        id: 'FERR-PIN-12', name: 'Brocha de Cerdas Naturales 4" Éxito', price: 85, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&auto=format&fit=crop', rating: 4.4, reviewCount: 22, barcode: '7500001112223', description: 'Brocha profesional ideal para vinílica y esmalte.'
    },
    {
        id: 'FERR-LAV-13', name: 'Mezcladora para Fregadero Dica', price: 420, stock: 10, category: 'Plomería', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop', rating: 4.6, reviewCount: 54, barcode: '7505554443332', description: 'Acabado cromado, fácil instalación, cuello flexible.'
    },
    {
        id: 'FERR-CFL-14', name: 'Cinta Teflón Truper 1/2"x13m', price: 12, stock: 10, category: 'Plomería', image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 1100, barcode: '7501206677889', description: 'Sella roscas en tuberías de agua y gas.'
    },
    {
        id: 'FERR-CAL-15', name: 'Bulto de Calhidra 25kg', price: 65, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 95, barcode: '7504443332221', description: 'Cal hidratada para albañilería general.'
    },
    {
        id: 'FERR-MET-16', name: 'Flexómetro Milwaukee 8 Metros Magnético', price: 340, stock: 10, category: 'Ofertas', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 76, barcode: '045242330832', description: 'Cinta métrica ultra resistente con punta magnética.'
    },
    {
        id: 'FERR-BRO-17', name: 'Juego de Brocas para Concreto Bosch 5 Pzas', price: 180, stock: 10, category: 'Herramientas', image: 'https://images.unsplash.com/photo-1586864387789-228f4277bc79?w=800&auto=format&fit=crop', rating: 4.7, reviewCount: 45, barcode: '3165140416173', description: 'Brocas de tungsteno para perforar piedra y mampostería.'
    },
    {
        id: 'FERR-LJA-18', name: 'Lija de Agua Fandeli Grano 220', price: 8, stock: 10, category: 'Liquidación', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=800&auto=format&fit=crop', rating: 4.5, reviewCount: 205, barcode: '7507778889990', description: 'Para acabados finos en metales y madera.'
    },
    {
        id: 'FERR-SEG-19', name: 'Arco con Segueta Truper Bimetálica', price: 135, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&auto=format&fit=crop', rating: 4.6, reviewCount: 88, barcode: '7501206680230', description: 'Corte rápido en metales duros y plásticos.'
    },
    {
        id: 'FERR-CCT-20', name: 'Cinta de Aislar Nitto Negra 18m', price: 28, stock: 10, category: 'Electricidad', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 650, barcode: '4953871100222', description: 'Retardante a la llama, uso profesional eléctrico.'
    },
    {
        id: 'FERR-YES-21', name: 'Bulto de Yeso Supremo 40kg', price: 110, stock: 10, category: 'Materiales', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 56, barcode: '7503332221110', description: 'Yeso blanco para recubrimiento de muros interiores.'
    },
    {
        id: 'FERR-PEG-22', name: 'Pegazulejo Niasa Blanco 20kg', price: 125, stock: 10, category: 'Más Vendido', image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop', rating: 4.7, reviewCount: 89, barcode: '7508889990001', description: 'Adhesivo cerámico reforzado para interiores.'
    },
    {
        id: 'FERR-DES-23', name: 'Desarmador Phillips #2 Klein Tools', price: 195, stock: 10, category: 'Electricidad', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&auto=format&fit=crop', rating: 4.9, reviewCount: 134, barcode: '092644322158', description: 'Punta de precisión, mango ergonómico cushion-grip.'
    },
    {
        id: 'FERR-TNB-24', name: 'Tinaco Rotoplas 1100 Lts Tricapa', price: 2450, stock: 10, category: 'Ofertas', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&auto=format&fit=crop', rating: 4.8, reviewCount: 42, barcode: '7504445558889', description: 'Incluye accesorios. Garantía de por vida, protección UV.'
    }
];

export const defaultSiteConfig: SiteConfig = {
    businessName: 'Ferretería El Constructor',
    businessPhone: '5512345678',
    businessAddress: 'Av. Revolución 1234, CDMX',
    currency: 'MXN',
    currencySymbol: '$',
    marketTitle: 'Ferretería El Constructor',
    marketSubtitle: 'Todo lo que necesitas para tu obra, al mejor precio y hasta la puerta de tu casa.',
    sections: [
        { id: 'Más Vendido', title: 'Más Vendido' },
        { id: 'Ofertas', title: 'Ofertas de la Semana' },
        { id: 'Liquidación', title: 'Liquidación' },
        { id: 'Electricidad', title: 'Electricidad' },
    ],
    themeGradient: 'from-orange-500 to-amber-400',
    themeFont: 'font-sans',
    heroImage: 'https://images.unsplash.com/photo-1542013936693-884638332954?w=1920&auto=format&fit=crop',
    pagesData: {
        inicio: {
            layout: [
                { id: 'hero', type: 'hero', order: 0, visible: true, settings: { fontSize: 48, alignment: 'center', titleText: 'Construye tus Sueños', subtitleText: 'Materiales, herramientas y acabados de la más alta calidad.', imageUrl: 'https://images.unsplash.com/photo-1542013936693-884638332954?w=1920&auto=format&fit=crop', backgroundColor: '#0f172a' } },
                { id: 'catalog', type: 'catalog', order: 1, visible: true, settings: { columns: 3, categoryFilter: 'Ofertas', showRatings: true, borderRadius: 24 } },
                { id: 'about', type: 'about', order: 2, visible: true, settings: { titleText: 'CONÓCENOS', subtitleText: 'Somos tu aliado de confianza.', imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop', backgroundColor: '#ffffff', textColor: '#1e293b' } },
                { id: 'map', type: 'map', order: 3, visible: true, settings: { titleText: '¿BUSCAS VOLUMEN?', subtitleText: 'Cotiza por mayoreo y obtén descuentos exclusivos.', buttonText: 'CONTACTAR VENTAS', backgroundColor: '#10172a' } }
            ],
            canvasLayers: []
        },
        empresa: {
            layout: [
                { id: 'about1', type: 'about', order: 0, visible: true, settings: { titleText: 'NUESTRA MISIÓN', subtitleText: 'Proveer a las familias y constructoras mexicanas de los mejores materiales con un servicio de entrega rápido y precios justos.', backgroundColor: '#ffffff', textColor: '#1e293b' } },
                { id: 'about2', type: 'about', order: 1, visible: true, settings: { titleText: 'NUESTRA VISIÓN', subtitleText: 'Ser la ferretería líder a nivel nacional impulsada por la innovación y la satisfacción de nuestros clientes.', imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop', backgroundColor: '#f8fafc', textColor: '#1e293b' } },
            ],
            canvasLayers: []
        },
        servicios: {
            layout: [
                { id: 'about', type: 'about', order: 0, visible: true, settings: { titleText: 'ENTREGA A DOMICILIO Y ASESORÍA TÉCNICA', subtitleText: 'Llevamos el material hasta tu obra sin costo adicional en compras mayores a $5,000. Contamos con ingenieros civiles para asesorarte en tus proyectos.', backgroundColor: '#ffffff', textColor: '#1e293b' } }
            ],
            canvasLayers: []
        },
        contacto: {
            layout: [
                { id: 'map', type: 'map', order: 0, visible: true, settings: { titleText: 'ESTAMOS PARA ATENDERTE', subtitleText: 'Escríbenos por WhatsApp o envíanos un mensaje, resolveremos tus dudas al instante.', buttonText: 'ENVIAR MENSAJE', backgroundColor: '#10172a' } }
            ],
            canvasLayers: []
        }
    }
};

// ─── Store Shape ──────────────────────────────────────────────────────────────

interface ERPState {
    // ── Cart slice ─────────────────────────────────────────────────────────────
    cart: CartItem[];
    isCartOpen: boolean;

    // ── Products slice ─────────────────────────────────────────────────────────
    products: Product[];

    // ── Orders slice ───────────────────────────────────────────────────────────
    orders: Order[];

    // ── Financial / Credits slice ─────────────────────────────────────────────
    ownerCredits: number;
    ownerBalance: number;
    maintenanceBalance: number;

    // ── Config slice ───────────────────────────────────────────────────────────
    siteConfig: SiteConfig;

    // ── Connection / Loading slice ────────────────────────────────────────────
    loading: boolean;
    firebaseStatus: FirebaseStatus;

    // ── Cart Actions ───────────────────────────────────────────────────────────
    addToCart: (product: Product, quantity?: number) => void;
    removeFromCart: (productId: string) => void;
    clearCart: () => void;
    openCart: () => void;
    closeCart: () => void;
    setCart: (cart: CartItem[]) => void;

    // ── Data Setters (called by Firebase listeners in CartContext) ─────────────
    setProducts: (products: Product[]) => void;
    setOrders: (orders: Order[]) => void;
    setOwnerConfig: (credits: number, balance: number, maintenance: number) => void;
    setSiteConfig: (config: SiteConfig) => void;
    setFirebaseStatus: (status: FirebaseStatus) => void;
    setLoading: (loading: boolean) => void;

    // ── Guided Tour slice ──────────────────────────────────────────────────────
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

    // ── Derived helpers (no setter needed, computed inline) ────────────────────
    getTotal: () => number;
    getItemCount: () => number;
    formatCurrency: (amount: number) => string;
}

// ─── Store Implementation ─────────────────────────────────────────────────────

export const useERPStore = create<ERPState>()(
    subscribeWithSelector(
        persist(
            immer((set, get) => ({
                // ── Initial State ──────────────────────────────────────────────────
                cart: [],
                isCartOpen: false,
                products: fallbackProducts,
                orders: [],
                ownerCredits: 0,
                ownerBalance: 0,
                maintenanceBalance: 0,
                siteConfig: defaultSiteConfig,
                loading: true,
                firebaseStatus: 'connecting',
                guidedTourActive: false,
                guidedTourStep: 1,
                hasCustomizedCanvas: false,
                hasPublishedCanvas: false,
                hasAddedProductToSimulator: false,
                hasPaidInSimulator: false,

                // ── Guided Tour Actions ────────────────────────────────────────────
                startGuidedTour: () =>
                    set((state) => {
                        state.guidedTourActive = true;
                        state.guidedTourStep = 1;
                        state.hasCustomizedCanvas = false;
                        state.hasPublishedCanvas = false;
                        state.hasAddedProductToSimulator = false;
                        state.hasPaidInSimulator = false;
                    }),
                nextGuidedTourStep: () =>
                    set((state) => {
                        state.guidedTourStep = Math.min(state.guidedTourStep + 1, 6);
                    }),
                prevGuidedTourStep: () =>
                    set((state) => {
                        state.guidedTourStep = Math.max(state.guidedTourStep - 1, 1);
                    }),
                stopGuidedTour: () =>
                    set((state) => {
                        state.guidedTourActive = false;
                    }),
                setGuidedTourStep: (step) =>
                    set((state) => {
                        state.guidedTourStep = step;
                    }),
                setHasCustomizedCanvas: (val) =>
                    set((state) => {
                        state.hasCustomizedCanvas = val;
                    }),
                setHasPublishedCanvas: (val) =>
                    set((state) => {
                        state.hasPublishedCanvas = val;
                    }),
                setHasAddedProductToSimulator: (val) =>
                    set((state) => {
                        state.hasAddedProductToSimulator = val;
                    }),
                setHasPaidInSimulator: (val) =>
                    set((state) => {
                        state.hasPaidInSimulator = val;
                    }),

                // ── Cart Actions ───────────────────────────────────────────────────
                addToCart: (product, quantity = 1) =>
                    set((state) => {
                        const existing = state.cart.find((i) => i.id === product.id);
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
                        state.cart = state.cart.filter((i) => i.id !== productId);
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

                // ── Data Setters ───────────────────────────────────────────────────
                setProducts: (products) =>
                    set((state) => {
                        state.products = products;
                    }),

                setOrders: (orders) =>
                    set((state) => {
                        state.orders = orders;
                    }),

                setOwnerConfig: (credits, balance, maintenance) =>
                    set((state) => {
                        state.ownerCredits = credits;
                        state.ownerBalance = balance;
                        state.maintenanceBalance = maintenance;
                    }),

                setSiteConfig: (config) =>
                    set((state) => {
                        state.siteConfig = config;
                    }),

                setFirebaseStatus: (status) =>
                    set((state) => {
                        state.firebaseStatus = status;
                    }),

                setLoading: (loading) =>
                    set((state) => {
                        state.loading = loading;
                    }),

                // ── Derived Helpers ────────────────────────────────────────────────
                getTotal: () =>
                    get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0),

                getItemCount: () =>
                    get().cart.reduce((sum, item) => sum + item.quantity, 0),

                formatCurrency: (amount: number) => {
                    const { currencySymbol = '$', currency = 'MXN' } = get().siteConfig;
                    return `${currencySymbol}${amount.toLocaleString('es-MX', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })} ${currency}`;
                },
            })),
            {
                name: 'admincom-cart-storage', // Nombre de la clave en localStorage
                storage: createJSONStorage(() => localStorage),
                partialize: (state) => ({ cart: state.cart }), // ¡IMPORTANTE! Solo persistimos el carrito, no el catálogo ni estados de carga
                    }
        )
    )
);

// ─── Selective Selectors (for granular subscription, avoids mass re-renders) ──

/** Use only cart items — components won't re-render on product/order changes */
export const useCart_slice = () => useERPStore((s) => s.cart);

/** Use only the product list */
export const useProducts_slice = () => useERPStore((s) => s.products);

/** Use only the order list */
export const useOrders_slice = () => useERPStore((s) => s.orders);

/** Use only siteConfig */
export const useSiteConfig_slice = () => useERPStore((s) => s.siteConfig);

/** Use only firebase/loading status */
export const useConnectionStatus = () =>
    useERPStore((s) => ({ firebaseStatus: s.firebaseStatus, loading: s.loading }));
