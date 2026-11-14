"use client";

import React, { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { 
    Package, CheckCircle2, AlertCircle, ArrowRight, CornerDownRight, 
    RotateCcw, ShieldCheck, MapPin, Layers, CheckSquare
} from 'lucide-react';
import { toast } from '@/lib/toast';

interface MisIncisosEnRecoleccionProps {
    idOperador: string;
    rol: string;
    onOpenAssistant: (order: any, mode?: 'picking' | 'deconstruction') => void;
}

export function MisIncisosEnRecoleccion({
    idOperador,
    rol,
    onOpenAssistant
}: MisIncisosEnRecoleccionProps) {
    const { orders, completeLoading, formatCurrency } = useCart();
    const { profile } = useAuth();
    const [completingId, setCompletingId] = useState<string | null>(null);

    const activeUid = profile?.uid || idOperador;

    // Pedidos asignados al operador en recolección o pendientes de reacomodo
    const myActiveOrders = orders.filter((o: any) => {
        const isMyPicking = o.loadedByUid === activeUid && !['DELIVERED', 'COMPLETED'].includes(o.status);
        const isPendingDeconstruct = o.rejectionReason === 'CANCELADO_PENDIENTE_REACOMODO' || o.status === 'cancelled';
        return isMyPicking || (isPendingDeconstruct && ['inventory', 'carga_descarga', 'driver'].includes(rol));
    });

    const handleFinishQuick = async (order: any, targetLocation: 'caja' | 'carga') => {
        setCompletingId(order.id);
        try {
            await completeLoading(order.id, targetLocation);
            toast.success(`✅ Pedido #${order.id.slice(-6).toUpperCase()} listo para entrega en ${targetLocation.toUpperCase()}.`);
        } catch (err: any) {
            toast.error(err?.message || 'Error al completar la preparación.');
        } finally {
            setCompletingId(null);
        }
    };

    if (myActiveOrders.length === 0) {
        return null; // Si no tiene órdenes activas asignadas, no ocupa espacio
    }

    return (
        <section className="bg-[#0f172a]/80 border border-cyan-900/40 rounded-2xl p-5 shadow-xl backdrop-blur-md mb-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                        <Package size={20} />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">MIS INCISOS EN RECOLECCIÓN & REPARTO</h3>
                        <p className="text-xs text-slate-400">Pedidos que ganaste en la fosa común pendientes de validar o reacomodar</p>
                    </div>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {myActiveOrders.length} {myActiveOrders.length === 1 ? 'pedido activo' : 'pedidos activos'}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {myActiveOrders.map((order: any) => {
                    const isDeconstruction = order.status === 'cancelled' || order.rejectionReason === 'CANCELADO_PENDIENTE_REACOMODO';
                    const items = order.items || [];
                    const isBusy = completingId === order.id;

                    return (
                        <div 
                            key={order.id}
                            className={`p-4 rounded-xl border transition-all ${
                                isDeconstruction 
                                    ? 'bg-rose-950/20 border-rose-500/30 ring-1 ring-rose-500/20' 
                                    : 'bg-slate-900/90 border-cyan-500/30 shadow-md shadow-cyan-950/20'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-bold text-white">
                                            #{order.id.slice(-6).toUpperCase()}
                                        </span>
                                        {isDeconstruction ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                                <RotateCcw size={10} /> Deconstrucción en Rojo
                                            </span>
                                        ) : order.status === 'EN_ESPERA' ? (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                EN ESPERA
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                {order.deliveryType || 'LOCAL'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                                        {order.customer?.name || order.customerName || 'Cliente'}
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-cyan-400">
                                    {formatCurrency(order.total)}
                                </span>
                            </div>

                            {/* Desglose de Incisos */}
                            <div className="my-3 space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
                                {items.map((it: any, idx: number) => {
                                    const pName = it.product?.name || it.name || 'Producto';
                                    const qty = it.cantidad || it.quantity || 1;
                                    const locEstante = it.product?.estante || 'A-1';
                                    const locFila = it.product?.fila || 'F-1';

                                    return (
                                        <div 
                                            key={idx}
                                            className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/80"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <span className="font-mono text-[11px] text-cyan-400 font-bold">
                                                    x{qty}
                                                </span>
                                                <span className="text-slate-200 truncate">{pName}</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0">
                                                {locEstante}/{locFila}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Acciones */}
                            <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                                <button
                                    onClick={() => onOpenAssistant(order, isDeconstruction ? 'deconstruction' : 'picking')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                                        isDeconstruction 
                                            ? 'bg-rose-600 hover:bg-rose-500 text-white' 
                                            : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                                    }`}
                                >
                                    <CheckSquare size={14} />
                                    <span>{isDeconstruction ? 'Deconstruir Inciso por Inciso' : 'Abrir Nota de Preparado'}</span>
                                </button>

                                {!order.isLoaded && !isDeconstruction && (
                                    <button
                                        onClick={() => handleFinishQuick(order, order.deliveryType === 'PATIO' ? 'carga' : 'caja')}
                                        disabled={isBusy}
                                        className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50"
                                        title="Marcar recolección como lista"
                                    >
                                        {isBusy ? 'Guardando...' : 'Entrega Rápida'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

export default MisIncisosEnRecoleccion;
