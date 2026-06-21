"use client";

import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { Truck, Package, CheckCircle2, Play, Loader2, Clock, Search, ArrowLeft, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import Link from 'next/link';

export default function PatioDashboard() {
    const { orders, startLoading, completeLoading } = useCart();
    const { profile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const pendingLoads = useMemo(() => {
        return orders.filter(o => {
            const validStatus = o.status === 'paid' || o.status === 'PREPARANDO' || o.status === 'NIGHT_QUEUE' || o.status === 'PENDIENTE_LLEGADA';
            const notLoaded = !(o as any).isLoaded;
            const custName = o.customer?.name || o.customerName || 'Cliente';
            const matchesSearch = o.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 custName.toLowerCase().includes(searchTerm.toLowerCase());
            return validStatus && notLoaded && matchesSearch;
        }).sort((a, b) => {
            // NIGHT_QUEUE y PENDIENTE_LLEGADA van al final de la fila
            if (a.status === 'NIGHT_QUEUE' || a.status === 'PENDIENTE_LLEGADA') return 1;
            if (b.status === 'NIGHT_QUEUE' || b.status === 'PENDIENTE_LLEGADA') return -1;
            return 0;
        });
    }, [orders, searchTerm]);

    const handleAction = async (orderId: string, action: 'start' | 'complete' | 'postpone' | 'resume') => {
        setProcessingId(orderId);
        try {
            if (action === 'start') {
                await startLoading(orderId);
            } else if (action === 'complete') {
                await completeLoading(orderId);
            } else if (action === 'postpone') {
                await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: orderId, status: 'PENDIENTE_LLEGADA' })
                });
            } else if (action === 'resume') {
                await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: orderId, status: 'PREPARANDO' })
                });
            }
        } catch (error) {
            alert("Error al procesar la acción.");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-400 hover:text-[#0ea5e9] font-bold uppercase text-xs tracking-wider mb-4 transition-colors">
                <ArrowLeft size={16} /> Volver al Tablero
            </Link>
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase italic flex items-center gap-3">
                        <Truck size={36} className="text-[#0ea5e9]" /> Patio de Logística
                    </h1>
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest mt-1">Gestión de Carga y Descarga</p>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Buscar Orden o Cliente..."
                        className="w-full pl-12 pr-4 py-3 bg-slate-800/80 border border-gray-200 rounded-2xl outline-none focus:border-[#0ea5e9] shadow-lg transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </header>

            <div className="grid gap-6">
                {pendingLoads.length === 0 ? (
                    <div className="bg-slate-800/80 border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center">
                        <Package size={64} className="mx-auto text-gray-200 mb-4" />
                        <p className="text-gray-400 font-black uppercase italic text-xl">No hay cargas pendientes</p>
                    </div>
                ) : (
                    pendingLoads.map((order: any) => {
                        const isNight = order.status === 'NIGHT_QUEUE';
                        const isPending = order.status === 'PENDIENTE_LLEGADA';
                        const isDelayed = isNight || isPending;

                        return (
                        <motion.div 
                            key={order.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`bg-slate-800/80 rounded-3xl p-6 border-l-8 shadow-lg flex flex-col md:flex-row justify-between items-center gap-6 ${isNight ? 'border-purple-500 bg-purple-50' : isPending ? 'border-amber-500 bg-amber-50' : order.loadedBy ? 'border-orange-500' : 'border-[#0ea5e9]'}`}
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-black">{order.id}</span>
                                    {isNight && (
                                        <span className="bg-purple-200 text-purple-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                            COLA NOCTURNA (Turno Siguiente)
                                        </span>
                                    )}
                                    {isPending && (
                                        <span className="bg-amber-200 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                            POSPUESTO (Cliente no llega)
                                        </span>
                                    )}
                                    {order.loadedBy && (
                                        <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                                            <Clock size={12} /> En proceso por: {order.loadedBy}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-xl font-black text-gray-800 uppercase">{order.customer?.name || order.customerName || 'Cliente'}</h3>
                                <p className="text-xs text-gray-500 font-bold flex items-center gap-1 mt-1">
                                    <MapPin size={14} className="text-[#0ea5e9] animate-bounce" />
                                    Destino: {order.customer?.address || order.customerAddress || 'Retiro en Sucursal / Local'}
                                </p>
                                <div className="mt-2 flex flex-col gap-2">
                                    {order.items.map((item: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center bg-blue-50 text-[#0ea5e9] px-3 py-2 rounded-lg text-sm font-bold border border-blue-100">
                                            <span>{item.quantity}x {item.product?.name || item.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                {isDelayed ? (
                                    <button 
                                        onClick={() => handleAction(order.id, 'resume')}
                                        disabled={!!processingId}
                                        className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2 justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/10"
                                    >
                                        {processingId === order.id ? <Loader2 className="animate-spin" /> : <Play size={16} />} 
                                        {isNight ? 'Pasar a Fila Activa' : 'Retomar (Llegó el Cliente)'}
                                    </button>
                                ) : !order.loadedBy ? (
                                    <>
                                        <button 
                                            onClick={() => handleAction(order.id, 'start')}
                                            disabled={!!processingId}
                                            className="bg-[#0ea5e9] text-white px-8 py-3 rounded-xl font-black text-xs uppercase flex items-center gap-2 justify-center hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/10"
                                        >
                                            {processingId === order.id ? <Loader2 className="animate-spin" /> : <Play size={16} />} INICIAR CARGA
                                        </button>
                                        <button 
                                            onClick={() => handleAction(order.id, 'postpone')}
                                            disabled={!!processingId}
                                            className="bg-amber-500 text-white px-8 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-2 justify-center hover:bg-amber-600 transition-all shadow-lg shadow-amber-900/10"
                                        >
                                            Posponer
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={() => handleAction(order.id, 'complete')}
                                        disabled={!!processingId || (order.loadedByUid !== profile?.uid && profile?.role !== 'superadmin')}
                                        className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-900/10 disabled:opacity-50"
                                    >
                                        {processingId === order.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />} FINALIZAR
                                    </button>
                                )}
                            </div>
                        </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
