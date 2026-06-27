"use client";

import { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { logAudit } from '@/lib/audit';
import { useAuth } from './AuthContext';
import { useERPStore, fallbackProducts, defaultSiteConfig } from '@/store/useERPStore';
import type { BlockConfig } from '@/components/marketing/builder/Types';
import type { Product, CartItem, Order } from '@/lib/types';

export type { Product, CartItem, Order };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketSection {
    id: string;
    title: string;
    description?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video';
    filterType?: 'category' | 'all';
    filterValue?: string;
}

export interface PromoWidget {
    id: string;
    title: string;
    content: string;
    isActive: boolean;
    page?: string;
    subtitle?: string;
    actionText?: string;
    imageUrl?: string;
}

export interface VisualLayoutBlock {
    id: string;
    type: 'hero' | 'catalog' | 'map' | 'custom_text' | 'image' | 'widget' | 'about';
    order: number;
    visible: boolean;
    settings?: {
        fontSize?: number;
        alignment?: 'left' | 'center' | 'right';
        columns?: number;
        categoryFilter?: string;
        showRatings?: boolean;
        borderRadius?: number;
        buttonText?: string;
        backgroundColor?: string;
        textColor?: string;
        whatsappNumber?: string;
        questionsText?: string;
        titleText?: string;
        subtitleText?: string;
        imageUrl?: string;
    };
}

export type CanvasLayer = {
    id: string;
    type: 'text' | 'image' | 'video' | 'sticker';
    x: number;
    y: number;
    width: number;
    height?: number;
    content: string;
    fontSize?: number;
    fontFamily?: string;
    fontEffect?: string;
    color?: string;
    rotation?: number;
    zIndex?: number;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
};


export interface SiteConfig {
    businessName: string;
    businessPhone: string;
    businessAddress?: string;
    currency: string;
    currencySymbol: string;
    marketTitle: string;
    marketSubtitle: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    banners?: string[];
    heroMedia?: string;
    heroMediaType?: 'image' | 'video';
    sections: MarketSection[];
    widgets?: PromoWidget[];
    businessHours?: {
        open: string;
        close: string;
        isNightModeSimulated: boolean;
    };
    blocks?: BlockConfig[];
    themeGradient?: string;
    themeFont?: string;
    heroImage?: string;
    mapLocationUrl?: string;
    layout?: VisualLayoutBlock[];
    productOrder?: string[];
    pagesData?: Record<string, {
        layout: VisualLayoutBlock[];
        canvasLayers: CanvasLayer[];
    }>;
}

export type FirebaseStatus = 'connecting' | 'online' | 'offline' | 'demo';


// ============================================================================
// NUEVA LÓGICA (FASE 6): Zustand Integrado + CartProvider Ligero
// ============================================================================

const CartContext = createContext<any>(null); // Dummy context por compatibilidad

export function CartProvider({ children }: { children: React.ReactNode }) {
    const { isReadOnly, profile, loading: authLoading } = useAuth();
    const setProducts       = useERPStore((s) => s.setProducts);
    const setOrders         = useERPStore((s) => s.setOrders);
    const setOwnerConfig    = useERPStore((s) => s.setOwnerConfig);
    const _setSiteConfig    = useERPStore((s) => s.setSiteConfig);
    const setFirebaseStatus = useERPStore((s) => s.setFirebaseStatus);
    const setLoading        = useERPStore((s) => s.setLoading);
    const firebaseStatus    = useERPStore((s) => s.firebaseStatus);

    // ─── Local API Sync for Operational Data (Products & Orders) ──────────────
    useEffect(() => {
        if (authLoading) return;
        
        let isFetching = false;
        const fetchLocalData = async () => {
            if (isFetching) return;
            isFetching = true;
            try {
                // Fetch Products from Local API
                const prodRes = await fetch('/api/products');
                if (prodRes.ok) {
                    const prodData = await prodRes.json();
                    if (prodData.success) {
                        setProducts(prodData.data);
                    }
                }

                // Fetch Orders from Local API
                const ordRes = await fetch('/api/orders');
                if (ordRes.ok) {
                    const ordData = await ordRes.json();
                    if (ordData.success) {
                        setOrders(ordData.data.sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')));
                    }
                }
                
                setFirebaseStatus('online'); // Using this status to represent "Local Server Online"
            } catch (err) {
                console.warn('[Admin.com ERP] Local server unreachable. Working offline.', err);
                setFirebaseStatus('offline');
            } finally {
                setLoading(false);
                isFetching = false;
            }
        };

        // Initial fetch
        fetchLocalData();

        // Ultra-fast polling for local network (every 2 seconds)
        const pollInterval = setInterval(fetchLocalData, 2000);

        return () => clearInterval(pollInterval);
    }, [authLoading, setProducts, setOrders, setFirebaseStatus, setLoading]);

    // ─── Local Settings Init ──────────────────────────────────────────────────
    useEffect(() => {
        try {
            const local = localStorage.getItem('_admincom_site_config');
            if (local) _setSiteConfig({ ...defaultSiteConfig, ...JSON.parse(local) });
            // By default, owner configuration can just be zeroed out locally
            // until a proper local SQLite table is created for settings.
            setOwnerConfig(0, 0, 0);
        } catch { }
    }, [_setSiteConfig, setOwnerConfig]);

    return <>{children}</>;
}

// Custom hook que puentea Zustand para no romper los 32 archivos existentes
export const useCart = () => {
    const { isReadOnly, profile } = useAuth();
    const store = useERPStore();

    // Re-creamos las funciones de negocio aquí para que tengan acceso a profile/auth
    const createOrder = async (
        customerData: { name: string; phone: string; address: string; rfc?: string; regimenFiscal?: string; usoCFDI?: string; deliveryMethod?: string; paymentMethod?: string; tip?: number; lat?: number; lng?: number; pickupTime?: string },
        requiresInvoice: boolean = false,
        isOnline: boolean = false,
        asRequest: boolean = false 
    ) => {
        if (isReadOnly) { alert('🔒 MODO DEMOSTRACIÓN: Los pedidos no se guardan.'); return; }
        if (store.firebaseStatus === 'offline') { console.warn('⚠️ Sin conexión. El pedido se encolará localmente.'); }
        if (store.cart.length === 0) { alert('⚠️ El carrito está vacío.'); return; }

        const orderId = `ORD-${Date.now().toString().slice(-6)}`;
        let orderTotal = store.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        orderTotal += (customerData.tip || 0);
        
        const developerFee = 0;
        const ownerAutomationFee = 0;

        let isNightQueue = false;
        if (store.siteConfig.businessHours?.isNightModeSimulated) {
            isNightQueue = true;
        } else if (store.siteConfig.businessHours?.open && store.siteConfig.businessHours?.close) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const [openH, openM] = store.siteConfig.businessHours.open.split(':').map(Number);
            const [closeH, closeM] = store.siteConfig.businessHours.close.split(':').map(Number);
            const openMinutes = openH * 60 + openM;
            const closeMinutes = closeH * 60 + closeM;
            if (currentMinutes < openMinutes || currentMinutes > closeMinutes) {
                isNightQueue = true;
            }
        }

        let finalStatus = asRequest ? 'pending_confirmation' : 'paid';
        let expiresAt = null;

        if (asRequest) {
            if (customerData.deliveryMethod === 'repartidor') {
                if (customerData.paymentMethod === 'pago_caja') {
                    finalStatus = 'pending_payment';
                    expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
                } else {
                    finalStatus = 'paid_pending_delivery';
                }
            } else if (customerData.deliveryMethod === 'pickup') {
                if (customerData.paymentMethod === 'pago_caja') {
                    finalStatus = 'pending_payment';
                } else {
                    finalStatus = 'paid_pending_delivery';
                }
            } else { // 'piso'
                if (customerData.paymentMethod === 'pago_caja') {
                    finalStatus = 'pending_payment';
                } else {
                    finalStatus = 'paid';
                }
            }
        }

        const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();

        const newOrder = {
            id: orderId, customer: customerData, customerEmail: customerData.phone,
            items: [...store.cart], total: orderTotal,
            date: new Date().toISOString(), status: isNightQueue ? 'NIGHT_QUEUE' : finalStatus as any,
            expiresAt,
            paymentMethod: asRequest ? (customerData.paymentMethod || 'pago_caja') : (isOnline ? 'Online' : 'Venta Directa'), requiresInvoice,
            deliveryMethod: customerData.deliveryMethod || 'tienda',
            deliveryPin
        };

        try {
            // ── LOCAL API SYNC ──
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newOrder,
                    id: orderId,
                    stockDeducted: true,
                    items: store.cart.map(i => ({ id: i.id, quantity: i.quantity, price: i.price }))
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error al guardar en el servidor local');
            }

            // 2. Local-only: We are no longer syncing maintenanceCredits to the cloud automatically.
            // Owner balance/credits can be managed via local SQLite later if needed.

            store.clearCart();
            await logAudit({
                type: 'ORDER_CREATE', userId: profile?.uid || 'GUEST',
                userName: profile?.displayName || customerData.name,
                userRole: profile?.role || 'customer',
                description: `Pedido: ${orderId} por ${store.formatCurrency(orderTotal)}`,
                metadata: { orderId, total: orderTotal, stockDeducted: true },
            });
            return { orderId, deliveryPin };
        } catch (err: any) {
            console.error('Order error:', err);
            alert(`❌ Venta rechazada:\n${err.message}`);
            throw err;
        }
    };

    const confirmRequest = async (orderId: string) => {
        if (isReadOnly) return;
        if (store.firebaseStatus === 'offline') console.warn('⚠️ Sin conexión. La confirmación se encolará.');
        
        const order = store.orders.find(o => o.id === orderId);
        if (!order) return;

        const sellerName = profile?.displayName || 'Vendedor';
        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        const plainAudit = `[${timestamp}] ${sellerName.toUpperCase()}: CONFIRMÓ COBRO ${orderId} - TOTAL ${store.formatCurrency(order.total)}`;

        try {
            // 1. Marcar orden como pagada en el Servidor Local
            const nextStatus = order.deliveryType === 'DELIVERY' || order.deliveryMethod === 'repartidor' ? 'READY_TO_SHIP' : 'COMPLETED';
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    status: nextStatus,
                    vendedorId: profile?.uid,
                    vendedorName: sellerName,
                    confirmedAt: new Date().toISOString()
                })
            });

            if (!res.ok) throw new Error('Error actualizando orden localmente');

            // 2. (Deprecado) Sumar KPI al vendedor que confirmó (en Firebase, centralizado)
            // Esto ahora se calculará sumando localmente las órdenes en lugar de guardar un contador aislado.

            await logAudit({
                type: 'ORDER_CREATE', userId: profile?.uid || 'SYSTEM',
                userName: sellerName, userRole: 'sales',
                description: plainAudit, 
                metadata: { orderId }
            });
        } catch (err) { console.error("Error confirmando cobro:", err); }
    };

    const startLoading = async (orderId: string) => {
        if (isReadOnly || store.firebaseStatus === 'offline') return;
        const workerName = profile?.displayName || 'Cargador';
        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        const plainAudit = `[${timestamp}] ${workerName.toUpperCase()}: INICIÓ CARGA DE ORDEN ${orderId}`;

        try {
            await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    loadedBy: workerName,
                    loadedByUid: profile?.uid,
                    loadingStartedAt: new Date().toISOString()
                })
            });
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: workerName, userRole: 'carga_descarga',
                description: plainAudit, metadata: { orderId, action: 'start_loading' }
            });
        } catch (err) { throw err; }
    };

    const completeLoading = async (orderId: string) => {
        if (isReadOnly || store.firebaseStatus === 'offline') return;
        const workerName = profile?.displayName || 'Cargador';
        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        const plainAudit = `[${timestamp}] ${workerName.toUpperCase()}: FINALIZÓ CARGA DE ORDEN ${orderId}`;

        try {
            await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    isLoaded: true,
                    loadingFinishedAt: new Date().toISOString(),
                    status: 'OUT_FOR_DELIVERY'
                })
            });

            // (Deprecado) Update KPI score in Firebase
            // KPI calculation should be done by aggregating local orders.

            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: workerName, userRole: 'carga_descarga',
                description: plainAudit, metadata: { orderId, action: 'complete_loading' }
            });
        } catch (err) { throw err; }
    };

    const exportInventoryToCSV = () => {
        if (store.products.length === 0) return;
        const headers = ['ID', 'Nombre', 'Categoria', 'Precio', 'Stock', 'Barcode'];
        const rows = store.products.map(p => [
            p.id, p.name, p.category, p.price, p.stock, p.barcode || ''
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `inventario_brecha_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const sendDailyClosing = async () => {
        if (isReadOnly) return;
        const today = new Date().toISOString().split('T')[0];
        const todaysOrders = store.orders.filter(o => (o.date || '').startsWith(today) && o.status === 'paid');
        const totalSales = todaysOrders.reduce((sum, o) => sum + o.total, 0);
        const salesCount = todaysOrders.length;
        const reportText = `CORTE DE CAJA - ${today}\n---------------------------\nVentas Totales: ${store.formatCurrency(totalSales)}\nNúmero de Pedidos: ${salesCount}\nVendedor Activo: ${profile?.displayName || 'Admin'}\n`;

        try {
            await fetch('/api/admin/daily-closing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report: reportText, ownerEmail: store.siteConfig.businessPhone })
            });
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Admin', userRole: 'admin',
                description: `CORTE DE CAJA GENERADO: Total ${store.formatCurrency(totalSales)}`,
                metadata: { total: totalSales, count: salesCount }
            });
            alert("✅ Corte de caja enviado al correo del dueño.");
        } catch (e) { console.error(e); }
    };

    const updateProductPrice = async (productId: string, newPrice: number, adminName: string) => {
        if (isReadOnly) { alert('🔒 MODO DEMOSTRACIÓN.'); return; }
        if (store.firebaseStatus === 'offline') { alert('⚠️ Sin conexión.'); return; }
        const product = store.products.find(p => p.id === productId);
        if (!product) return;
        try {
            await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId, price: newPrice })
            });
            await logAudit({
                type: 'PRICE_CHANGE', userId: adminName, userName: adminName, userRole: 'admin',
                description: `Precio ${product.name}: ${store.formatCurrency(product.price)} → ${store.formatCurrency(newPrice)}`,
                metadata: { productId, oldPrice: product.price, newPrice },
            });
        } catch (err: any) { console.error('Error', err); }
    };

    const updateProduct = async (productId: string, updates: Partial<Product>, adminName: string) => {
        if (isReadOnly) { alert('🔒 MODO DEMOSTRACIÓN.'); return; }
        if (store.firebaseStatus === 'offline') { alert('⚠️ Sin conexión.'); return; }
        const product = store.products.find(p => p.id === productId);
        if (!product) return;
        try {
            await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId, ...updates })
            });
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM', userName: adminName, userRole: profile?.role || 'admin',
                description: `Producto editado: ${product.name}`, metadata: { productId, updates },
            });
        } catch (err: any) { console.error('Error', err); }
    };

    const purchaseCredits = async (amount: number, type: 'invoice' | 'maintenance') => {
        if (isReadOnly) { alert('🔒 MODO DEMOSTRACIÓN.'); return; }
        try {
            // Local fallback logic can be placed here if settings table is created.
            await logAudit({
                type: 'CONFIG_UPDATE', userId: 'SYSTEM', userName: 'Admin', userRole: 'admin',
                description: `Recarga ${type}: +${amount}`, metadata: { amount, type },
            });
            alert('Recarga local registrada (Pendiente de implementación en SQLite)');
        } catch (err: any) { console.error(err); }
    };

    const cancelOrder = async (orderId: string) => {
        if (isReadOnly || store.firebaseStatus === 'offline') return;
        const order = store.orders.find(o => o.id === orderId);
        if (!order) return;
        try {
            // Cancelar la orden localmente
            await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    status: 'cancelled',
                    cancelledAt: new Date().toISOString()
                })
            });

            // Reembolsar fee en la nube (Desactivado en versión local)

            // Devolver stock localmente si aplica
            if ((order as any).stockDeducted === true) {
                for (const item of order.items) {
                    await fetch('/api/products', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: item.id, stockIncrement: item.quantity }) 
                    });
                }
            }
            
            await logAudit({
                type: 'ORDER_CANCEL', userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Sistema', userRole: profile?.role || 'admin',
                description: `Pedido cancelado: ${orderId}`, metadata: { orderId, refundTotal: order.total },
            });
        } catch (err: any) { console.error('Error', err); }
    };

    const updateSiteConfig = async (config: Partial<SiteConfig>) => {
        if (isReadOnly) return;
        const merged = { ...store.siteConfig, ...config };
        store.setSiteConfig(merged); // optimistic
        try { 
            localStorage.setItem('_admincom_site_config', JSON.stringify(merged)); 
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Admin', userRole: profile?.role || 'admin',
                description: 'Configuración de sitio actualizada localmente', metadata: { config },
            });
        } catch (e) { console.error(e); }
    };

    return {
        ...store,
        total: store.getTotal(),
        itemCount: store.getItemCount(),
        createOrder, cancelOrder, confirmRequest, startLoading, completeLoading,
        exportInventoryToCSV, sendDailyClosing, updateProductPrice, updateProduct,
        purchaseCredits, updateSiteConfig
    };
};

