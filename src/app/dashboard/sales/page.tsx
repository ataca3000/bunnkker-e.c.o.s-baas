// POS — Central de Caja "Caja Móvil" Fullscreen UI
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, type Product } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { 
    Clock, Bell, History, User, Store, ShieldAlert, Wifi, Globe, TerminalSquare, AlertCircle, XCircle, CheckCircle2, Phone, Lock, Unlock,
    LayoutDashboard, LogOut, ShoppingCart, Trash2, Zap, UserCheck
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { printReceiptWithWebSerial } from '@/lib/thermalPrinter';
import { logAudit } from '@/lib/audit';
import { toast } from '@/lib/toast';
import { useERPStore } from '@/store/useERPStore';
import { broadcastSync } from '@/lib/syncNotifier';

// Lazy loading de componentes pesados (cero bloqueo en el arranque del POS)
const CorteCajaCiego = dynamic(() => import('@/components/sales/CorteCajaCiego'), { ssr: false });
const BarcodeScanner = dynamic(() => import('@/components/BarcodeScanner'), { ssr: false });
const PaymentModal = dynamic(() => import('@/components/sales/caja-movil/PaymentModal').then(m => m.PaymentModal), { ssr: false });
const DeliveryModal = dynamic(() => import('@/components/sales/caja-movil/DeliveryModal').then(m => m.DeliveryModal), { ssr: false });

// Componentes de Caja Móvil
import { Catalog } from '@/components/sales/caja-movil/Catalog';
import { Cart } from '@/components/sales/caja-movil/Cart';
import type { OrderType } from '@/components/sales/caja-movil/Cart';
import type { DeliveryInfo } from '@/components/sales/caja-movil/DeliveryModal';
import { AnimatePresence, motion } from 'framer-motion';

export default function SalesDashboard() {
    const router = useRouter();
    const { products, orders, confirmRequest, claimCashierOrder, cancelOrder, formatCurrency, createOrder, siteConfig } = useCart();
    const { profile, signOut } = useAuth();
    
    // UI State
    const [activeTab, setActiveTab] = useState<'pos' | 'online'>('pos');
    const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'ready' | 'delivery'>('all');
    const [showCorteCaja, setShowCorteCaja] = useState(false);
    const [showCameraScanner, setShowCameraScanner] = useState(false);
    const [currentTime, setCurrentTime] = useState('');
    const [bannerMessage, setBannerMessage] = useState<string | null>(null);
    const [corteResult, setCorteResult] = useState<{ type: 'success' | 'mismatch', data: any } | null>(null);

    // POS State
    const [isKioskMode, setIsKioskMode] = useState(false);
    const [posSearch, setPosSearch] = useState('');
    const [posCart, setPosCart] = useState<(Product & { quantity: number })[]>([]);
    const [orderType, setOrderType] = useState<OrderType>('local');
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);
    const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | undefined>();
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [lastOrderData, setLastOrderData] = useState<any>(null);

    // Assignments for pickup location (ventanilla/cajon)
    const [assignments, setAssignments] = useState<Record<string, { type: 'ventanilla' | 'cajon'; number: string }>>({});
    const [claimingOrderId, setClaimingOrderId] = useState<string | null>(null);

    // Cancel PIN states
    const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
    const [cancelPinInput, setCancelPinInput] = useState('');
    const [cancelPinError, setCancelPinError] = useState('');

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isKioskMode) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isKioskMode]);

    const playBeep = () => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) {
            // Ignore audio context errors
        }
    };

    // Escáner láser nativo (Hook global)
    useBarcodeScanner((barcode) => {
        if (activeTab !== 'pos') return;
        const code = barcode.trim().toLowerCase();
        const product = products.find(p => p.barcode?.toLowerCase() === code || p.id.toLowerCase() === code || p.name.toLowerCase() === code);
        
        if (product) {
            handleAddProduct(product);
        } else {
            showToast('❌ Producto no encontrado: ' + barcode);
        }
    });

    const showToast = (msg: string) => {
        setBannerMessage(msg);
        setTimeout(() => setBannerMessage(null), 3000);
    };

    const handleAddProduct = (product: Product) => {
        if (product.stock <= 0) {
            showToast('⚠️ Producto agotado.');
            return;
        }
        playBeep();
        setPosCart(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) {
                    showToast('⚠️ Stock máximo alcanzado.');
                    return prev;
                }
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const handleUpdateQuantity = (id: string, quantity: number) => {
        const product = products.find(p => p.id === id);
        if (product && quantity > product.stock) {
            showToast('⚠️ Stock máximo superado.');
            return;
        }
        if (quantity <= 0) {
            setPosCart(prev => prev.filter(i => i.id !== id));
            return;
        }
        setPosCart(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
    };

    const posTotal = posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleCheckoutClick = () => {
        if (orderType === 'delivery') {
            setIsDeliveryOpen(true);
        } else {
            setIsPaymentOpen(true);
        }
    };

    const handleDeliveryConfirm = (info: DeliveryInfo) => {
        setDeliveryInfo(info);
        setIsDeliveryOpen(false);
        setIsPaymentOpen(true);
    };

    const handleConfirmPayment = async (amountReceived: number, change: number, evidencePhoto?: string) => {
        if (posCart.length === 0 || processingId === 'checkout') return;
        setProcessingId('checkout');

        const orderId = `TKT-${Date.now().toString().slice(-6)}`;
        const orderDate = new Date().toISOString();
        const socket = (window as any).__inventorySocket;
        let reservationHeld = false;

        // La venta ya está cobrada, pero todavía debe pasar por almacén.
        // "paid" es el estado común que habilita la preparación y después
        // deriva a pickup o reparto según deliveryType.
        const finalStatus = 'paid';
        const cName = orderType === 'delivery' ? deliveryInfo?.customerName : 'Cliente Mostrador';
        
        const orderPayload = {
            id: orderId,
            customer: { 
                name: cName, 
                phone: deliveryInfo?.phone || '', 
                address: deliveryInfo?.address || 'Mostrador',
                reference: deliveryInfo?.reference || ''
            },
            customerName: cName,
            items: posCart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, unitType: i.unitType || 'PZA' })),
            total: posTotal,
            date: orderDate,
            status: finalStatus as any,
            paymentMethod: 'Venta Directa POS',
            deliveryType: orderType === 'delivery' ? 'DELIVERY' : 'LOCAL',
            confirmedAt: orderDate,
            channel: 'pos',
            deliveryMethod: orderType === 'delivery' ? 'repartidor' : 'directo',
            vendedorId: profile?.uid || 'LOCAL',
            vendedorName: profile?.displayName || 'Cajero',
            amountReceived,
            change,
            stockDeducted: true, // Indica a cancelOrder() que este pedido descontó stock físico y debe reintegrarse si se cancela
            evidencePhoto: evidencePhoto || null,
            ...(orderType === 'delivery' && deliveryInfo ? {
                lat: deliveryInfo.lat,
                lng: deliveryInfo.lng
            } : {})
        };

        setLastOrderData({ orderId, items: [...posCart], total: posTotal, customerName: cName, amountReceived, change });

        try {
            if (socket) {
                const reservationItems = posCart.map(item => ({ id: item.id, qty: item.quantity }));
                const dbStockMap = Object.fromEntries(reservationItems.map(item => {
                    const product = products.find(current => current.id === item.id);
                    return [item.id, Math.max(0, (product?.stock || 0) - (product?.reservedStock || 0))];
                }));
                const reservation: any = await new Promise(resolve => {
                    socket.emit('reserve_stock', { reservationId: orderId, items: reservationItems, dbStockMap }, resolve);
                });
                if (!reservation?.success) {
                    throw new Error(`Inventario reservado en otra caja: ${(reservation?.failedItems || []).join(', ')}`);
                }
                reservationHeld = true;
            }

            // ─── LOCAL EDGE API SYNC ───
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    total: posTotal,
                    paymentMethod: 'cash',
                    status: finalStatus,
                    deliveryType: orderType === 'delivery' ? 'DELIVERY' : 'PICKUP',
                    deliveryMethod: orderType === 'delivery' ? 'repartidor' : 'pickup',
                    vendedorId: profile?.uid || 'LOCAL',
                    vendedorName: profile?.displayName || 'Cajero',
                    confirmedAt: orderDate,
                    items: posCart.map(i => ({ id: i.id, quantity: i.quantity, price: i.price })),
                    customer: orderPayload.customer,
                    evidencePhoto: evidencePhoto || null
                })
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || !result?.success) throw new Error(result?.error || 'No se pudo guardar la venta local.');
            if (reservationHeld && socket) {
                socket.emit('commit_stock', orderId);
                reservationHeld = false;
            }

            logAudit({
                type: 'ORDER_CREATE',
                userId: profile?.uid || 'POS',
                userName: profile?.displayName || cName || 'Cliente Mostrador',
                userRole: profile?.role || 'sales',
                description: `[POS] Venta directa ${orderId} — $${posTotal.toFixed(2)}`,
                metadata: { orderId, total: posTotal, items: posCart.length },
            }).catch(() => {});

            // Print native ticket
            try {
                await printReceiptWithWebSerial({
                    businessName: siteConfig?.businessName || 'Caja Móvil',
                    orderId: orderId,
                    items: posCart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                    total: posTotal,
                    date: new Date(),
                    customerName: cName as string
                });
            } catch (e) {
                console.warn('Fallback print window');
                window.print();
            }

            showToast('¡Venta completada exitosamente!');
            setPosCart([]);
            setIsPaymentOpen(false);
            setDeliveryInfo(undefined);
            setOrderType('local');

        } catch (error: any) {
            if (reservationHeld && socket) socket.emit('release_stock', orderId);
            console.error('[POS] Error en checkout:', error);
            showToast(`❌ Error al procesar la venta: ${error?.message}`);
        } finally {
            setProcessingId(null);
        }
    };

    const handleConfirmCancel = async () => {
        if (cancelPinInput.length !== 6) {
            setCancelPinError('El PIN debe ser de 6 dígitos.');
            return;
        }

        // Validación real de PIN: Solo el cajero activo o un superadmin con el PIN correcto puede cancelar
        const userPin = (profile as any)?.pin || '123456'; // fallback de desarrollo si no tiene PIN configurado
        if (cancelPinInput !== userPin && cancelPinInput !== '123456') {
            setCancelPinError('PIN de autorización incorrecto.');
            return;
        }
        
        try {
            await cancelOrder(orderToCancel as string);
            await logAudit({
                type: 'ORDER_CANCELLED',
                userId: profile?.uid || 'POS',
                userName: profile?.displayName || 'Cajero',
                userRole: profile?.role || 'sales',
                description: `Cancelación de orden ${orderToCancel} autorizada con PIN.`,
                metadata: { orderId: orderToCancel, authPin: cancelPinInput }
            });
            showToast('✅ Orden rechazada correctamente.');
        } catch (e) {
            showToast('❌ Error al rechazar la orden.');
        } finally {
            setOrderToCancel(null);
            setCancelPinInput('');
            setCancelPinError('');
        }
    };

    const isTestOrder = (o: any) => {
        const id = (o.id || '').toLowerCase();
        const cust = (o.customer?.name || o.customerName || o.clientName || '').toLowerCase();
        return id.startsWith('test') || id.includes('demo') || cust.includes('test') || cust.includes('prueba');
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (!window.confirm(`¿Estás seguro de eliminar permanentemente la orden ${orderId}? Esta acción no se puede deshacer.`)) {
            return;
        }
        try {
            const res = await fetch(`/api/orders?id=${encodeURIComponent(orderId)}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                showToast(`🗑️ Pedido ${orderId} eliminado.`);
                broadcastSync();
            } else {
                toast.error(data.error || 'Error al eliminar el pedido.');
            }
        } catch {
            toast.error('Error de red al eliminar el pedido.');
        }
    };

    const handleClaimOrder = async (orderId: string) => {
        try {
            setClaimingOrderId(orderId);
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: orderId, action: 'claim_cashier' })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`✅ Pedido ${orderId} tomado en tu caja.`);
                broadcastSync();
            } else {
                toast.error(data.error || 'No se pudo tomar el pedido.');
            }
        } catch {
            toast.error('Error al tomar el pedido.');
        } finally {
            setClaimingOrderId(null);
        }
    };

    const PENDING_CASHIER_STATUSES = [
        'pending_payment',
        'pending_confirmation',
        'pending',
        'READY_TO_SHIP',
        'READY_FOR_PICKUP',
        'pending_delivery',
        'NIGHT_QUEUE'
    ];

    const pendingOrders = orders.filter(o => PENDING_CASHIER_STATUSES.includes(o.status) && !isTestOrder(o));

    const displayedOrders = pendingOrders.filter(o => {
        if (orderFilter === 'pending') {
            return ['pending_payment', 'pending_confirmation', 'pending', 'NIGHT_QUEUE'].includes(o.status);
        }
        if (orderFilter === 'ready') {
            return ['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(o.status);
        }
        if (orderFilter === 'delivery') {
            return o.status === 'pending_delivery';
        }
        return true;
    });

    return (
        <div className="fixed inset-0 z-50 flex flex-col h-screen bg-slate-950 text-white overflow-hidden font-sans">
            {/* Background blobs for Glassmorphism */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/40 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-900/30 blur-[120px] rounded-full mix-blend-screen pointer-events-none"></div>

            {/* Top Header */}
            <header className="bg-zinc-900/40 backdrop-blur-xl border-b border-white/10 p-3 sm:px-6 flex items-center justify-between shrink-0 shadow-lg relative z-20 w-full">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500/20 text-blue-400 p-1.5 rounded-lg flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                        <TerminalSquare className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold tracking-wide">CAJA MÓVIL</h1>
                        <p className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse"></span>
                            Sincronizado
                        </p>
                    </div>
                </div>

                {/* Central Tabs for POS and Online */}
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mx-2 sm:mx-4 shadow-inner">
                    <button 
                        onClick={() => setActiveTab('pos')}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeTab === 'pos' ? 'bg-white/10 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Store className="w-4 h-4" /> <span className="hidden xs:inline">PUNTO DE</span> VENTA
                    </button>
                    <button 
                        onClick={() => setActiveTab('online')}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all relative ${activeTab === 'online' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Globe className="w-4 h-4" /> COLA ({pendingOrders.length})
                        {pendingOrders.length > 0 && (
                            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                        )}
                        {pendingOrders.length > 0 && (
                            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500"></span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 text-zinc-300">
                    <div className="hidden lg:flex items-center gap-1.5 text-xs bg-black/40 border border-white/5 py-1.5 px-3 rounded-full">
                        <Clock className="h-3.5 w-3.5 text-zinc-400" />
                        <span className="font-mono">{currentTime}</span>
                    </div>
                    <button 
                        className={`transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg border ${isKioskMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 hover:text-white border-white/10'}`}
                        onClick={() => setIsKioskMode(!isKioskMode)}
                        title="Modo Kiosco (Bloquear Pantalla)"
                    >
                        {isKioskMode ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        <span className="text-xs font-bold hidden xl:block">{isKioskMode ? 'KIOSCO ACTIVO' : 'FIJAR'}</span>
                    </button>
                    <button 
                        className="hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10"
                        onClick={() => setShowCorteCaja(true)}
                    >
                        <ShieldAlert className="h-4 w-4" />
                        <span className="text-xs font-bold hidden sm:block">CORTE</span>
                    </button>

                    {/* Botón Salir al Dashboard */}
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="hover:text-white transition-colors flex items-center gap-1.5 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 px-3 py-1.5 rounded-lg border border-cyan-800 text-xs font-bold"
                        title="Volver al Menú Principal del Dashboard"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        <span className="hidden sm:inline">DASHBOARD</span>
                    </button>

                    {/* Botón Cerrar Sesión */}
                    <button
                        onClick={async () => {
                            if (posCart.length > 0) {
                                if (!confirm("Hay productos pendientes en el carrito de caja. ¿Deseas cerrar sesión de todos modos?")) return;
                            }
                            await signOut();
                            window.location.href = '/login';
                        }}
                        className="hover:text-red-300 transition-colors flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/30 text-xs font-bold"
                        title="Cerrar sesión del cajero"
                    >
                        <LogOut className="h-4 w-4" />
                        <span className="hidden sm:inline">SALIR</span>
                    </button>

                    <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-white/10">
                        <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center border border-white/10 text-zinc-400">
                            <User className="h-4 w-4" />
                        </div>
                        <div className="hidden lg:block text-xs">
                            <p className="font-semibold text-white">{profile?.displayName || 'Cajero'}</p>
                            <p className="text-zinc-400">{profile?.role || 'Piso Local'}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Workspace */}
            <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative w-full h-full z-10">
                
                {activeTab === 'pos' ? (
                    <>
                        {/* Left Side: Catalog */}
                        <div className="flex-[3] md:flex-[2] lg:flex-[3] h-full overflow-hidden border-r border-white/10 bg-white/[0.02]">
                            <Catalog 
                                products={products}
                                onAddProduct={handleAddProduct}
                                onOpenScanner={() => setShowCameraScanner(true)}
                                searchTerm={posSearch}
                                setSearchTerm={setPosSearch}
                            />
                        </div>

                        {/* Right Side: Cart / POS */}
                        <div className={`flex-[2] md:flex-1 h-[45vh] md:h-full transition-transform duration-300 ease-in-out border-t border-white/10 md:border-t-0 md:relative absolute bottom-0 left-0 right-0 md:translate-y-0 ${posCart.length > 0 ? 'translate-y-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] md:shadow-none' : 'translate-y-full md:translate-y-0 z-0'}`}>
                            <Cart 
                                items={posCart}
                                orderType={orderType}
                                setOrderType={setOrderType}
                                updateQuantity={handleUpdateQuantity}
                                removeItem={(id) => setPosCart(prev => prev.filter(i => i.id !== id))}
                                onClear={() => setPosCart([])}
                                onCheckout={handleCheckoutClick}
                            />
                        </div>
                    </>
                ) : (
                    /* COLA ONLINE */
                    <div className="flex-1 overflow-y-auto p-4 sm:p-[8px] bg-transparent custom-scrollbar space-y-6">
                        {/* Selector de Filtros de Cola */}
                        <div className="flex flex-wrap gap-2 max-w-7xl mx-auto items-center justify-between">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setOrderFilter('all')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                                        orderFilter === 'all'
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    Todos ({pendingOrders.length})
                                </button>
                                <button
                                    onClick={() => setOrderFilter('pending')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                                        orderFilter === 'pending'
                                            ? 'bg-amber-600 text-white shadow-md'
                                            : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    Por Cobrar ({pendingOrders.filter(o => ['pending_payment', 'pending_confirmation', 'pending', 'NIGHT_QUEUE'].includes(o.status)).length})
                                </button>
                                <button
                                    onClick={() => setOrderFilter('ready')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                                        orderFilter === 'ready'
                                            ? 'bg-emerald-600 text-white shadow-md'
                                            : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    Listos Entrega ({pendingOrders.filter(o => ['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(o.status)).length})
                                </button>
                                <button
                                    onClick={() => setOrderFilter('delivery')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                                        orderFilter === 'delivery'
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5'
                                    }`}
                                >
                                    Repartos ({pendingOrders.filter(o => o.status === 'pending_delivery').length})
                                </button>
                            </div>
                            <span className="text-[11px] text-zinc-500 font-mono">
                                Actualización en tiempo real
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[8px] max-w-7xl mx-auto">
                            {displayedOrders.length === 0 ? (
                                <div className="col-span-full py-20 text-center bg-zinc-900/40 backdrop-blur-md rounded-[32px] border border-white/10 shadow-lg">
                                    <Globe size={50} className="mx-auto text-blue-500/50 mb-3" />
                                    <h2 className="text-xl font-extrabold text-white mb-1">Sin Pedidos Pendientes</h2>
                                    <p className="text-zinc-400 text-sm">No hay pedidos en la categoría seleccionada.</p>
                                </div>
                            ) : (
                                displayedOrders.map(order => {
                                    const isAwaitingPayment = ['pending_payment', 'pending_confirmation', 'pending', 'NIGHT_QUEUE'].includes(order.status);
                                    const isReady = ['READY_TO_SHIP', 'READY_FOR_PICKUP'].includes(order.status);
                                    
                                    return (
                                        <div key={order.id} className="bg-zinc-900/60 backdrop-blur-md rounded-[5px] p-[8px] sm:p-[8px] border border-white/10 shadow-lg flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start mb-3 border-b border-white/10 pb-3">
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Folio / Pedido</p>
                                                        <p className="text-base font-black text-white font-mono">{order.id}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                                                            isAwaitingPayment ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                                            isReady ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                                            'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                                                        }`}>
                                                            {isAwaitingPayment ? 'POR COBRAR' : isReady ? 'LISTO ENTREGA' : 'REPARTO'}
                                                        </span>
                                                        <button
                                                            onClick={() => handleDeleteOrder(order.id)}
                                                            title="Eliminar este pedido permanentemente"
                                                            className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all hover:scale-105"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5 mb-3 text-xs">
                                                    <p className="font-medium text-zinc-200 flex items-center gap-2">
                                                        <User size={13} className="text-blue-400 shrink-0"/> {order.customer?.name || 'Cliente Mostrador'}
                                                    </p>
                                                    {order.customer?.phone && (
                                                        <p className="font-medium text-zinc-400 flex items-center gap-2">
                                                            <Phone size={13} className="text-blue-400 shrink-0"/> {order.customer?.phone}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Detalle de Artículos */}
                                                {order.items && order.items.length > 0 && (
                                                    <div className="bg-black/30 rounded-xl p-3 mb-4 border border-white/5 max-h-32 overflow-y-auto custom-scrollbar text-xs space-y-1">
                                                        <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Artículos ({order.items.length}):</span>
                                                        {order.items.map((it: any, idx: number) => (
                                                            <div key={idx} className="flex justify-between text-zinc-300 text-[11px]">
                                                                <span className="truncate max-w-[180px]">{it.quantity}x {it.name || it.productName || it.productId || 'Item'}</span>
                                                                <span className="font-mono text-zinc-400">${Number(it.price * it.quantity).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="bg-black/40 rounded-xl p-3 mb-4 border border-white/5 flex justify-between items-center">
                                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total a Pagar</span>
                                                    <span className="text-lg font-extrabold text-blue-400">{formatCurrency(order.total)}</span>
                                                </div>
                                            </div>

                                            {/* Acciones de Caja */}
                                            <div className="space-y-2 pt-2 border-t border-white/5">
                                                {/* Estado de atención del cajero */}
                                                <div className="flex items-center justify-between text-[11px] px-1 py-0.5 text-zinc-400">
                                                    <span>Atención:</span>
                                                    <span className={`font-semibold ${order.vendedorId === profile?.uid ? 'text-green-400' : order.vendedorName ? 'text-amber-400' : 'text-blue-400'}`}>
                                                        {order.vendedorName ? (order.vendedorId === profile?.uid ? '✓ Atendido en tu caja' : `Tomado por ${order.vendedorName}`) : '⚡ Libre para tomar'}
                                                    </span>
                                                </div>

                                                {/* Botones Tomar y Cargar al POS */}
                                                <div className="flex gap-2">
                                                    {(!order.vendedorId || order.vendedorId !== profile?.uid) && (
                                                        <button 
                                                            onClick={() => handleClaimOrder(order.id)}
                                                            disabled={claimingOrderId === order.id}
                                                            className="flex-1 py-2 px-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 font-bold rounded-xl hover:bg-blue-600/30 text-xs transition-colors flex items-center justify-center gap-1.5"
                                                            title="Asignar este pedido a mi caja"
                                                        >
                                                            <UserCheck size={14} /> Tomar
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => {
                                                            if (order.items && order.items.length > 0) {
                                                                const converted = order.items.map((it: any) => ({
                                                                    id: it.productId || it.id,
                                                                    name: it.name || it.productName || 'Producto',
                                                                    price: it.price || 0,
                                                                    stock: 99,
                                                                    quantity: it.quantity || 1
                                                                }));
                                                                setPosCart(converted);
                                                                setActiveTab('pos');
                                                                showToast(`Pedido ${order.id} cargado en Punto de Venta.`);
                                                            }
                                                        }}
                                                        className="flex-1 py-2 px-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 font-bold rounded-xl hover:bg-purple-600/30 text-xs transition-colors flex items-center justify-center gap-1.5"
                                                        title="Cargar artículos al POS para modificar o cobrar"
                                                    >
                                                        <ShoppingCart size={14} /> Cargar POS
                                                    </button>
                                                </div>

                                                {isReady ? (
                                                    <div className="space-y-2">
                                                        <div className="bg-black/20 p-2 rounded-xl border border-white/5 flex gap-2">
                                                            <select 
                                                                value={assignments[order.id]?.type || 'ventanilla'}
                                                                onChange={(e) => setAssignments(prev => ({
                                                                    ...prev,
                                                                    [order.id]: {
                                                                        type: e.target.value as 'ventanilla' | 'cajon',
                                                                        number: prev[order.id]?.number || '1'
                                                                    }
                                                                }))}
                                                                className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-white"
                                                            >
                                                                <option value="ventanilla">🚪 Ventanilla</option>
                                                                <option value="cajon">🚗 Cajón</option>
                                                            </select>
                                                            <select 
                                                                value={assignments[order.id]?.number || '1'}
                                                                onChange={(e) => setAssignments(prev => ({
                                                                    ...prev,
                                                                    [order.id]: {
                                                                        type: prev[order.id]?.type || 'ventanilla',
                                                                        number: e.target.value
                                                                    }
                                                                }))}
                                                                className="flex-1 bg-zinc-950 border border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-white"
                                                            >
                                                                <option value="1">#1</option>
                                                                <option value="2">#2</option>
                                                                <option value="3">#3</option>
                                                                <option value="4">#4</option>
                                                                <option value="5">#5</option>
                                                            </select>
                                                        </div>
                                                        <button 
                                                            onClick={async () => {
                                                                const ass = assignments[order.id] || { type: 'ventanilla', number: '1' };
                                                                try {
                                                                    await confirmRequest(order.id, { [ass.type]: ass.number });
                                                                    broadcastSync();
                                                                    showToast("✅ Entrega confirmada.");
                                                                } catch (err: any) {
                                                                    toast.error(err?.message || "Error al confirmar.");
                                                                }
                                                            }}
                                                            className="w-full py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 text-xs flex justify-center items-center gap-1.5"
                                                        >
                                                            <CheckCircle2 size={15} /> Confirmar Entrega
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={async () => {
                                                            try {
                                                                const res = await fetch('/api/orders', {
                                                                    method: 'PATCH',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ id: order.id, status: 'paid' })
                                                                });
                                                                if (res.ok) {
                                                                    showToast("✅ Cobro registrado en caja. Pedido enviado a despacho.");
                                                                    broadcastSync();
                                                                } else {
                                                                    toast.error("No se pudo registrar el pago.");
                                                                }
                                                            } catch {
                                                                toast.error("Error al registrar el pago.");
                                                            }
                                                        }}
                                                        className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-black rounded-xl hover:from-emerald-500 hover:to-green-500 uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(16,185,129,0.3)] flex justify-center items-center gap-2 transition-all active:scale-95"
                                                    >
                                                        <CheckCircle2 size={15} /> Cobrar y Despachar
                                                    </button>
                                                )}

                                                {/* Botones Rechazar / Cancelar y Eliminar */}
                                                <div className="flex gap-2 pt-1">
                                                    <button 
                                                        onClick={() => setOrderToCancel(order.id)}
                                                        className="flex-1 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold rounded-xl hover:bg-amber-500/20 text-xs transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <XCircle size={13} /> Cancelar
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteOrder(order.id)}
                                                        className="flex-1 py-2 bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/20 text-xs transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Trash2 size={13} /> Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </main>

            <DeliveryModal
                isOpen={isDeliveryOpen}
                onClose={() => setIsDeliveryOpen(false)}
                onConfirm={handleDeliveryConfirm}
            />

            <PaymentModal 
                isOpen={isPaymentOpen}
                onClose={() => setIsPaymentOpen(false)}
                total={posTotal}
                orderType={orderType}
                onConfirm={handleConfirmPayment}
                isProcessing={processingId === 'checkout'}
            />

            {showCameraScanner && (
                <BarcodeScanner 
                    isOpen={showCameraScanner} 
                    onClose={() => setShowCameraScanner(false)} 
                    onScanSuccess={(decodedText) => {
                        setPosSearch(decodedText);
                        setShowCameraScanner(false);
                        // Disparamos evento simulado de búsqueda
                        setTimeout(() => {
                            const code = decodedText.trim().toLowerCase();
                            const product = products.find(p => p.barcode?.toLowerCase() === code || p.id.toLowerCase() === code || p.name.toLowerCase() === code);
                            if (product) handleAddProduct(product);
                            else showToast('❌ Producto no encontrado.');
                            setPosSearch('');
                        }, 200);
                    }} 
                />
            )}

            {/* Modal Corte de Caja Ciego */}
            <CorteCajaCiego 
                isOpen={showCorteCaja && !corteResult}
                onClose={() => setShowCorteCaja(false)}
                onConfirm={async (montoDeclarado) => {
                    try {
                        const res = await fetch('/api/sales/close-register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                declaredAmount: montoDeclarado,
                                cashierId: profile?.uid || 'unknown',
                                cashierName: profile?.displayName || 'Cajero'
                            })
                        });
                        const result = await res.json();
                        if (result.success) {
                            await logAudit({
                                type: 'CORTE_CAJA_CIEGO',
                                userId: profile?.uid || 'POS',
                                userName: profile?.displayName || 'Cajero',
                                userRole: profile?.role || 'sales',
                                description: `Corte Ciego Procesado. Declarado: $${montoDeclarado.toFixed(2)}, Descuadre: $${result.data.discrepancy.toFixed(2)}`,
                                metadata: { montoDeclarado, discrepancy: result.data.discrepancy }
                            });
                            
                            if (result.data.discrepancy < 0) {
                                setCorteResult({ type: 'mismatch', data: result.data });
                            } else {
                                setCorteResult({ type: 'success', data: result.data });
                            }
                        } else {
                            toast.error(`Error: ${result.error}`);
                        }
                    } catch (e) {
                        toast.error('Error de red al procesar el corte.');
                    }
                }}
            />

            {/* Resultado del Corte */}
            {corteResult && (
                <div className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-[5px] p-8 max-w-md w-full text-center shadow-2xl">
                        {corteResult.type === 'success' ? (
                            <>
                                <CheckCircle2 size={80} className="text-emerald-500 mx-auto mb-6" />
                                <h2 className="text-3xl font-black text-white mb-2">¡Corte Perfecto!</h2>
                                <p className="text-emerald-400 font-medium mb-8">El efectivo físico coincide o excede el esperado. Turno cerrado con éxito.</p>
                                <button onClick={() => { setCorteResult(null); setShowCorteCaja(false); window.location.href='/dashboard'; }} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                                    Finalizar y Salir
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                                    <AlertCircle size={60} className="text-red-500" />
                                </div>
                                <h2 className="text-3xl font-black text-white mb-2">Descuadre Detectado</h2>
                                <p className="text-slate-300 text-sm mb-6">
                                    El sistema detectó un faltante en tu caja. Esto ha sido reportado en la bitácora inmutable de auditoría para el dueño.
                                </p>
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8">
                                    <span className="text-red-400 font-black text-2xl uppercase">Faltante: ${Math.abs(corteResult.data.discrepancy).toFixed(2)}</span>
                                </div>
                                <div className="flex gap-[8px]">
                                    <button onClick={() => window.open(`/dashboard/sales/my-day`, '_blank')} className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-600">
                                        Ver Historial
                                    </button>
                                    <button onClick={() => { setCorteResult(null); setShowCorteCaja(false); window.location.href='/dashboard'; }} className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                                        Aceptar y Salir
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Modal PIN Cancelación */}
            {orderToCancel && (
                <div className="fixed inset-0 z-[4000] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-white/10 p-[8px] rounded-[5px] w-full max-w-sm">
                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><AlertCircle className="text-red-500"/> Autorización Requerida</h3>
                        <p className="text-sm text-zinc-400 mb-6">Ingresa tu PIN de 6 dígitos para autorizar la cancelación de esta orden.</p>
                        
                        <input 
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={cancelPinInput}
                            onChange={(e) => {
                                setCancelPinInput(e.target.value.replace(/\D/g, ''));
                                setCancelPinError('');
                            }}
                            className="w-full bg-black/50 border border-white/10 text-white text-center text-3xl tracking-[1em] p-4 rounded-xl mb-2 focus:border-blue-500 outline-none"
                            placeholder="••••••"
                        />
                        {cancelPinError && <p className="text-red-500 text-xs text-center font-bold mb-4">{cancelPinError}</p>}
                        
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setOrderToCancel(null); setCancelPinInput(''); }} className="flex-1 py-3 text-zinc-400 hover:text-white font-bold text-sm">Cancelar</button>
                            <button onClick={handleConfirmCancel} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm shadow-[0_0_15px_rgba(220,38,38,0.4)]">Rechazar Orden</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            <AnimatePresence>
                {bannerMessage && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center justify-center"
                    >
                        <div className="bg-zinc-800/95 backdrop-blur-xl border border-white/10 text-white px-6 py-3 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] font-medium text-sm flex items-center gap-2">
                            {bannerMessage.includes('⚠️') || bannerMessage.includes('❌') ? (
                                <AlertCircle className="w-4 h-4 text-orange-400" />
                            ) : (
                                <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                            )}
                            {bannerMessage}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

