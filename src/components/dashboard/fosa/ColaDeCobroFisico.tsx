"use client";

import React, { useState, useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { 
    DollarSign, Receipt, Clock, CheckCircle2, 
    CreditCard, ArrowRight, Store, AlertCircle
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface ColaDeCobroFisicoProps {
    idCaja: string;
    onCobrar: (order: any) => void;
}

export function ColaDeCobroFisico({
    idCaja,
    onCobrar
}: ColaDeCobroFisicoProps) {
    const { orders, formatCurrency } = useCart();
    const { profile } = useAuth();

    // Pedidos listos para cobro físico en mostrador o terminal
    const pendingPaymentOrders = useMemo(() => {
        return orders.filter((o: any) => {
            const isTerminal = ['DELIVERED', 'COMPLETED', 'cancelled', 'refunded'].includes(o.status);
            if (isTerminal) return false;
            // No está pagado aún
            const isPaid = Boolean(o.confirmedAt) || o.status === 'paid' || o.status === 'READY_FOR_PICKUP_PAID';
            return !isPaid;
        });
    }, [orders]);

    return (
        <section className="bg-[#0f172a]/80 border border-emerald-900/40 rounded-2xl p-5 shadow-xl backdrop-blur-md mb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <DollarSign size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">COLA COLABORATIVA DE COBRO FÍSICO</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                                Terminal Caja #{idCaja.slice(-4).toUpperCase()}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400">Cualquier cajero libre puede cobrar estos pedidos y emitir el ticket impreso</p>
                    </div>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {pendingPaymentOrders.length} por cobrar
                </span>
            </div>

            {pendingPaymentOrders.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                    No hay pedidos pendientes de cobro en este momento.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                    {pendingPaymentOrders.map((order: any) => {
                        const isPrepared = order.isLoaded;

                        return (
                            <div 
                                key={order.id}
                                className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs font-bold text-white">
                                            #{order.id.slice(-6).toUpperCase()}
                                        </span>
                                        <span className="text-sm font-bold text-emerald-400">
                                            {formatCurrency(order.total)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-300 truncate mt-1">
                                        {order.customer?.name || order.customerName || 'Cliente'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                                        <span>Destino: {order.deliveryType || 'LOCAL'}</span>
                                        <span>·</span>
                                        <span className={isPrepared ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                                            {isPrepared ? 'Mercancía en mostrador' : 'En preparación'}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => onCobrar(order)}
                                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/30 transition-all active:scale-95"
                                >
                                    <Receipt size={14} />
                                    <span>Cobrar y Emitir Ticket</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default ColaDeCobroFisico;
