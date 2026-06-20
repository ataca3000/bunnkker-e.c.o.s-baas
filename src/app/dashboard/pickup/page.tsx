"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Store, CheckCircle, CreditCard, Banknote, Calendar, Clock, Package } from 'lucide-react';
import type { Order } from '@/context/CartContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

export default function PickupDashboard() {
    const { formatCurrency } = useCart();
    const { profile } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Filtrar pedidos que sean para recoger en tienda
        const q = query(
            collection(db, 'orders'),
            where('deliveryMethod', '==', 'tienda')
        );

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const fetchedOrders = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            } as Order));
            
            // Excluir cancelados
            const activeOrders = fetchedOrders.filter((o: Order) => o.status !== 'cancelled');
            setOrders(activeOrders);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const markAsDelivered = async (orderId: string, needsPayment: boolean) => {
        if (needsPayment) {
            const confirmPayment = window.confirm("¿Confirmas que recibiste el pago en CAJA por este pedido?");
            if (!confirmPayment) return;
        }

        try {
            await updateDoc(doc(db, 'orders', orderId), {
                status: needsPayment ? 'paid' : 'delivered',
                deliveredAt: new Date().toISOString()
            });
            if (profile?.uid) {
                await updateDoc(doc(db, 'users', profile.uid), { kpiScore: increment(needsPayment ? 10 : 50) });
            }
        } catch (error) {
            console.error("Error al marcar como entregado:", error);
            alert("Error al actualizar la orden.");
        }
    };

    const pendingPaymentOrders = orders.filter(o => o.status === 'pending_confirmation');
    const readyToDeliverOrders = orders.filter(o => o.status === 'paid');

    return (
        <div className="bg-[#0f111a] min-h-screen text-white p-6 pb-24">
            <div className="max-w-7xl mx-auto">
                <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center gap-3">
                            <Store className="text-cyan-400" />
                            ORGANIZADOR PICKUP (ENTREGAS EN TIENDA)
                        </h1>
                        <p className="text-gray-400 mt-2 text-sm">Gestiona la entrega de pedidos físicos a clientes locales.</p>
                    </div>
                    <div className="bg-slate-800/80/5 border border-white/10 rounded-xl p-4 flex gap-6 items-center backdrop-blur-md">
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
                    <div className="bg-slate-800/80/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                            <div className="bg-yellow-400/20 p-3 rounded-lg text-yellow-400">
                                <Banknote size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-yellow-400">Cobrar en Caja</h2>
                            <span className="ml-auto bg-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full text-sm font-bold">
                                {pendingPaymentOrders.length}
                            </span>
                        </div>

                        <div className="space-y-4">
                            {pendingPaymentOrders.length === 0 ? (
                                <p className="text-gray-500 text-center py-8">No hay pedidos pendientes de cobro.</p>
                            ) : (
                                pendingPaymentOrders.map(order => (
                                    <motion.div 
                                        key={order.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-[#1a1d2d] border border-white/5 rounded-xl p-5 hover:border-yellow-400/30 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-bold text-lg">{order.customer?.name || 'Cliente Mostrador'}</h3>
                                            <span className="text-yellow-400 font-bold text-xl">{formatCurrency(order.total)}</span>
                                        </div>
                                        <div className="text-sm text-gray-400 space-y-1 mb-4">
                                            <p>📞 {order.customer?.phone || 'Sin teléfono'}</p>
                                            <p className="flex items-center gap-2">
                                                <Clock size={14} /> Solicitado: {new Date(order.date || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => markAsDelivered(order.id, true)}
                                            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-black py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                                        >
                                            <CreditCard size={18} /> COBRAR Y ENTREGAR
                                        </button>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* COLUMNA 2: PAGADOS, LISTOS PARA ENTREGAR */}
                    <div className="bg-slate-800/80/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
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
                                        className="bg-[#1a1d2d] border border-cyan-500/20 rounded-xl p-5 shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-shadow relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400"></div>
                                        <div className="flex justify-between items-start mb-3 pl-3">
                                            <h3 className="font-bold text-lg text-white">{order.customer.name}</h3>
                                            <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-500/30">
                                                PAGO VERIFICADO
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-400 space-y-1 mb-4 pl-3">
                                            <p>📞 {order.customer.phone}</p>
                                            <p className="flex items-center gap-2">
                                                <Calendar size={14} /> Fecha: {new Date(order.date || Date.now()).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => markAsDelivered(order.id, false)}
                                            className="w-full bg-cyan-500 hover:bg-cyan-400 text-white font-black py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                                        >
                                            <CheckCircle size={18} /> MARCAR COMO ENTREGADO
                                        </button>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
