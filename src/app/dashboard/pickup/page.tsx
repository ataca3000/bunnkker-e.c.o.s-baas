"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, CheckCircle, Calendar, Clock, Package, Banknote, PenTool, Printer, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/toast';
import BarcodeScanner from '@/components/BarcodeScanner';
import DeliveryProofModal from '@/components/orders/DeliveryProofModal';
import TicketEntrega from '@/components/TicketEntrega';
import OrderPickingAssistant from '@/components/orders/OrderPickingAssistant';
import { getOrderLockInfo } from '@/lib/orderWorkflow';
import { Lock } from 'lucide-react';

export default function PickupDashboard() {
    const { formatCurrency, products, orders: allOrders, siteConfig } = useCart();
    const { profile } = useAuth();
    const [scanTargetId, setScanTargetId] = useState<string | null>(null);
    const [orderForDeliveryProof, setOrderForDeliveryProof] = useState<any>(null);
    const [deliveredTicketOrder, setDeliveredTicketOrder] = useState<any>(null);
    const [pickingOrder, setPickingOrder] = useState<any | null>(null);
    const [deconstructingOrder, setDeconstructingOrder] = useState<any | null>(null);
    
    // Filtrar pedidos que sean para recoger en mostrador/tienda (excluyendo patio de carga pesada y repartidor a domicilio)
    const orders = allOrders.filter(o => 
        (['tienda', 'pickup'].includes(o.deliveryMethod || '') || ['PICKUP', 'LOCAL'].includes(o.deliveryType || '')) &&
        o.deliveryMethod !== 'patio' && o.deliveryType !== 'PATIO' &&
        o.deliveryMethod !== 'repartidor' && o.deliveryType !== 'DELIVERY'
    );

    const markAsDelivered = async (orderId: string) => {
        const order = orders.find((item) => item.id === orderId);
        if (!order) {
            toast.error('No se encontró el pedido. Actualiza la pantalla e intenta de nuevo.');
            return;
        }

        if (order.status !== 'READY_FOR_PICKUP_PAID' && !(order.status === 'paid' && order.isLoaded)) {
            toast.warning('Caja debe validar el pago antes de entregar este pedido.');
            return;
        }

        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: orderId,
                    action: 'confirm_pickup_receipt'
                })
            });
            const result = await res.json().catch(() => null);
            if (!res.ok || !result?.success) throw new Error(result?.error || 'No se pudo validar la entrega.');

            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'PICKUP_UPDATED', id: orderId });
            }
            // Trigger local sync manually for immediate update
            const state = require('@/store/useERPStore').useERPStore.getState();
            if (state.fetchOrders) state.fetchOrders();
        } catch (error) {
            console.error("Error al marcar como entregado:", error);
            toast.error('Error al actualizar la orden. Verifica tu conexión.');
        }
    };

    const pendingPaymentOrders = orders.filter(o => o.status === 'READY_FOR_PICKUP');
    const readyToDeliverOrders = orders.filter(o => o.status === 'READY_FOR_PICKUP_PAID' || (o.status === 'paid' && o.isLoaded));

    const handleReleaseClaim = async (orderId: string, slot: 'loading' | 'cashier' = 'loading') => {
        try {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ id: orderId, action: 'release_claim', slot })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) throw new Error(data?.error || 'No se pudo liberar el bloqueo');
            toast.info(`Pedido #${orderId.slice(-6).toUpperCase()} liberado en pizarra.`);
            const state = require('@/store/useERPStore').useERPStore.getState();
            if (state.fetchOrders) state.fetchOrders();
        } catch (err: any) {
            toast.error(err?.message || 'Error al liberar pedido');
        }
    };

    return (
        <div className="bg-[#0f111a] min-h-screen text-white p-[8px] pb-24">
            <div className="max-w-7xl mx-auto">
                <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-[8px]">
                    <div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center gap-3">
                            <Store className="text-cyan-400" />
                            ORGANIZADOR PICKUP (ENTREGAS EN TIENDA)
                        </h1>
                        <p className="text-gray-400 mt-2 text-sm">Gestiona la entrega de pedidos físicos a clientes locales.</p>
                    </div>
                    <div className="bg-slate-800/80/5 border border-white/10 rounded-xl p-4 flex gap-[8px] items-center backdrop-blur-md">
                        <div className="text-center">
                            <div className="text-sm text-gray-400 uppercase tracking-widest font-bold">Por Cobrar</div>
                            <div className="text-2xl font-black text-yellow-400">{pendingPaymentOrders.length}</div>
                        </div>
                        <div className="w-px h-10 bg-slate-800/80/10"></div>
                        <div className="text-center">
                            <div className="text-sm text-gray-400 uppercase tracking-widest font-bold">Listos p/ Entregar</div>
                            <div className="text-2xl font-black text-green-400">{readyToDeliverOrders.length}</div>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* COLUMNA 1: PENDIENTES DE PAGO EN CAJA */}
                    <div className="bg-slate-800/80/5 border border-white/10 rounded-[5px] p-[8px] backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                            <div className="bg-yellow-400/20 p-3 rounded-lg text-yellow-400">
                                <Banknote size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-yellow-400">Preparados, esperan pago en caja</h2>
                            <span className="ml-auto bg-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold">
                                {pendingPaymentOrders.length}
                            </span>
                        </div>

                        <div className="space-y-4">
                            {pendingPaymentOrders.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No hay pedidos pickup preparados esperando a caja.</p>
                            ) : (
                                pendingPaymentOrders.map(order => {
                                    const lockInfo = getOrderLockInfo(order as any, profile?.uid, profile?.role);
                                    return (
                                    <motion.div 
                                        key={order.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-[#1a1d2d] border border-white/5 rounded-xl p-[8px] hover:border-yellow-400/30 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="font-bold text-lg">{order.customer?.name || 'Cliente Mostrador'}</h3>
                                                {lockInfo.isLocked && (
                                                    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        lockInfo.isLockedByOther
                                                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                                            : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                                                    }`}>
                                                        <Lock size={10} /> {lockInfo.lockedRoleLabel}: {lockInfo.lockedByName}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-yellow-400 font-bold text-xl">{formatCurrency(order.total)}</span>
                                        </div>
                                        <div className="text-sm text-gray-400 space-y-1 mb-4">
                                            <p>📞 {order.customer?.phone || 'Sin teléfono'}</p>
                                            <p className="flex items-center gap-2">
                                                <Clock size={14} /> Solicitado: {order.date ? new Date(order.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Sin hora'}
                                                {order.customer?.pickupTime && <span className="ml-2 text-sky-400 font-bold bg-sky-900/30 px-2 rounded">Cita: {order.customer.pickupTime}</span>}
                                            </p>
                                        </div>
                                        
                                        <div className="bg-black/30 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
                                            <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Lista de Materiales</p>
                                            <ul className="space-y-2">
                                                {order.items?.map((item: any, i: number) => {
                                                    const fullProduct = products.find((p: any) => p.id === (item.productId || item.id));
                                                    const loc = fullProduct?.location;
                                                    const locationStr = loc && loc.estante ? `📍 ${loc.estante} - ${loc.fila || 'N/A'}` : '📍 Bodega General';
                                                    
                                                    return (
                                                        <li key={i} className="flex flex-col text-sm text-gray-300">
                                                            <div className="flex items-start gap-2">
                                                                <input type="checkbox" className="mt-1 accent-yellow-500" />
                                                                <span>{item.quantity}x {item.name || fullProduct?.name || 'Producto Desconocido'}</span>
                                                            </div>
                                                            <span className="text-xs text-yellow-500/80 ml-6">{locationStr}</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>

                                        <div className="flex flex-col gap-2 mt-2">
                                            <button
                                                onClick={() => setPickingOrder(order)}
                                                disabled={lockInfo.isLockedByOther && !lockInfo.canAdminOverride}
                                                className="w-full bg-cyan-600/30 hover:bg-cyan-600/50 disabled:opacity-40 text-cyan-200 border border-cyan-500/30 font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                            >
                                                🤖 Asistente de Recolección / Delegar
                                            </button>
                                            {lockInfo.isLocked && (lockInfo.isLockedByMe || lockInfo.canAdminOverride) && (
                                                <button
                                                    onClick={() => handleReleaseClaim(order.id, lockInfo.lockedScope === 'cashier' ? 'cashier' : 'loading')}
                                                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold py-1.5 rounded-lg text-xs transition-all"
                                                >
                                                    Soltar bloqueo
                                                </button>
                                            )}
                                        </div>

                                        <div className="w-full border border-yellow-500/30 bg-yellow-500/10 p-3 text-center text-xs font-bold text-yellow-300 mt-2">
                                            Pasa a Caja para validar el pago antes de entregar.
                                            {order.vendedorName ? ` Caja asignada: ${order.vendedorName}.` : ''}
                                        </div>
                                    </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* COLUMNA 2: PAGADOS, LISTOS PARA ENTREGAR */}
                    <div className="bg-slate-800/80/5 border border-white/10 rounded-[5px] p-[8px] backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                            <div className="bg-cyan-400/20 p-3 rounded-lg text-cyan-400">
                                <Package size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-cyan-400">Listos para Entregar (Ya Pagado)</h2>
                            <span className="ml-auto bg-cyan-400/20 text-cyan-400 px-3 py-1 rounded-full text-sm font-bold">
                                {readyToDeliverOrders.length}
                            </span>
                        </div>

                        <div className="space-y-4">
                            {readyToDeliverOrders.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No hay pedidos pagados para entregar.</p>
                            ) : (
                                readyToDeliverOrders.map(order => (
                                    <motion.div 
                                        key={order.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-[#1a1d2d] border border-cyan-500/20 rounded-xl p-[8px] shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-shadow relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400"></div>
                                        <div className="flex justify-between items-start mb-3 pl-3">
                                            <h3 className="font-bold text-lg text-white">{order.customer?.name || 'Cliente Mostrador'}</h3>
                                            <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-500/30">
                                                PAGO VERIFICADO
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-400 space-y-1 mb-4 pl-3">
                                            <p>📞 {order.customer?.phone || 'Sin teléfono'}</p>
                                            <p className="flex items-center gap-2">
                                                <Calendar size={14} /> Fecha: {order.date ? new Date(order.date).toLocaleDateString() : 'Sin fecha'}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => setOrderForDeliveryProof(order)}
                                            className="w-full bg-cyan-500 hover:bg-cyan-400 text-white font-black py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                                        >
                                            <PenTool size={18} /> ENTREGAR CON FOTO & FIRMA (PoD)
                                        </button>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>

            {/* Modal de Validación de Entrega con Foto y Firma */}
            {orderForDeliveryProof && (
                <DeliveryProofModal
                    isOpen={Boolean(orderForDeliveryProof)}
                    onClose={() => setOrderForDeliveryProof(null)}
                    order={orderForDeliveryProof}
                    cajaId="pickup_1"
                    cashierName={profile?.displayName || 'Encargado Pickup'}
                    onSuccess={(updatedOrder) => {
                        setDeliveredTicketOrder(updatedOrder);
                        const state = require('@/store/useERPStore').useERPStore.getState();
                        if (state.fetchOrders) state.fetchOrders();
                    }}
                />
            )}

            {/* Modal Visor de Ticket con Foto y Firma al finalizar entrega */}
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
                                className="absolute top-3 right-3 text-zinc-500 hover:text-black p-1 rounded-full hover:bg-zinc-100"
                            >
                                <X size={20} />
                            </button>
                            <div className="overflow-y-auto max-h-[75vh] w-full">
                                <TicketEntrega
                                    order={deliveredTicketOrder}
                                    businessInfo={siteConfig || { businessName: 'BUNKKER E.C.O.S.' }}
                                />
                            </div>
                            <div className="mt-4 flex gap-2 w-full">
                                <button
                                    onClick={() => window.print()}
                                    className="flex-1 py-2.5 bg-black text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
                                >
                                    <Printer size={15} /> Imprimir Comprobante
                                </button>
                                <button
                                    onClick={() => setDeliveredTicketOrder(null)}
                                    className="py-2.5 px-4 bg-zinc-200 text-zinc-800 font-bold rounded-xl text-xs"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {scanTargetId && (
                <BarcodeScanner
                    isOpen={true}
                    onClose={() => setScanTargetId(null)}
                    onScanSuccess={async (decodedText: string) => {
                        const target = orders.find(o => o.id.toLowerCase() === decodedText.trim().toLowerCase());
                        if (!target) {
                            toast.warning('El ticket no corresponde a ningún pedido preparado.');
                            return;
                        }
                        setScanTargetId(null);
                        setOrderForDeliveryProof(target);
                    }}
                />
            )}

            {/* Asistente de Recolección / Surtido IA */}
            {pickingOrder && (
                <OrderPickingAssistant
                    order={pickingOrder}
                    role="pickup"
                    mode="picking"
                    onClose={() => setPickingOrder(null)}
                    onComplete={async (orderId) => {
                        setPickingOrder(null);
                        toast.success(`✅ Pedido ${orderId} surtido en mostrador de Pickup.`);
                        const state = require('@/store/useERPStore').useERPStore.getState();
                        if (state.fetchOrders) state.fetchOrders();
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
                            toast.success(`📦 Pedido delegado exitosamente a ${target.toUpperCase()}`);
                            const state = require('@/store/useERPStore').useERPStore.getState();
                            if (state.fetchOrders) state.fetchOrders();
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
                    role="pickup"
                    mode="deconstruction"
                    onClose={() => setDeconstructingOrder(null)}
                    onComplete={async (orderId) => {
                        setDeconstructingOrder(null);
                        toast.success(`✅ Artículos del pedido ${orderId} regresados a anaquel.`);
                    }}
                />
            )}
        </div>
    );
}

