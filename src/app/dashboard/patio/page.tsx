"use client";

import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Truck, Package, CheckCircle2, Play, Loader2, Clock, Search, ArrowLeft, MapPin, QrCode, MessageSquare, X, Bell, PenTool, ShieldCheck, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import BarcodeScanner from '@/components/BarcodeScanner';
import { toast } from '@/lib/toast';
import DeliveryProofModal from '@/components/orders/DeliveryProofModal';
import TicketEntrega from '@/components/TicketEntrega';
import OrderPickingAssistant from '@/components/orders/OrderPickingAssistant';

export default function PatioDashboard() {
    const { orders, startLoading, completeLoading, products, siteConfig } = useCart();
    const { profile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'pending' | 'ready_patio'>('pending');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [scanTargetId, setScanTargetId] = useState<string | null>(null);
    const [notifiedOrder, setNotifiedOrder] = useState<any | null>(null);
    const [orderForDeliveryProof, setOrderForDeliveryProof] = useState<any | null>(null);
    const [deliveredTicketOrder, setDeliveredTicketOrder] = useState<any | null>(null);
    const [pickingOrder, setPickingOrder] = useState<any | null>(null);
    const [deconstructingOrder, setDeconstructingOrder] = useState<any | null>(null);
    const [onlyMyLoads, setOnlyMyLoads] = useState(false);

    // 1. Cargas pendientes de surtir en Almacén destinadas a Patio / Bahía de Carga
    const pendingLoads = useMemo(() => {
        return orders.filter(o => {
            if (onlyMyLoads && o.loadedByUid && o.loadedByUid !== profile?.uid) return false;
            // Exclusivo para pedidos de Patio / Carga pesada (no repartidor ni mostrador general)
            const isPatioOrder = o.deliveryType === 'PATIO' || (o as any).deliveryMethod === 'patio' || (o as any).selectedDeliveryLocation === 'carga';
            const isDelivery = o.deliveryType === 'DELIVERY' || (o as any).deliveryMethod === 'repartidor';
            if (!isPatioOrder || isDelivery) return false;

            const validStatus = ['READY_TO_SHIP', 'paid', 'pending_payment', 'pending_confirmation', 'paid_pending_delivery', 'PREPARANDO', 'READY_FOR_PICKUP', 'NIGHT_QUEUE', 'PENDIENTE_LLEGADA'].includes(o.status);
            const notLoaded = !(o as any).isLoaded && !['DELIVERED', 'READY_FOR_PICKUP_PAID', 'OUT_FOR_DELIVERY', 'COMPLETED'].includes(o.status);
            const custName = o.customer?.name || o.customerName || 'Cliente';
            const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 custName.toLowerCase().includes(searchTerm.toLowerCase());
            return validStatus && notLoaded && matchesSearch;
        }).sort((a, b) => {
            if (a.status === 'NIGHT_QUEUE' || a.status === 'PENDIENTE_LLEGADA') return 1;
            if (b.status === 'NIGHT_QUEUE' || b.status === 'PENDIENTE_LLEGADA') return -1;
            return 0;
        });
    }, [orders, searchTerm, onlyMyLoads, profile?.uid]);

    // 2. Pedidos que Almacén marcó como listos en Bahía de Carga / Patio para entrega directa
    const readyPatioLoads = useMemo(() => {
        return orders.filter(o => {
            if (onlyMyLoads && o.loadedByUid !== profile?.uid && (o as any).deliveryProof?.deliveredByUid !== profile?.uid) return false;
            const isLoaded = (o as any).isLoaded;
            const isPatioLocation = (o.deliveryType === 'PATIO' || (o as any).deliveryMethod === 'patio' || (o as any).selectedDeliveryLocation === 'carga') && o.deliveryType !== 'DELIVERY' && (o as any).deliveryMethod !== 'repartidor';
            const notDelivered = o.status !== 'DELIVERED';
            const custName = o.customer?.name || o.customerName || 'Cliente';
            const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 custName.toLowerCase().includes(searchTerm.toLowerCase());
            return isLoaded && isPatioLocation && notDelivered && matchesSearch;
        });
    }, [orders, searchTerm, onlyMyLoads, profile?.uid]);

    const finalizeOrderAndNotify = async (orderId: string, targetLocation: 'caja' | 'carga' = 'caja') => {
        setProcessingId(orderId);
        try {
            await completeLoading(orderId, targetLocation);
            const order = orders.find(o => o.id === orderId);
            setNotifiedOrder({
                ...(order || { id: orderId }),
                selectedDeliveryLocation: targetLocation,
                deliveryType: targetLocation === 'carga' ? 'PATIO' : 'PICKUP'
            });
            const locationName = targetLocation === 'carga' ? 'Bahía de Carga / Patio' : 'Caja / Mostrador';
            toast.success(`✅ Pedido ${orderId} marcado LISTO en [${locationName}]. Caja y cliente notificados.`);
        } catch (e: any) {
            toast.error(e?.message || 'Error al completar el pedido.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleAction = async (orderId: string, action: 'start' | 'complete' | 'postpone' | 'resume') => {
        setProcessingId(orderId);
        try {
            if (action === 'start') {
                await startLoading(orderId);
            } else if (action === 'complete') {
                setScanTargetId(orderId); // Activa el scanner
            } else if (action === 'postpone') {
                const res = await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: orderId, status: 'PENDIENTE_LLEGADA' })
                });
                if (!res.ok) throw new Error('Error al posponer la orden');
                if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                    (window as any).__inventorySocket.emit('sync_db_event', { action: 'ORDER_POSTPONED', id: orderId });
                }
                toast.success('Orden pospuesta. Se moverá al final de la fila.', '⏰ Pospuesto');
            } else if (action === 'resume') {
                const res = await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: orderId, status: 'PREPARANDO' })
                });
                if (!res.ok) throw new Error('Error al retomar la orden');
                if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                    (window as any).__inventorySocket.emit('sync_db_event', { action: 'ORDER_RESUMED', id: orderId });
                }
                toast.success('Orden retomada. Volviendo a la fila activa.', '▶️ Retomado');
            }
        } catch (error) {
            toast.error('Error al procesar la acción. Intenta de nuevo.');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-sky-400 font-bold uppercase text-xs tracking-wider mb-4 transition-colors">
                <ArrowLeft size={16} /> Volver al Tablero Principal
            </Link>

            <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase italic flex items-center gap-3">
                        <Truck size={36} className="text-sky-400" /> Patio de Logística & Entrega
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-1">
                        Surtido, Designación de Ubicación (Caja / Patio) y Validación PoD (Foto & Firma)
                    </p>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Buscar Orden o Cliente..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl outline-none focus:border-sky-400 text-white shadow-lg transition-all text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            {/* Pestañas de Vista Operacional */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-slate-800/80 pb-3">
                <div className="flex gap-3">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
                            activeTab === 'pending'
                                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/50'
                                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
                        }`}
                    >
                        <Clock size={16} /> Cargas en Preparación ({pendingLoads.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('ready_patio')}
                        className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all ${
                            activeTab === 'ready_patio'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 ring-2 ring-emerald-400/50'
                                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
                        }`}
                    >
                        <PenTool size={16} /> Listos para Entrega en Patio · PoD ({readyPatioLoads.length})
                    </button>
                </div>
                <button
                    onClick={() => setOnlyMyLoads(prev => !prev)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                        onlyMyLoads
                            ? 'bg-sky-500 text-white border-sky-400 shadow-md shadow-sky-500/25'
                            : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                    }`}
                >
                    <span>👤</span> {onlyMyLoads ? 'Viendo: Mis Cargas de Hoy' : 'Ver solo mis cargas'}
                </button>
            </div>

            {scanTargetId && (
                <BarcodeScanner 
                    isOpen={true} 
                    onClose={() => setScanTargetId(null)} 
                    onScanSuccess={async (decodedText) => {
                        if (decodedText.trim().toLowerCase() === scanTargetId.toLowerCase()) {
                            const target = scanTargetId;
                            setScanTargetId(null);
                            await finalizeOrderAndNotify(target, 'carga');
                        } else {
                            toast.warning(`Código incorrecto. Esperaba: ${scanTargetId}, se escaneó: ${decodedText}.`, '❌ Scanner');
                        }
                    }} 
                />
            )}

            {/* VISTA 1: CARGAS EN PREPARACIÓN */}
            {activeTab === 'pending' && (
                <div className="grid gap-4">
                    {pendingLoads.length === 0 ? (
                        <div className="bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-2xl p-16 text-center">
                            <Package size={64} className="mx-auto text-slate-700 mb-4" />
                            <p className="text-slate-400 font-black uppercase italic text-lg">No hay cargas pendientes en almacén</p>
                            <p className="text-xs text-slate-500 mt-1">Los nuevos pedidos registrados en mostrador o tienda aparecerán aquí para su preparación.</p>
                        </div>
                    ) : (
                        pendingLoads.map((order: any) => {
                            const isNight = order.status === 'NIGHT_QUEUE';
                            const isPending = order.status === 'PENDIENTE_LLEGADA';
                            const isDelayed = isNight || isPending;

                            return (
                                <motion.div 
                                    key={order.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`bg-slate-900/90 rounded-2xl p-6 border-l-8 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-800 ${
                                        isNight ? 'border-l-purple-500' : isPending ? 'border-l-amber-500' : order.loadedBy ? 'border-l-sky-400' : 'border-l-slate-700'
                                    }`}
                                >
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                            <span className="bg-slate-800 text-sky-400 px-3 py-1 rounded-lg text-xs font-mono font-black border border-slate-700">
                                                {order.id}
                                            </span>
                                            {order.loadedBy && (
                                                <span className="bg-sky-500/15 text-sky-300 border border-sky-500/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5">
                                                    <Clock size={12} /> Surtido en curso por: {order.loadedBy}
                                                </span>
                                            )}
                                            {isNight && (
                                                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                                                    Cola Nocturna
                                                </span>
                                            )}
                                            {isPending && (
                                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                                                    Pospuesto
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-xl font-black text-white uppercase tracking-tight">
                                            {order.customer?.name || order.customerName || 'Cliente Mostrador'}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-1">
                                            <MapPin size={14} className="text-sky-400" />
                                            Destino: {order.customer?.address || order.customerAddress || 'Retiro en Sucursal / Local'}
                                        </p>

                                        {/* Lista de Artículos a Preparar */}
                                        <div className="mt-4 flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
                                            {(order.items || []).map((item: any, i: number) => {
                                                const fullProduct = products.find((p: any) => p.id === (item.productId || item.id));
                                                const loc = fullProduct?.location;
                                                const locationStr = loc && loc.estante ? `📍 ${loc.estante} · ${loc.fila || 'Nivel 1'}` : '📍 Bodega General';
                                                const qty = item.quantity ?? item.cantidad ?? 1;
                                                const itemName = item.name || item.product?.name || fullProduct?.name || 'Material';
                                                
                                                return (
                                                    <div key={i} className="flex justify-between items-center bg-slate-950/70 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-800">
                                                        <span>{qty}x {itemName}</span>
                                                        <span className="text-[11px] text-sky-400 font-mono">{locationStr}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Botones de Control de Almacén */}
                                    <div className="flex flex-col gap-3 w-full md:w-auto min-w-[240px]">
                                        {isDelayed ? (
                                            <button 
                                                onClick={() => handleAction(order.id, 'resume')}
                                                disabled={!!processingId}
                                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2 justify-center transition-all shadow-lg active:scale-95"
                                            >
                                                {processingId === order.id ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />} 
                                                {isNight ? 'Pasar a Fila Activa' : 'Retomar (Llegó el Cliente)'}
                                            </button>
                                        ) : !order.loadedBy ? (
                                            <div className="flex flex-col gap-2">
                                                <button 
                                                    onClick={() => setPickingOrder(order)}
                                                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 justify-center transition-all shadow-md active:scale-95 border border-purple-400/30"
                                                >
                                                    🤖 Asistente Recolección IA
                                                </button>
                                                <button 
                                                    onClick={() => handleAction(order.id, 'start')}
                                                    disabled={!!processingId}
                                                    className="bg-sky-500 hover:bg-sky-400 text-white px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2 justify-center transition-all shadow-lg shadow-sky-500/25 active:scale-95"
                                                >
                                                    {processingId === order.id ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />} INICIAR SURTIDO
                                                </button>
                                                <button 
                                                    onClick={() => handleAction(order.id, 'postpone')}
                                                    disabled={!!processingId}
                                                    className="bg-slate-800 hover:bg-slate-700 text-amber-300 px-6 py-2 rounded-xl font-bold text-xs uppercase flex items-center gap-2 justify-center transition-all border border-amber-500/20"
                                                >
                                                    Posponer
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                                                <div className="text-[10px] font-black uppercase text-slate-400 text-center tracking-wider mb-1">
                                                    Selecciona ubicación de entrega:
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button 
                                                        onClick={() => finalizeOrderAndNotify(order.id, 'caja')}
                                                        disabled={!!processingId || (order.loadedByUid !== profile?.uid && profile?.role !== 'superadmin')}
                                                        className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-xl font-black text-[11px] uppercase flex flex-col items-center justify-center gap-1 shadow-md shadow-emerald-900/30 disabled:opacity-50 transition-all active:scale-95 text-center"
                                                        title="Marcar listo para que el cliente pase a mostrador/caja"
                                                    >
                                                        {processingId === order.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={16} />}
                                                        <span>LISTO EN CAJA</span>
                                                        <span className="text-[9px] font-normal opacity-80">(Mostrador)</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => finalizeOrderAndNotify(order.id, 'carga')}
                                                        disabled={!!processingId || (order.loadedByUid !== profile?.uid && profile?.role !== 'superadmin')}
                                                        className="bg-sky-600 hover:bg-sky-500 text-white p-3 rounded-xl font-black text-[11px] uppercase flex flex-col items-center justify-center gap-1 shadow-md shadow-sky-900/30 disabled:opacity-50 transition-all active:scale-95 text-center"
                                                        title="Marcar listo para que el cliente pase a la bahía de carga/patio"
                                                    >
                                                        {processingId === order.id ? <Loader2 className="animate-spin" size={14} /> : <Truck size={16} />}
                                                        <span>LISTO EN CARGA</span>
                                                        <span className="text-[9px] font-normal opacity-80">(Patio PoD)</span>
                                                    </button>
                                                </div>
                                                <button 
                                                    onClick={() => handleAction(order.id, 'complete')}
                                                    disabled={!!processingId || (order.loadedByUid !== profile?.uid && profile?.role !== 'superadmin')}
                                                    className="w-full bg-slate-800 text-slate-300 px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-700 transition-colors disabled:opacity-50 mt-1"
                                                >
                                                    <QrCode size={14} /> Escanear Código
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            )}

            {/* VISTA 2: LISTOS PARA ENTREGA EN PATIO (PoD - FOTO & FIRMA) */}
            {activeTab === 'ready_patio' && (
                <div className="grid gap-4">
                    {readyPatioLoads.length === 0 ? (
                        <div className="bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-2xl p-16 text-center">
                            <Truck size={64} className="mx-auto text-slate-700 mb-4" />
                            <p className="text-slate-400 font-black uppercase italic text-lg">No hay pedidos esperando entrega en patio</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Cuando almacén marque un pedido como "LISTO EN CARGA (Patio)", aparecerá aquí para capturar la foto de la camioneta/mercancía y firma del cliente.
                            </p>
                        </div>
                    ) : (
                        readyPatioLoads.map((order: any) => {
                            const isPaid = Boolean(order.confirmedAt) || order.status === 'READY_FOR_PICKUP_PAID' || order.status === 'paid';

                            return (
                                <motion.div 
                                    key={order.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-slate-900/95 rounded-2xl p-6 border-l-8 border-l-emerald-500 shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                                >
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                            <span className="bg-slate-800 text-sky-400 px-3 py-1 rounded-lg text-xs font-mono font-black border border-slate-700">
                                                {order.id}
                                            </span>
                                            <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5">
                                                🏗️ BAHÍA DE CARGA / PATIO
                                            </span>
                                            {isPaid ? (
                                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> PAGO VERIFICADO EN CAJA
                                                </span>
                                            ) : (
                                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
                                                    ⚠️ ESPERA COBRO EN CAJA
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-xl font-black text-white uppercase tracking-tight">
                                            {order.customer?.name || order.customerName || 'Cliente'}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-1">
                                            <MapPin size={14} className="text-sky-400" />
                                            {order.customer?.phone ? `Tel: ${order.customer.phone} · ` : ''}Retiro en Patio
                                        </p>

                                        {/* Resumen de artículos */}
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {(order.items || []).map((it: any, idx: number) => (
                                                <span key={idx} className="bg-slate-950 px-2.5 py-1 rounded-lg text-xs text-slate-300 border border-slate-800 font-medium">
                                                    {it.quantity ?? it.cantidad}x {it.name || 'Material'}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Botón de Captura de Evidencia (Foto + Firma) */}
                                    <div className="w-full md:w-auto min-w-[280px]">
                                        {isPaid ? (
                                            <button
                                                onClick={() => setOrderForDeliveryProof(order)}
                                                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-950/50 transition-all active:scale-95"
                                            >
                                                <PenTool size={18} />
                                                <span>ENTREGAR CON FOTO & FIRMA (PoD)</span>
                                            </button>
                                        ) : (
                                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                                                <span className="text-xs font-bold text-amber-400 block mb-1">
                                                    Requiere Pago en Caja
                                                </span>
                                                <p className="text-[10px] text-slate-400 leading-tight">
                                                    El cliente debe liquidar en caja antes de autorizar la entrega de material en patio.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Modal de Notificación al Cliente / Atajo */}
            <AnimatePresence>
                {notifiedOrder && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl relative text-white"
                        >
                            <button
                                onClick={() => setNotifiedOrder(null)}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"
                            >
                                <X size={20} />
                            </button>

                            <div className="text-center space-y-3">
                                <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                                    <Bell size={28} className="animate-bounce" />
                                </div>
                                <h3 className="text-xl font-black uppercase text-white">
                                    ¡Pedido Surtido y Listo!
                                </h3>
                                <p className="text-xs text-slate-300 leading-relaxed">
                                    El pedido <span className="font-mono text-emerald-400 font-bold">{notifiedOrder.id}</span> ha sido preparado por almacén.
                                </p>
                                <div className="p-3 bg-slate-950/80 rounded-xl border border-white/5 text-[11px] text-slate-400 text-left space-y-1">
                                    <p>• <strong>Ubicación de entrega:</strong> {notifiedOrder.deliveryType === 'PATIO' ? '🏗️ Bahía de Carga / Patio' : '📦 Ventanilla de Caja / Mostrador'}.</p>
                                    <p>• <strong>Caja:</strong> Ahora está habilitada para registrar el cobro.</p>
                                </div>

                                {notifiedOrder.customer?.phone && (
                                    <a
                                        href={`https://wa.me/${String(notifiedOrder.customer.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                            `¡Hola ${notifiedOrder.customer?.name || 'Cliente'}! Tu pedido ${notifiedOrder.id} ya fue preparado por almacén y está listo para entregarse en ${notifiedOrder.deliveryType === 'PATIO' ? 'la bahía de carga / patio' : 'caja/mostrador'}.`
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                                    >
                                        <MessageSquare size={16} /> Avisar al Cliente por WhatsApp
                                    </a>
                                )}

                                <div className="flex gap-2 pt-1">
                                    {notifiedOrder.deliveryType === 'PATIO' && (
                                        <button
                                            onClick={() => {
                                                const toDeliver = notifiedOrder;
                                                setNotifiedOrder(null);
                                                setActiveTab('ready_patio');
                                                setOrderForDeliveryProof(toDeliver);
                                            }}
                                            className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
                                        >
                                            <CheckCircle2 size={16} /> Entregar con Foto & Firma
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setNotifiedOrder(null)}
                                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Captura de Evidencia Fotográfica y Firma Digital PoD */}
            {orderForDeliveryProof && (
                <DeliveryProofModal
                    isOpen={Boolean(orderForDeliveryProof)}
                    onClose={() => setOrderForDeliveryProof(null)}
                    order={orderForDeliveryProof}
                    cajaId="patio_carga_1"
                    cashierName={profile?.displayName || 'Encargado de Patio / Almacén'}
                    onSuccess={(updatedOrder) => {
                        setDeliveredTicketOrder(updatedOrder);
                        const state = require('@/store/useERPStore').useERPStore.getState();
                        if (state.fetchOrders) state.fetchOrders();
                    }}
                />
            )}

            {/* Visor de Ticket Digital con Foto y Firma al finalizar entrega */}
            <AnimatePresence>
                {deliveredTicketOrder && (
                    <div className="fixed inset-0 z-[230] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl p-6 max-w-sm w-full relative shadow-2xl flex flex-col items-center"
                        >
                            <button
                                onClick={() => setDeliveredTicketOrder(null)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-black p-1 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X size={20} />
                            </button>

                            <div className="mb-4 text-center">
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
                                    <CheckCircle2 size={13} /> Entrega Validada en Patio
                                </span>
                            </div>

                            <div className="w-full max-h-[70vh] overflow-y-auto custom-scrollbar border border-gray-200 rounded-xl p-2 bg-gray-50 shadow-inner">
                                <TicketEntrega
                                    order={deliveredTicketOrder}
                                    businessInfo={siteConfig || { businessName: 'BUNKKER E.C.O.S.' }}
                                />
                            </div>

                            <div className="mt-4 flex gap-2 w-full">
                                <button
                                    onClick={() => window.print()}
                                    className="flex-1 py-3 bg-black hover:bg-gray-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Printer size={15} /> Imprimir Ticket
                                </button>
                                <button
                                    onClick={() => setDeliveredTicketOrder(null)}
                                    className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Asistente de Recolección / Carga IA */}
                {pickingOrder && (
                    <OrderPickingAssistant
                        order={pickingOrder}
                        role="patio"
                        mode="picking"
                        onClose={() => setPickingOrder(null)}
                        onComplete={async (orderId) => {
                            setPickingOrder(null);
                            await finalizeOrderAndNotify(orderId, 'carga');
                        }}
                        onDelegate={async (id, target) => {
                            try {
                                const res = await fetch('/api/orders', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id, action: 'delegate_order', targetRole: target })
                                });
                                if (!res.ok) {
                                    const err = await res.json().catch(() => ({}));
                                    throw new Error(err.error || 'Error al delegar pedido');
                                }
                                setPickingOrder(null);
                                if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                                    (window as any).__inventorySocket.emit('sync_db_event', { action: 'ORDER_DELEGATED', id, target });
                                }
                                toast.success(`📦 Pedido delegado exitosamente a ${target.toUpperCase()}`);
                            } catch (err: any) {
                                toast.error(err.message || 'Error al delegar');
                            }
                        }}
                    />
                )}

                {/* Asistente de Deconstrucción IA */}
                {deconstructingOrder && (
                    <OrderPickingAssistant
                        order={deconstructingOrder}
                        role="patio"
                        mode="deconstruction"
                        onClose={() => setDeconstructingOrder(null)}
                        onComplete={async (orderId) => {
                            setDeconstructingOrder(null);
                            toast.success(`✅ Todos los materiales del pedido ${orderId} fueron reingresados a su estante en Patio.`);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
