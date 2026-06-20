"use client";

import { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import {
    collection,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    increment,
    writeBatch
} from 'firebase/firestore';
import { logAudit } from '@/lib/audit';
import { useAuth } from './AuthContext';
import { reportError, handleFirestoreError, OperationType } from '@/lib/errorMonitor';
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
    const { isReadOnly, profile } = useAuth();
    const setProducts       = useERPStore((s) => s.setProducts);
    const setOrders         = useERPStore((s) => s.setOrders);
    const setOwnerConfig    = useERPStore((s) => s.setOwnerConfig);
    const _setSiteConfig    = useERPStore((s) => s.setSiteConfig);
    const setFirebaseStatus = useERPStore((s) => s.setFirebaseStatus);
    const setLoading        = useERPStore((s) => s.setLoading);

    // ─── Load products from Firestore (with offline fallback) ─────────────────
    useEffect(() => {
        const loadProducts = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'products'));
                if (!snapshot.empty) {
                    setProducts(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Product[]);
                    setFirebaseStatus('online');
                } else if (!isReadOnly) {
                    console.log('[Admin.com ERP] Seeding demo products into Firestore...');
                    const batch = writeBatch(db);
                    fallbackProducts.forEach(p => {
                        batch.set(doc(db, 'products', p.id), p);
                    });
                    await batch.commit();
                    setFirebaseStatus('online');
                } else {
                    setFirebaseStatus('demo');
                }
            } catch (err: any) {
                console.warn('[Admin.com ERP] Firebase unavailable — offline demo mode.', err?.code || err?.message);
                setFirebaseStatus('offline');
            } finally {
                setLoading(false);
            }
        };
        loadProducts();
    }, [isReadOnly, setProducts, setFirebaseStatus, setLoading]);

    // ─── Real-time Firestore listeners (only when online) ─────────────────────
    useEffect(() => {
        const status = useERPStore.getState().firebaseStatus;
        if (status !== 'online') return;

        const handleError = (err: any, op: OperationType, path: string) => {
            console.warn(`[Admin.com ERP] Listener error on ${path}:`, err?.code);
            setFirebaseStatus('offline');
            try { handleFirestoreError(err, op, path); } catch { }
        };

        const unsubs = [
            onSnapshot(collection(db, 'products'), (snap: any) => {
                const updated = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Product[];
                if (updated.length > 0) setProducts(updated);
            }, (err: any) => handleError(err, OperationType.LIST, 'products')),

            onSnapshot(doc(db, 'settings', 'owner_config'), (snap: any) => {
                if (snap.exists()) {
                    const d = snap.data() as any;
                    setOwnerConfig(d.invoiceCredits || 0, d.automationProfit || 0, d.maintenanceCredits || 0);
                }
            }, (err: any) => handleError(err, OperationType.GET, 'settings/owner_config')),

            onSnapshot(collection(db, 'orders'), (snap: any) => {
                const updated = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as Order[];
                setOrders(updated.sort((a, b) => b.date.localeCompare(a.date)));
            }, (err: any) => handleError(err, OperationType.LIST, 'orders')),

            onSnapshot(doc(db, 'settings', 'site_config'), (snap: any) => {
                if (snap.exists()) {
                    _setSiteConfig({ ...defaultSiteConfig, ...(snap.data() as SiteConfig) });
                }
            }, (err: any) => handleError(err, OperationType.GET, 'settings/site_config')),
        ];

        return () => unsubs.forEach(unsub => unsub());
    }, [setProducts, setOrders, setOwnerConfig, _setSiteConfig, setFirebaseStatus]);

    // ─── Offline: restore siteConfig from localStorage ────────────────────────
    useEffect(() => {
        const status = useERPStore.getState().firebaseStatus;
        if (status === 'offline') {
            try {
                const local = localStorage.getItem('_admincom_site_config');
                if (local) _setSiteConfig({ ...defaultSiteConfig, ...JSON.parse(local) });
            } catch { }
        }
    }, [_setSiteConfig]);

    return <>{children}</>;
}

// Custom hook que puentea Zustand para no romper los 32 archivos existentes
export const useCart = () => {
    const { isReadOnly, profile } = useAuth();
    const store = useERPStore();

    // Re-creamos las funciones de negocio aquí para que tengan acceso a profile/auth
    const createOrder = async (
        customerData: { name: string; phone: string; address: string; rfc?: string; regimenFiscal?: string; usoCFDI?: string; deliveryMethod?: string; paymentMethod?: string },
        requiresInvoice: boolean = false,
        isOnline: boolean = false,
        asRequest: boolean = false 
    ) => {
        if (isReadOnly) { alert('🔒 MODO DEMOSTRACIÓN: Los pedidos no se guardan.'); return; }
        if (store.firebaseStatus === 'offline') { console.warn('⚠️ Sin conexión. El pedido se encolará localmente.'); }
        if (store.cart.length === 0) { alert('⚠️ El carrito está vacío.'); return; }

        const orderId = `ORD-${Date.now().toString().slice(-6)}`;
        let orderTotal = store.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const developerFee = isOnline ? (requiresInvoice ? 6 : 1) : 0;
        const ownerAutomationFee = isOnline ? (requiresInvoice ? 5 : 0) : 0;
        orderTotal += (developerFee + ownerAutomationFee);

        if (isOnline && store.maintenanceBalance < developerFee) {
            alert('⚠️ Saldo de sistema insuficiente. Recarga créditos.'); return;
        }

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
        if (asRequest && customerData.deliveryMethod === 'repartidor') {
            finalStatus = 'pending_delivery';
        }

        const newOrder = {
            id: orderId, customer: customerData, customerEmail: customerData.phone,
            items: [...store.cart], total: orderTotal, developerFee, ownerAutomationFee,
            date: new Date().toISOString(), status: isNightQueue ? 'NIGHT_QUEUE' : finalStatus as any,
            paymentMethod: asRequest ? (customerData.paymentMethod || 'Pendiente en Piso') : (isOnline ? 'Online' : 'Venta Directa'), requiresInvoice,
            deliveryMethod: customerData.deliveryMethod || 'tienda'
        };

        try {
            const batch = writeBatch(db);

            // ── Stock: se reserva SIEMPRE al crear la orden para evitar sobreventa.
            // La venta queda "abierta" (pending_confirmation) hasta que caja/pickup
            // confirme el cobro físico y la cierre como 'paid'.
            // Si se cancela, el stock se reintegra automáticamente.

            // 1. Crear la orden — stock ya reservado desde este momento
            batch.set(doc(db, 'orders', orderId), {
                ...newOrder,
                createdAt: serverTimestamp(),
                stockDeducted: true, // siempre true: stock siempre se reserva al ordenar
            });

            // 2. Descontar créditos de mantenimiento si es venta online
            if (isOnline) {
                batch.update(doc(db, 'settings', 'owner_config'), {
                    maintenanceCredits: increment(-developerFee),
                    automationProfit: increment(ownerAutomationFee),
                });
            }

            // 3. Reservar stock — descuento inmediato para prevenir sobreventa
            store.cart.forEach(item => batch.update(doc(db, 'products', item.id), { stock: increment(-item.quantity) }));

            await batch.commit();
            store.clearCart();
            await logAudit({
                type: 'ORDER_CREATE', userId: profile?.uid || 'GUEST',
                userName: profile?.displayName || customerData.name,
                userRole: profile?.role || 'customer',
                description: `Pedido: ${orderId} por ${store.formatCurrency(orderTotal)}`,
                metadata: { orderId, total: orderTotal, stockDeducted: true },
            });
            return orderId;
        } catch (err: any) {
            console.error('Order error:', err);
            try { handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`); } catch { }
            alert('❌ Error al procesar el pedido.');
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
            const batch = writeBatch(db);

            // 1. Marcar orden como pagada + registrar quién cobró
            batch.update(doc(db, 'orders', orderId), { 
                status: 'paid',
                vendedorId: profile?.uid,
                vendedorName: sellerName,
                confirmedAt: serverTimestamp(),
            });

            // Nota: El stock ya fue descontado al crear la orden (stockDeducted: true).
            // Ya no es necesario volver a descontarlo aquí.

            // 2. Sumar KPI al vendedor que confirmó
            if (profile?.uid) {
                batch.update(doc(db, 'users', profile.uid), { kpiScore: increment(order.total || 1) });
            }

            await batch.commit();
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
            await updateDoc(doc(db, 'orders', orderId), { 
                loadedBy: workerName,
                loadedByUid: profile?.uid,
                loadingStartedAt: serverTimestamp()
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
            const batch = writeBatch(db);
            batch.update(doc(db, 'orders', orderId), { 
                isLoaded: true, loadingFinishedAt: serverTimestamp(), status: 'ready_for_delivery'
            });
            if (profile?.uid) {
                batch.update(doc(db, 'users', profile.uid), { kpiScore: increment(50) }); // 50 points per load
            }
            await batch.commit();

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
        const todaysOrders = store.orders.filter(o => o.date.startsWith(today) && o.status === 'paid');
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
            await updateDoc(doc(db, 'products', productId), { price: newPrice });
            await logAudit({
                type: 'PRICE_CHANGE', userId: adminName, userName: adminName, userRole: 'admin',
                description: `Precio ${product.name}: ${store.formatCurrency(product.price)} → ${store.formatCurrency(newPrice)}`,
                metadata: { productId, oldPrice: product.price, newPrice },
            });
        } catch (err: any) { try { handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`); } catch { } }
    };

    const updateProduct = async (productId: string, updates: Partial<Product>, adminName: string) => {
        if (isReadOnly) { alert('🔒 MODO DEMOSTRACIÓN.'); return; }
        if (store.firebaseStatus === 'offline') { alert('⚠️ Sin conexión.'); return; }
        const product = store.products.find(p => p.id === productId);
        if (!product) return;
        try {
            await updateDoc(doc(db, 'products', productId), updates);
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM', userName: adminName, userRole: profile?.role || 'admin',
                description: `Producto editado: ${product.name}`, metadata: { productId, updates },
            });
        } catch (err: any) { try { handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`); } catch { } }
    };

    const purchaseCredits = async (amount: number, type: 'invoice' | 'maintenance') => {
        if (isReadOnly) { alert('🔒 MODO DEMOSTRACIÓN.'); return; }
        if (store.firebaseStatus === 'offline') { alert('⚠️ Sin conexión.'); return; }
        try {
            const field = type === 'invoice' ? 'invoiceCredits' : 'maintenanceCredits';
            await updateDoc(doc(db, 'settings', 'owner_config'), { [field]: increment(amount) });
            await logAudit({
                type: 'CONFIG_UPDATE', userId: 'SYSTEM', userName: 'Admin', userRole: 'admin',
                description: `Recarga ${type}: +${amount}`, metadata: { amount, type },
            });
        } catch (err: any) { try { handleFirestoreError(err, OperationType.UPDATE, 'settings/owner_config'); } catch { } }
    };

    const cancelOrder = async (orderId: string) => {
        if (isReadOnly || store.firebaseStatus === 'offline') return;
        const order = store.orders.find(o => o.id === orderId);
        if (!order) return;
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'orders', orderId), { status: 'cancelled', cancelledAt: serverTimestamp() });
            batch.update(doc(db, 'settings', 'owner_config'), {
                maintenanceCredits: increment(order.developerFee || 0),
                automationProfit: increment(-(order.ownerAutomationFee || 0)),
            });
            // Solo restaurar stock si realmente se había descontado
            // (evita inflar el inventario al cancelar pedidos que nunca lo redujeron)
            if ((order as any).stockDeducted === true) {
                order.items.forEach(item => batch.update(doc(db, 'products', item.id), { stock: increment(item.quantity) }));
            }
            await batch.commit();
            await logAudit({
                type: 'ORDER_CANCEL', userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Sistema', userRole: profile?.role || 'admin',
                description: `Pedido cancelado: ${orderId}`, metadata: { orderId, refundTotal: order.total },
            });
        } catch (err: any) { try { handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`); } catch { } }
    };

    const updateSiteConfig = async (config: Partial<SiteConfig>) => {
        if (isReadOnly) return;
        const merged = { ...store.siteConfig, ...config };
        store.setSiteConfig(merged); // optimistic
        if (store.firebaseStatus === 'offline') {
            try { localStorage.setItem('_admincom_site_config', JSON.stringify(merged)); } catch { }
            return;
        }
        try {
            await setDoc(doc(db, 'settings', 'site_config'), merged, { merge: true });
            await logAudit({
                type: 'CONFIG_UPDATE', userId: profile?.uid || 'SYSTEM',
                userName: profile?.displayName || 'Admin', userRole: profile?.role || 'admin',
                description: 'Configuración de sitio actualizada', metadata: { config },
            });
        } catch (err: any) { try { handleFirestoreError(err, OperationType.UPDATE, 'settings/site_config'); } catch { } }
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

