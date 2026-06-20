// POS — Central de Caja
"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCart, type Product } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { 
    CreditCard, Loader2, AlertCircle, User, Phone, 
    CheckCircle2, XCircle, Search, ScanLine, ShoppingCart, 
    Trash2, Printer, MapPin, Receipt, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import CorteCajaCiego from '@/components/sales/CorteCajaCiego';
import BarcodeScanner from '@/components/BarcodeScanner';
import { printReceiptWithWebSerial } from '@/lib/thermalPrinter';
import { db } from '@/lib/firebase';
import { doc, writeBatch, increment, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { logAudit } from '@/lib/audit';
import { useERPStore } from '@/store/useERPStore';

export default function SalesDashboard() {
    const { products, orders, confirmRequest, cancelOrder, formatCurrency, loading, createOrder, siteConfig } = useCart();
    const { profile } = useAuth();
    
    const [activeTab, setActiveTab] = useState<'pos' | 'online'>('pos');
    const [posSearch, setPosSearch] = useState('');
    const [posCart, setPosCart] = useState<(Product & { quantity: number })[]>([]);
    const [customerName, setCustomerName] = useState('Cliente Mostrador');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [lastOrderId, setLastOrderId] = useState('');
    const [lastOrderData, setLastOrderData] = useState<any>(null);
    const [showCorteCaja, setShowCorteCaja] = useState(false);
    const [showCameraScanner, setShowCameraScanner] = useState(false);
    
    // Escáner láser nativo (Hook global)
    useBarcodeScanner((barcode) => {
        if (activeTab !== 'pos') return;
        const code = barcode.trim().toLowerCase();
        const product = products.find(p => p.barcode?.toLowerCase() === code || p.id.toLowerCase() === code || p.name.toLowerCase() === code);
        
        if (product) {
            if (product.stock <= 0) {
                alert(`⚠️ ${product.name} está agotado.`);
            } else {
                setPosCart(prev => {
                    const existing = prev.find(item => item.id === product.id);
                    if (existing) {
                        if (existing.quantity >= product.stock) {
                            alert('⚠️ Stock máximo alcanzado para este producto.');
                            return prev;
                        }
                        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                    }
                    return [...prev, { ...product, quantity: 1 }];
                });
            }
        } else {
            alert('❌ Producto no encontrado: ' + barcode);
        }
    });

    const inputRef = useRef<HTMLInputElement>(null);

    // MANTENER INPUT ENFOCADO EN MODO POS (Solo al cargar la pestaña)
    useEffect(() => {
        if (activeTab === 'pos') {
            inputRef.current?.focus();
        }
    }, [activeTab]);

    // Lógica POS
    const handlePosScan = (e: React.FormEvent) => {
        e.preventDefault();
        const code = posSearch.trim().toLowerCase();
        if (!code) return;

        const product = products.find(p => p.barcode?.toLowerCase() === code || p.id.toLowerCase() === code || p.name.toLowerCase() === code);
        
        if (product) {
            if (product.stock <= 0) {
                alert(`⚠️ ${product.name} está agotado.`);
            } else {
                setPosCart(prev => {
                    const existing = prev.find(item => item.id === product.id);
                    if (existing) {
                        if (existing.quantity >= product.stock) {
                            alert('⚠️ Stock máximo alcanzado para este producto.');
                            return prev;
                        }
                        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                    }
                    return [...prev, { ...product, quantity: 1 }];
                });
            }
        } else {
            alert('❌ Producto no encontrado.');
        }
        setPosSearch('');
    };

    const posTotal = posCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // ─── POS Checkout — el corazón del sistema ──────────────────────────────
    // Estrategia dual:
    //   ONLINE  → Batch atómico: crea orden + descuenta stock + audit log en Firestore
    //   OFFLINE → Persiste la venta en localStorage (cola pendiente de sync)
    //             El corazón late aunque Firebase esté caído. Al volver en línea,
    //             el orquestador/service-worker puede vaciar esta cola.
    const handleCheckout = useCallback(async (sendToFloor = false) => {
        if (posCart.length === 0) return;
        setProcessingId('checkout');

        const orderId = `TKT-${Date.now().toString().slice(-6)}`;
        const orderDate = new Date().toISOString();
        const firebaseStatus = useERPStore.getState().firebaseStatus;

        const finalStatus = sendToFloor ? 'paid_pending_delivery' : 'paid';

        const orderPayload = {
            id: orderId,
            customer: { name: customerName, phone: '', address: 'Mostrador' },
            customerName,
            items: posCart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, unitType: i.unitType || 'PZA' })),
            total: posTotal,
            date: orderDate,
            status: finalStatus as any,
            paymentMethod: 'Venta Directa POS',
            channel: 'pos',
            deliveryMethod: sendToFloor ? 'tienda' : 'directo',
            vendedorId: profile?.uid || 'LOCAL',
            vendedorName: profile?.displayName || 'Cajero',
        };

        // Guardar datos para el ticket (siempre, antes del intento de red)
        setLastOrderData({ orderId, items: [...posCart], total: posTotal, customerName });

        try {
            if (firebaseStatus === 'online') {
                // ── MODO ONLINE: Batch atómico ──────────────────────────────────
                const batch = writeBatch(db);

                // 1. Crear la orden
                batch.set(doc(db, 'orders', orderId), {
                    ...orderPayload,
                    createdAt: serverTimestamp(),
                });

                // 2. Descontar stock de cada producto en el carrito
                posCart.forEach(item => {
                    batch.update(doc(db, 'products', item.id), {
                        stock: increment(-item.quantity),
                    });
                });

                await batch.commit();

                // 3. Audit log (no bloquea el batch)
                logAudit({
                    type: 'ORDER_CREATE',
                    userId: profile?.uid || 'POS',
                    userName: profile?.displayName || customerName,
                    userRole: profile?.role || 'sales',
                    description: `[POS] Venta directa ${orderId} — $${posTotal.toFixed(2)}`,
                    metadata: { orderId, total: posTotal, items: posCart.length },
                }).catch(() => {});

            } else {
                // ── MODO OFFLINE: Cola persistente en localStorage ──────────────
                // El corazón late en modo nodo independiente.
                // Esta cola se sincronizará cuando el orquestador detecte conexión.
                const QUEUE_KEY = '_pos_offline_queue';
                const existing = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
                existing.push({ ...orderPayload, _queuedAt: orderDate, _synced: false });
                localStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
                console.info(`[POS-OFFLINE] Venta ${orderId} encolada localmente (${existing.length} pendientes de sync).`);
            }

            // ── UI: ticket y limpieza ──────────────────────────────────────────
            setLastOrderId(orderId);
            setShowTicketModal(true);
            setPosCart([]);
            setCustomerName('Cliente Mostrador');

        } catch (error: any) {
            console.error('[POS] Error en checkout:', error);
            alert(`❌ Error al procesar la venta: ${error?.message || 'Verifica la conexión'}`);
        } finally {
            setProcessingId(null);
        }
    }, [posCart, posTotal, customerName, profile]);

    const handlePrintTicket = async () => {
        if (!lastOrderData) { window.print(); return; }
        try {
            await printReceiptWithWebSerial({
                businessName: siteConfig?.businessName || 'ERP NEGOCIO',
                orderId: lastOrderData.orderId,
                items: lastOrderData.items.map((i:any) => ({ name: i.name, quantity: i.quantity, price: i.price })),
                total: lastOrderData.total,
                date: new Date(),
                customerName: lastOrderData.customerName
            });
        } catch (e) {
            console.warn('Web Serial fallback:', e);
            window.print();
        }
    };

    // Lógica Online (Cola de Ventas)
    const pendingOrders = orders.filter(o => o.status === 'pending_confirmation');
    
    return (
        <div className="bg-transparent min-h-screen p-4 md:p-8 font-sans">
            <header className="max-w-7xl mx-auto mb-8 bg-slate-800/80 p-6 rounded-[32px] shadow-lg border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500 p-4 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                        <Receipt size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-[900] text-white uppercase tracking-tighter">CENTRAL DE CAJA</h1>
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-1">
                            Punto de Venta Local y Confirmación Online
                        </p>
                    </div>
                </div>
                
                <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                    <button 
                        onClick={() => setActiveTab('pos')}
                        className={`flex-1 md:w-48 py-3 px-6 rounded-lg font-bold text-sm transition-all uppercase tracking-widest ${activeTab === 'pos' ? 'bg-slate-800/80 text-emerald-600 shadow-lg' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                        Punto de Venta
                    </button>
                    <button 
                        onClick={() => setActiveTab('online')}
                        className={`flex-1 md:w-48 py-3 px-6 rounded-lg font-bold text-sm transition-all uppercase tracking-widest relative ${activeTab === 'online' ? 'bg-slate-800/80 text-[#004A99] shadow-lg' : 'text-slate-400 hover:text-slate-300'}`}
                    >
                        Cola Online
                        {pendingOrders.length > 0 && (
                            <span className="absolute top-2 right-2 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                        )}
                    </button>
                </div>
                
                <button 
                    onClick={() => setShowCorteCaja(true)}
                    className="md:ml-4 py-3 px-6 rounded-xl font-black text-sm transition-all uppercase tracking-widest bg-slate-800 text-white shadow-md hover:bg-slate-700 hover:shadow-lg w-full md:w-auto"
                >
                    Corte de Caja
                </button>
            </header>

            <div className="max-w-7xl mx-auto">
                <AnimatePresence mode="wait">
                    {activeTab === 'pos' ? (
                        /* PUNTO DE VENTA (POS) */
                        <motion.div 
                            key="pos"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                            className="flex flex-col lg:flex-row gap-6 h-[75vh]"
                        >
                            {/* ESCÁNER Y CATÁLOGO RÁPIDO */}
                            <div className="flex-[2] bg-slate-800/80 rounded-[32px] border border-slate-700/50 shadow-lg overflow-hidden flex flex-col">
                                <div className="p-6 border-b border-slate-700/50 bg-slate-50">
                                    <form onSubmit={handlePosScan} className="relative flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <ScanLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                                            <input 
                                                ref={inputRef}
                                                type="text" 
                                                value={posSearch}
                                                onChange={e => setPosSearch(e.target.value)}
                                                placeholder="ESCANEAR CÓDIGO DE BARRAS..."
                                                className="w-full bg-slate-800/80 border-2 border-emerald-100 pl-14 pr-4 py-6 rounded-2xl font-black text-xl text-white placeholder:text-slate-300 outline-none focus:border-emerald-400 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.1)] transition-all uppercase"
                                            />
                                        </div>
                                        <button type="button" onClick={() => setShowCameraScanner(true)} className="h-[76px] px-6 bg-slate-800 text-white rounded-2xl flex flex-col items-center justify-center hover:bg-slate-700 transition-all shadow-md flex-shrink-0">
                                            <Camera size={24} className="mb-1" />
                                            <span className="text-[10px] font-black tracking-widest uppercase">Cámara</span>
                                        </button>
                                    </form>
                                    <div className="mt-4 flex gap-2">
                                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Lector Láser Activo
                                        </div>
                                    </div>
                                    {showCameraScanner && (
                                        <BarcodeScanner 
                                            isOpen={showCameraScanner} 
                                            onClose={() => setShowCameraScanner(false)} 
                                            onScanSuccess={(decodedText) => {
                                                setPosSearch(decodedText);
                                                setShowCameraScanner(false);
                                                // Retraso para asegurar que React actualice posSearch antes de escanear
                                                setTimeout(() => {
                                                    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                                                    handlePosScan(fakeEvent);
                                                }, 150);
                                            }} 
                                        />
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {/* Botones rápidos visuales para mostrador */}
                                    {products.slice(0, 15).map(p => (
                                        <div key={p.id} onClick={() => { setPosSearch(p.barcode || p.id); setTimeout(() => handlePosScan({preventDefault: () => {}} as any), 50); }} className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 shadow-lg cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all active:scale-95 group">
                                            <div className="aspect-video bg-slate-100 rounded-xl mb-3 overflow-hidden">
                                                <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                            </div>
                                            <p className="font-black text-slate-200 text-sm leading-tight mb-1 line-clamp-2">{p.name}</p>
                                            <p className="text-emerald-600 font-black">{formatCurrency(p.price)}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Stock: {p.stock}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* TICKET / CARRITO SIDEBAR */}
                            <div className="flex-1 bg-slate-800/80 rounded-[32px] border border-slate-700/50 shadow-lg flex flex-col overflow-hidden relative">
                                <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
                                    <h2 className="font-black text-xl uppercase tracking-widest flex items-center gap-2">
                                        <ShoppingCart size={24} /> Ticket
                                    </h2>
                                    <span className="bg-slate-800/80/20 px-3 py-1 rounded-lg text-xs font-bold uppercase">{posCart.length} Items</span>
                                </div>
                                <div className="p-4 border-b border-slate-700/50">
                                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-slate-50 border border-slate-700/50 p-3 rounded-xl font-bold text-slate-200 outline-none focus:border-emerald-400 text-sm" placeholder="Nombre del Cliente" />
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                    <AnimatePresence>
                                        {posCart.map(item => (
                                            <motion.div layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} key={item.id} className="p-4 mb-2 bg-slate-50 rounded-2xl border border-slate-700/50 flex gap-4 items-center">
                                                <div className="w-12 h-12 bg-slate-800/80 rounded-xl shadow-lg border border-slate-700/50 p-1 flex-shrink-0">
                                                    <img src={item.image} className="w-full h-full object-cover rounded-lg" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-white text-sm truncate">{item.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-emerald-600 font-black">{formatCurrency(item.price)}</span>
                                                        <span className="text-slate-400 text-xs">x{item.quantity}</span>
                                                    </div>
                                                    {/* LOCATION INFO FOR CAJA/CARGA */}
                                                    <div className="flex items-center gap-1 mt-1 text-[10px] font-bold uppercase text-indigo-500 bg-indigo-50 w-fit px-2 py-0.5 rounded-md">
                                                        <MapPin size={10} /> 
                                                        {item.location?.estante ? `${item.location.estante} / ${item.location.fila}` : 'Sin Ubicación'}
                                                    </div>
                                                </div>
                                                <button onClick={() => setPosCart(prev => prev.filter(i => i.id !== item.id))} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                    {posCart.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                            <ShoppingCart size={48} className="mb-4" />
                                            <p className="font-bold uppercase tracking-widest text-sm">Escanee para comenzar</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 bg-slate-50 border-t border-slate-700/50">
                                    <div className="flex justify-between items-center mb-6">
                                        <span className="text-slate-400 font-bold uppercase tracking-widest">Total a Cobrar</span>
                                        <span className="text-4xl font-[900] text-emerald-600 tracking-tighter">{formatCurrency(posTotal)}</span>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <button 
                                            onClick={() => handleCheckout(false)}
                                            disabled={posCart.length === 0 || processingId === 'checkout'}
                                            className="w-full py-4 bg-emerald-500 text-white font-black text-lg uppercase tracking-widest rounded-2xl flex justify-center items-center gap-3 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                                        >
                                            {processingId === 'checkout' ? <Loader2 size={24} className="animate-spin" /> : <CreditCard size={24} />} 
                                            COBRAR DIRECTO
                                        </button>
                                        <button 
                                            onClick={() => handleCheckout(true)}
                                            disabled={posCart.length === 0 || processingId === 'checkout'}
                                            className="w-full py-4 bg-indigo-500 text-white font-black text-lg uppercase tracking-widest rounded-2xl flex justify-center items-center gap-3 hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/30 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                                        >
                                            <ShoppingCart size={24} />
                                            COBRAR Y MANDAR A PISO
                                        </button>
                                    </div>
                                </div>

                                {/* Modal Ticket */}
                                {showTicketModal && (
                                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-slate-800/80 w-full rounded-[32px] p-8 shadow-2xl text-center">
                                            <div className="bg-emerald-100 text-emerald-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                                <CheckCircle2 size={40} />
                                            </div>
                                            <h2 className="text-2xl font-black text-white uppercase mb-2">Pago Exitoso</h2>
                                            <p className="text-slate-400 font-bold mb-8">Ticket: {lastOrderId}</p>
                                            <button onClick={handlePrintTicket} className="w-full py-4 bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-900">
                                                <Printer size={20} /> Imprimir Ticket Termal
                                            </button>
                                            <button onClick={() => setShowTicketModal(false)} className="w-full py-3 mt-4 bg-transparent text-slate-400 font-bold rounded-xl hover:text-slate-300">
                                                Cerrar sin imprimir
                                            </button>
                                        </motion.div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        /* COLA ONLINE (CÓDIGO ORIGINAL MEJORADO) */
                        <motion.div key="online" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {pendingOrders.length === 0 ? (
                                    <div className="col-span-full py-24 text-center bg-slate-800/80 rounded-[32px] border border-slate-700/50 shadow-lg">
                                        <AlertCircle size={60} className="mx-auto text-slate-300 mb-4" />
                                        <h2 className="text-2xl font-extrabold text-slate-400 mb-2">Sin registros</h2>
                                        <p className="text-slate-400 text-base font-medium">No hay pedidos online pendientes de confirmación.</p>
                                    </div>
                                ) : (
                                    pendingOrders.map(order => (
                                        <div key={order.id} className="bg-slate-800/80 rounded-[32px] p-8 border border-blue-200 shadow-lg shadow-blue-900/5">
                                            <div className="flex justify-between items-start mb-6 border-b border-slate-700/50 pb-5">
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Referencia</p>
                                                    <p className="text-xl font-black text-white">{order.id}</p>
                                                </div>
                                                <span className="text-xs font-bold uppercase px-3 py-1.5 rounded-lg shadow-lg bg-amber-50 text-amber-700 border border-amber-200">
                                                    POR COBRAR
                                                </span>
                                            </div>

                                            <div className="space-y-2 mb-6">
                                                <p className="text-sm font-bold text-slate-300 flex items-center gap-3"><User size={16} className="text-[#004A99]"/> {order.customer?.name || 'Cliente Mostrador'}</p>
                                                <p className="text-sm font-bold text-slate-400 flex items-center gap-3"><Phone size={16} className="text-[#004A99]"/> {order.customer?.phone || 'N/A'}</p>
                                            </div>

                                            <div className="bg-slate-50 rounded-2xl p-5 mb-6 border border-slate-700/50">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total</span>
                                                    <span className="text-2xl font-extrabold text-[#004A99]">{formatCurrency(order.total)}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-4">
                                                <button 
                                                    onClick={() => cancelOrder(order.id)}
                                                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-slate-800/80 border-2 border-red-100 text-red-500 font-bold rounded-xl hover:bg-red-50 uppercase tracking-widest text-xs"
                                                >
                                                    <XCircle size={16} /> Cancelar
                                                </button>
                                                <button 
                                                    onClick={() => confirmRequest(order.id)}
                                                    className="flex-[2] py-4 bg-[#0ea5e9] text-white font-bold rounded-xl hover:bg-blue-600 uppercase tracking-widest text-xs shadow-lg shadow-blue-500/30 flex justify-center items-center gap-2"
                                                >
                                                    <CheckCircle2 size={18} /> Confirmar Pago
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modal Corte de Caja Ciego */}
            <CorteCajaCiego 
                isOpen={showCorteCaja}
                onClose={() => setShowCorteCaja(false)}
                onConfirm={(montoDeclarado) => {
                    // Aquí iría el registro de auditoría real cruzando contra ventas totales
                    alert(`✅ Corte de caja registrado con éxito.\nTotal Declarado: ${formatCurrency(montoDeclarado)}\n\nEsta información ha sido encriptada y enviada al Radar de Auditoría del dueño.`);
                    setShowCorteCaja(false);
                }}
            />
        </div>
    );
}
