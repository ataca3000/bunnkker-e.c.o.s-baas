"use client";

import { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { logAudit } from '@/lib/audit';
import { useAuth } from './AuthContext';
import { useERPStore, fallbackProducts, defaultSiteConfig } from '@/store/useERPStore';
import type { BlockConfig } from '@/components/marketing/builder/Types';
import type { Product, CartItem, Order } from '@/lib/types';
import { toast } from '@/lib/toast';

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
    operationRange?: 'local' | 'regional' | 'nacional' | 'global';
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
                        const mappedProducts = prodData.data.map((p: any) => ({
                            ...p,
                            location: { estante: p.estante || '', fila: p.fila || '' }
                        }));
                        setProducts(mappedProducts);
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

    // ─── Socket.IO Sync for Floating Stock ─────────────────────────────────────
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const { io } = require("socket.io-client");

            // Detectar si el cliente llegó por HTTPS (celular via proxy seguro)
            // Si es HTTPS, conectar al mismo host/puerto pero con ruta /radio-socket.io/ del proxy
            // Si es HTTP, conectar directo al puerto 3001 (localhost o PC principal)
            const isSecure = window.location.protocol === 'https:';
            const host = window.location.hostname;
            const socketUrl = isSecure
                ? `https://${host}:${window.location.port || 8443}` // via proxy HTTPS unificado
                : `http://${host}:3001`;                             // directo (localhost / PC principal)

            const newSocket = io(socketUrl, {
                path: isSecure ? '/radio-socket.io/' : '/socket.io/',
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
            });
            
            newSocket.on("connect", () => {
                console.log("🟢 Conectado al Sync Server de Inventario");
            });

            newSocket.on("floating_stock_update", (floatingMap: Record<string, number>) => {
                const state = useERPStore.getState();
                // Update floating stock globally
                if (state.setFloatingStock) {
                    state.setFloatingStock(floatingMap);
                }
            });

            newSocket.on("sync_db_event", async () => {
                // Refetch global data silent mode
                const state = useERPStore.getState();
                try {
                    const [resP, resO] = await Promise.all([
                        fetch('/api/products'), fetch('/api/orders')
                    ]);
                    if (resP.ok) {
                        const dataP = await resP.json();
                        if (state.setProducts) {
                            const mappedProducts = (dataP.data || []).map((p: any) => ({
                                ...p,
                                location: { estante: p.estante || '', fila: p.fila || '' }
                            }));
                            state.setProducts(mappedProducts);
                        }
                    }
                    if (resO.ok) {
                        const dataO = await resO.json();
                        if (state.setOrders) state.setOrders(dataO.data || []);
                    }
                } catch(e) {}
            });

            // Make socket available globally for checkout reservation
            (window as any).__inventorySocket = newSocket;

            return () => {
                newSocket.disconnect();
            };
        }
    }, []);
    // ───────────────────────────────────────────────────────────────────────────

    // ─── Local Settings Init ──────────────────────────────────────────────────
    useEffect(() => {
        try {
            // BUG-4 FIX: Migrar clave de siteConfig de _admincom_ a _bunkker_
            const SITE_CONFIG_KEY = '_bunkker_site_config';
            const LEGACY_KEY      = '_admincom_site_config';

            let raw = localStorage.getItem(SITE_CONFIG_KEY);
            if (!raw) {
                // Migrar si existe la clave vieja
                const legacy = localStorage.getItem(LEGACY_KEY);
                if (legacy) {
                    localStorage.setItem(SITE_CONFIG_KEY, legacy);
                    localStorage.removeItem(LEGACY_KEY);
                    raw = legacy;
                    console.info('[BUNKKER] siteConfig migrado de _admincom_ a _bunkker_');
                }
            }

            if (raw) _setSiteConfig({ ...defaultSiteConfig, ...JSON.parse(raw) });
            setOwnerConfig(0, 0, 0);
        } catch { }
    }, [_setSiteConfig, setOwnerConfig]);

    return <>{children}</>;
}

export const useCart = () => {
    const { isReadOnly, profile } = useAuth();
    
    // Al no suscribir a useERPStore() completo, evitamos re-renders en cascada.
    // Solo extraemos getters para las funciones, o devolvemos todo el store proxy
    // NOTA: Para mantener la API intacta sin reescribir docenas de archivos,
    // exportaremos el proxy del store COMPLETO, pero los componentes usarán selectores 
    // específicos para su estado, y estas funciones NO causarán renders internos aquí.
    const store = useERPStore();

    const createOrder = useCallback(async (
        customerData: { name: string; phone: string; address: string; rfc?: string; regimenFiscal?: string; usoCFDI?: string; deliveryMethod?: string; paymentMethod?: string; tip?: number; lat?: number; lng?: number; pickupTime?: string },
        requiresInvoice: boolean = false,
        isOnline: boolean = false,
        asRequest: boolean = false 
    ) => {
        const state = useERPStore.getState();
        if (isReadOnly) { toast.warning('Los pedidos no se guardan en Modo Demostración.', '🔒 Demo'); return; }
        if (state.firebaseStatus === 'offline') { console.warn('⚠️ Sin conexión. El pedido se encolará localmente.'); }
        if (state.cart.length === 0) { toast.warning('El carrito está vacío.'); return; }

        const orderId = `ORD-${Date.now().toString().slice(-6)}`;
        let orderTotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        orderTotal += (customerData.tip || 0);

        let isNightQueue = false;
        if (state.siteConfig.businessHours?.isNightModeSimulated) {
            isNightQueue = true;
        } else if (state.siteConfig.businessHours?.open && state.siteConfig.businessHours?.close) {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const [openH, openM] = state.siteConfig.businessHours.open.split(':').map(Number);
            const [closeH, closeM] = state.siteConfig.businessHours.close.split(':').map(Number);
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

        // BUG-7 FIX: Usar crypto.getRandomValues en lugar de Math.random() para el PIN de entrega.
        // Math.random() es predecible; un atacante puede estimar el rango si conoce el timestamp.
        const pinArray = new Uint16Array(1);
        crypto.getRandomValues(pinArray);
        const deliveryPin = (1000 + (pinArray[0] % 9000)).toString();

        const newOrder = {
            id: orderId, customer: customerData, customerEmail: customerData.phone,
            items: [...state.cart], total: orderTotal,
            date: new Date().toISOString(), status: isNightQueue ? 'NIGHT_QUEUE' : finalStatus as any,
            expiresAt,
            paymentMethod: asRequest ? (customerData.paymentMethod || 'pago_caja') : (isOnline ? 'Online' : 'Venta Directa'), requiresInvoice,
            deliveryMethod: customerData.deliveryMethod || 'tienda',
            deliveryPin
        };

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newOrder,
                    id: orderId,
                    stockDeducted: true,
                    items: state.cart.map(i => ({ productId: i.id, quantity: i.quantity, price: i.price }))
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Error al guardar en el servidor local');
            }

            state.clearCart();
            await logAudit({
                type: 'ORDER_CREATE', userId: profile?.uid || 'GUEST',
                userName: profile?.displayName || customerData.name,
                userRole: profile?.role || 'customer',
                description: `Pedido: ${orderId} por ${state.formatCurrency(orderTotal)}`,
                metadata: { paymentMethod: asRequest ? (customerData.paymentMethod || 'pago_caja') : (isOnline ? 'Online' : 'Venta Directa') }
            });

            // Disparar sincronización en tiempo real a otras pestañas/dispositivos
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'NEW_ORDER', id: orderId });
            }

            return { orderId, deliveryPin };
        } catch (err: any) {
            console.error('Order error:', err);
            toast.error(err.message, '❌ Venta rechazada');
            throw err;
        }
    }, [isReadOnly, profile]);

    const confirmRequest = useCallback(async (orderId: string, locationAssignment?: { ventanilla?: string; cajon?: string }) => {
        const state = useERPStore.getState();
        if (isReadOnly) return;
        if (state.firebaseStatus === 'offline') console.warn('⚠️ Sin conexión. La confirmación se encolará.');
        
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;

        const sellerName = profile?.displayName || 'Vendedor';
        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        const plainAudit = `[${timestamp}] ${sellerName.toUpperCase()}: CONFIRMÓ COBRO ${orderId} - TOTAL ${state.formatCurrency(order.total)}`;

        try {
            // BUG-5 FIX: El ternario anterior tenía READY_TO_SHIP en ambas ramas (código muerto).
            // Un pedido de mostrador (piso/pickup) ya fue cobrado en caja; puede pasar directamente
            // a COMPLETED sin pasar por el flujo de almacén.
            const isDelivery = order.deliveryType === 'DELIVERY' || order.deliveryMethod === 'repartidor';
            const isPickup   = order.deliveryMethod === 'pickup';
            const nextStatus = isDelivery ? 'READY_TO_SHIP'
                             : isPickup   ? 'READY_TO_SHIP'   // pickup sí requiere preparación en almacén
                             : 'COMPLETED';                   // piso → cobrado y entregado en el acto
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    status: nextStatus,
                    vendedorId: profile?.uid,
                    vendedorName: sellerName,
                    confirmedAt: new Date().toISOString(),
                    ...locationAssignment
                })
            });

            if (!res.ok) throw new Error('Error actualizando orden localmente');

            await logAudit({
                type: 'ORDER_CREATE', userId: profile?.uid || 'SYSTEM',
                userName: sellerName, userRole: 'sales',
                description: plainAudit, 
                metadata: { orderId }
            });

            // Disparar sincronización en tiempo real a otras pestañas/dispositivos
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'ORDER_CONFIRMED', id: orderId });
            }
        } catch (err) { console.error("Error confirmando cobro:", err); }
    }, [isReadOnly, profile]);

    const startLoading = useCallback(async (orderId: string) => {
        const state = useERPStore.getState();
        if (isReadOnly || state.firebaseStatus === 'offline') return;
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
    }, [isReadOnly, profile]);

    const completeLoading = useCallback(async (orderId: string) => {
        const state = useERPStore.getState();
        if (isReadOnly || state.firebaseStatus === 'offline') return;
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

            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: workerName, userRole: 'carga_descarga',
                description: plainAudit, metadata: { orderId, action: 'complete_loading' }
            });
        } catch (err) { throw err; }
    }, [isReadOnly, profile]);

    const exportInventoryToCSV = useCallback(() => {
        const state = useERPStore.getState();
        if (state.products.length === 0) return;
        const headers = ['ID', 'Nombre', 'Categoria', 'Precio', 'Stock', 'Barcode'];
        const rows = state.products.map(p => [
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
    }, []);

    const sendDailyClosing = useCallback(async () => {
        const state = useERPStore.getState();
        if (isReadOnly) return;
        const today = new Date().toISOString().split('T')[0];
        const todaysOrders = state.orders.filter(o => (o.date || '').startsWith(today) && o.status === 'paid');
        const totalSales = todaysOrders.reduce((sum, o) => sum + o.total, 0);
        const salesCount = todaysOrders.length;
        const reportText = `CORTE DE CAJA - ${today}\n---------------------------\nVentas Totales: ${state.formatCurrency(totalSales)}\nNúmero de Pedidos: ${salesCount}\nVendedor Activo: ${profile?.displayName || 'Admin'}\n`;

        try {
            await fetch('/api/admin/daily-closing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report: reportText, ownerEmail: state.siteConfig.businessPhone })
            });
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Admin', userRole: 'admin',
                description: `CORTE DE CAJA GENERADO: Total ${state.formatCurrency(totalSales)}`,
                metadata: { total: totalSales, count: salesCount }
            });
            toast.success('Corte de caja enviado al correo del dueño.', '✅ Corte de Caja');
        } catch (e) { console.error(e); }
    }, [isReadOnly, profile]);

    const updateProductPrice = useCallback(async (productId: string, newPrice: number, adminName: string) => {
        const state = useERPStore.getState();
        if (isReadOnly) { toast.warning('Operación no disponible en Modo Demostración.', '🔒 Demo'); return; }
        if (state.firebaseStatus === 'offline') { toast.warning('Sin conexión. Intenta cuando haya internet.', '⚠️ Offline'); return; }
        const product = state.products.find(p => p.id === productId);
        if (!product) return;
        try {
            await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId, price: newPrice })
            });
            await logAudit({
                type: 'PRICE_CHANGE', userId: adminName, userName: adminName, userRole: 'admin',
                description: `Precio ${product.name}: ${state.formatCurrency(product.price)} → ${state.formatCurrency(newPrice)}`,
                metadata: { productId, oldPrice: product.price, newPrice },
            });
        } catch (err: any) { console.error('Error', err); }
    }, [isReadOnly]);

    const updateProduct = useCallback(async (productId: string, updates: Partial<Product>, adminName: string) => {
        const state = useERPStore.getState();
        if (isReadOnly) { toast.warning('Operación no disponible en Modo Demostración.', '🔒 Demo'); return; }
        if (state.firebaseStatus === 'offline') { toast.warning('Sin conexión. Intenta cuando haya internet.', '⚠️ Offline'); return; }
        const product = state.products.find(p => p.id === productId);
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
    }, [isReadOnly, profile]);

    const purchaseCredits = useCallback(async (amount: number, type: 'invoice' | 'maintenance') => {
        if (isReadOnly) { toast.warning('Operación no disponible en Modo Demostración.', '🔒 Demo'); return; }
        try {
            await logAudit({
                type: 'CONFIG_UPDATE', userId: 'SYSTEM', userName: 'Admin', userRole: 'admin',
                description: `Recarga ${type}: +${amount}`, metadata: { amount, type },
            });
            toast.info('Recarga local registrada (Pendiente de implementación en SQLite).');
        } catch (err: any) { console.error(err); }
    }, [isReadOnly]);

    const cancelOrder = useCallback(async (orderId: string) => {
        const state = useERPStore.getState();
        if (isReadOnly || state.firebaseStatus === 'offline') return;
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;

        // BUG-6 FIX: Guardia contra doble cancelación.
        // Si ya está cancelada, no continuar para evitar doble devolución de stock.
        if ((order as any).status === 'cancelled') {
            console.warn(`[BUNKKER/Cancel] La orden ${orderId} ya está cancelada. Ignorando.`);
            return;
        }

        try {
            // BUG-2 FIX: El servidor (PATCH /api/orders con status=cancelled) YA devuelve el stock.
            // Eliminamos el bucle de PATCH /api/products que lo devolvía una segunda vez.
            await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    status: 'cancelled',
                    cancelledAt: new Date().toISOString()
                })
            });

            await logAudit({
                type: 'ORDER_CANCEL', userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Sistema', userRole: profile?.role || 'admin',
                description: `Pedido cancelado: ${orderId}`, metadata: { orderId, refundTotal: order.total },
            });

            // Notificar a otros dispositivos del cambio
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'ORDER_CANCELLED', id: orderId });
            }
        } catch (err: any) { console.error('Error cancelando orden:', err); }
    }, [isReadOnly, profile]);

    const updateSiteConfig = useCallback(async (config: Partial<SiteConfig>) => {
        const state = useERPStore.getState();
        if (isReadOnly) return;
        const merged = { ...state.siteConfig, ...config };
        state.setSiteConfig(merged);
        try {
            // BUG-4 FIX: Guardar con la clave BUNKKER, no la legacy
            localStorage.setItem('_bunkker_site_config', JSON.stringify(merged));
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Admin', userRole: profile?.role || 'admin',
                description: 'Configuración de sitio actualizada localmente', metadata: { config },
            });
        } catch (e) { console.error(e); }
    }, [isReadOnly, profile]);

    return {
        ...store,
        total: store.getTotal(),
        itemCount: store.getItemCount(),
        floatingStock: store.floatingStock || {},
        createOrder, cancelOrder, confirmRequest, startLoading, completeLoading,
        exportInventoryToCSV, sendDailyClosing, updateProductPrice, updateProduct,
        purchaseCredits, updateSiteConfig
    };
};

