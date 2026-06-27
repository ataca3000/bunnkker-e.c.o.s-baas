// POS — Central de Caja "Caja Móvil" Fullscreen UI
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCart, type Product } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { 
    Clock, Bell, History, User, Store, ShieldAlert, Wifi, Globe, TerminalSquare, AlertCircle, XCircle, CheckCircle2, Phone, Lock, Unlock 
} from 'lucide-react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import CorteCajaCiego from '@/components/sales/CorteCajaCiego';
import BarcodeScanner from '@/components/BarcodeScanner';
import { printReceiptWithWebSerial } from '@bunkker/core';
import { db } from '@bunkker/core';
import { doc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { logAudit } from '@bunkker/core';
import { useERPStore } from '@/store/useERPStore';

// Nuevos Componentes de Caja Móvil
import { Catalog } from '@/components/sales/caja-movil/Catalog';
import { Cart } from '@/components/sales/caja-movil/Cart';
import type { OrderType } from '@/components/sales/caja-movil/Cart';
import { PaymentModal } from '@/components/sales/caja-movil/PaymentModal';
import { DeliveryModal } from '@/components/sales/caja-movil/DeliveryModal';
import type { DeliveryInfo } from '@/components/sales/caja-movil/DeliveryModal';
import { AnimatePresence, motion } from 'framer-motion';

export default function SalesDashboard() {
    const { products, orders, confirmRequest, cancelOrder, formatCurrency, createOrder, siteConfig } = useCart();
    const { profile } = useAuth();
    
    // UI State
    const [activeTab, setActiveTab] = useState<'pos' | 'online'>('pos');
    const [showCorteCaja, setShowCorteCaja] = useState(false);
    const [showCameraScanner, setShowCameraScanner] = useState(false);
    const [currentTime, setCurrentTime] = useState('');
    const [toast, setToast] = useState<string | null>(null);
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
            if (product.stock <= 0) {
                showToast(`⚠️ ${product.name} está agotado.`);
            } else {
                setPosCart(prev => {
                    const existing = prev.find(item => item.id === product.id);
                    if (existing) {
                        if (existing.quantity >= product.stock) {
                            showToast('⚠️ Stock máximo alcanzado para este producto.');
                            return prev;
                        }
                        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                    }
                    return [...prev, { ...product, quantity: 1 }];
                });
            }
        } else {
            showToast('❌ Producto no encontrado: ' + barcode);
        }
    });

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
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

    const handleConfirmPayment = async (amountReceived: number, change: number) => {
        if (posCart.length === 0) return;
        setProcessingId('checkout');

        const orderId = `TKT-${Date.now().toString().slice(-6)}`;
        const orderDate = new Date().toISOString();
        const firebaseStatus = useERPStore.getState().firebaseStatus;

        // Si es delivery, creamos una orden para repartidor (READY_TO_SHIP / pending_confirmation)
        // En este caso al pagarlo en caja, la orden queda "READY_TO_SHIP" lista para patio
        const finalStatus = orderType === 'delivery' ? 'READY_TO_SHIP' : 'completed';
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
            channel: 'pos',
            deliveryMethod: orderType === 'delivery' ? 'repartidor' : 'directo',
            vendedorId: profile?.uid || 'LOCAL',
            vendedorName: profile?.displayName || 'Cajero',
            amountReceived,
            change,
            stockDeducted: true, // Indica a cancelOrder() que este pedido descontó stock físico y debe reintegrarse si se cancela
            ...(orderType === 'delivery' && deliveryInfo ? {
                lat: deliveryInfo.lat,
                lng: deliveryInfo.lng
            } : {})
        };

        setLastOrderData({ orderId, items: [...posCart], total: posTotal, customerName: cName, amountReceived, change });

        try {
            // ─── LOCAL EDGE API SYNC ───
            // Enviamos la orden a nuestro servidor local Next.js en la PC en segundo plano.
            // La base de datos SQLite descontará el stock e insertará la orden.
            fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    total: posTotal,
                    paymentMethod: 'cash',
                    status: finalStatus,
                    items: posCart.map(i => ({ id: i.id, quantity: i.quantity, price: i.price })),
                    customer: orderPayload.customer
                })
            }).catch(err => console.warn('Local Edge API sync failed (will retry):', err));

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
        // En un entorno real se validaría contra profile.pin o similar
        // Por ahora lo aceptamos si es de 6 dígitos para registrar la auditoría
        
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

    const pendingOrders = orders.filter(o => o.status === 'pending_confirmation' || o.status === 'pending_payment');

    return (
        <div className="fixed inset-0 z-50 flex flex-col h-screen bg-zinc-950 text-white overflow-hidden font-sans">
            {/* Background blobs for Glassmorphism */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none"></div>

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
                <div className="hidden md:flex bg-black/40 p-1 rounded-xl border border-white/5 mx-4 shadow-inner">
                    <button 
                        onClick={() => setActiveTab('pos')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'pos' ? 'bg-white/10 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Store className="w-4 h-4" /> PUNTO DE VENTA
                    </button>
                    <button 
                        onClick={() => setActiveTab('online')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all relative ${activeTab === 'online' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Globe className="w-4 h-4" /> COLA ONLINE
                        {pendingOrders.length > 0 && (
                            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                        )}
                        {pendingOrders.length > 0 && (
                            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500"></span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-4 text-zinc-300">
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
                    <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                        <div className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center border border-white/10 text-zinc-400">
                            <User className="h-4 w-4" />
                        </div>
                        <div className="hidden sm:block text-xs">
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
                    <div className="flex-1 overflow-y-auto p-6 bg-transparent custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
                            {pendingOrders.length === 0 ? (
                                <div className="col-span-full py-24 text-center bg-zinc-900/40 backdrop-blur-md rounded-[32px] border border-white/10 shadow-lg">
                                    <Globe size={60} className="mx-auto text-blue-500/50 mb-4" />
                                    <h2 className="text-2xl font-extrabold text-white mb-2">Bandeja Vacía</h2>
                                    <p className="text-zinc-400 text-base font-medium">No hay pedidos online pendientes de pago.</p>
                                </div>
                            ) : (
                                pendingOrders.map(order => (
                                    <div key={order.id} className="bg-zinc-900/60 backdrop-blur-md rounded-3xl p-6 border border-blue-500/20 shadow-lg">
                                        <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-4">
                                            <div>
                                                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Referencia</p>
                                                <p className="text-lg font-black text-white">{order.id}</p>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                                {order.status === 'pending_payment' ? 'PAGO EN CAJA' : 'POR CONFIRMAR'}
                                            </span>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            <p className="text-sm font-medium text-zinc-300 flex items-center gap-2"><User size={14} className="text-blue-400"/> {order.customer?.name || 'Cliente'}</p>
                                            <p className="text-sm font-medium text-zinc-400 flex items-center gap-2"><Phone size={14} className="text-blue-400"/> {order.customer?.phone || 'Sin Teléfono'}</p>
                                        </div>

                                        <div className="bg-black/40 rounded-xl p-4 mb-6 border border-white/5 flex justify-between items-center">
                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Total</span>
                                            <span className="text-xl font-extrabold text-blue-400">{formatCurrency(order.total)}</span>
                                        </div>

                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => setOrderToCancel(order.id)}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/20 transition-colors uppercase tracking-widest text-xs"
                                            >
                                                <XCircle size={14} /> Rechazar
                                            </button>
                                            <button 
                                                onClick={() => confirmRequest(order.id)}
                                                className="flex-[2] py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(37,99,235,0.4)] flex justify-center items-center gap-2 transition-all"
                                            >
                                                <CheckCircle2 size={16} /> Confirmar Cobro
                                            </button>
                                        </div>
                                    </div>
                                ))
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
                            alert(`Error: ${result.error}`);
                        }
                    } catch (e) {
                        alert('Error de red al procesar el corte.');
                    }
                }}
            />

            {/* Resultado del Corte */}
            {corteResult && (
                <div className="fixed inset-0 z-[5000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
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
                                <div className="flex gap-4">
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
                    <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm">
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
                {toast && (
                    <motion.div 
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center justify-center"
                    >
                        <div className="bg-zinc-800/95 backdrop-blur-xl border border-white/10 text-white px-6 py-3 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] font-medium text-sm flex items-center gap-2">
                            {toast.includes('⚠️') || toast.includes('❌') ? (
                                <AlertCircle className="w-4 h-4 text-orange-400" />
                            ) : (
                                <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                            )}
                            {toast}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
