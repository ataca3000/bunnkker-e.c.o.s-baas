"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, Circle, Package, MapPin, Truck, Store, 
    Sparkles, RefreshCw, X, ShieldCheck, ArrowLeftRight,
    CornerDownRight, ThumbsUp, SkipForward, CheckCheck,
    Layers, ShoppingCart, User, Clock, ArrowRight
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface MultiOrderPickingAssistantProps {
    orders: any[]; // Lista de 1 o más órdenes seleccionadas
    role: 'sales' | 'inventory' | 'carga' | 'pickup' | 'driver' | string;
    onClose: () => void;
    onCompleteOrder: (orderId: string, targetRole: 'caja' | 'carga' | 'pickup') => Promise<void> | void;
    onBatchCompleteAll?: (orderIds: string[], targetRole: 'caja' | 'carga' | 'pickup') => Promise<void> | void;
}

export default function MultiOrderPickingAssistant({
    orders = [],
    role,
    onClose,
    onCompleteOrder,
    onBatchCompleteAll
}: MultiOrderPickingAssistantProps) {
    // Vista: 'by_order' (pestañas por pedido) o 'by_shelf' (ruta unificada por estantes)
    const [viewMode, setViewMode] = useState<'by_order' | 'by_shelf'>('by_order');
    const [selectedOrderIndex, setSelectedOrderIndex] = useState(0);

    // Estado de checks: key = `${orderId}__${itemId}`
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [completedOrderIds, setCompletedOrderIds] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const safeOrders = orders || [];
    const activeOrder = safeOrders[selectedOrderIndex] || safeOrders[0];

    // Toggle de un ítem en una orden específica
    const toggleItem = (orderId: string, itemId: string) => {
        const key = `${orderId}__${itemId}`;
        setCheckedItems(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Verificar si todos los ítems de un pedido específico están marcados
    const isOrderFullyChecked = (order: any) => {
        const items = order.items || [];
        if (items.length === 0) return false;
        return items.every((item: any) => {
            const key = `${order.id}__${item.productId || item.id}`;
            return !!checkedItems[key];
        });
    };

    // Marcar todos los ítems de una orden activa
    const handleCheckAllForOrder = (order: any) => {
        const next = { ...checkedItems };
        (order.items || []).forEach((item: any) => {
            const key = `${order.id}__${item.productId || item.id}`;
            next[key] = true;
        });
        setCheckedItems(next);
        toast.success(`Todos los artículos de ${order.id} listos en la cesta.`);
    };

    // Agrupación unificada por Estante/Ubicación (Ruta Óptima de Bodega)
    const shelfRoute = useMemo(() => {
        const shelfMap: Record<string, { shelfName: string; items: { orderId: string; customerName: string; item: any }[] }> = {};

        orders.forEach(order => {
            (order.items || []).forEach((item: any) => {
                const estante = item?.product?.location?.estante || item?.product?.estante || item?.location?.estante || 'Bodega General';
                const fila = item?.product?.location?.fila || item?.product?.fila || item?.location?.fila || 'Nivel 1';
                const shelfKey = `${estante} · ${fila}`;

                if (!shelfMap[shelfKey]) {
                    shelfMap[shelfKey] = { shelfName: shelfKey, items: [] };
                }
                shelfMap[shelfKey].items.push({
                    orderId: order.id,
                    customerName: order.customer?.name || order.customerName || 'Cliente',
                    item
                });
            });
        });

        return Object.values(shelfMap);
    }, [orders]);

    // Progreso global de toda la recolección
    const totalGlobalItems = useMemo(() => {
        return orders.reduce((acc, o) => acc + (o.items || []).length, 0);
    }, [orders]);

    const checkedGlobalCount = useMemo(() => {
        return Object.values(checkedItems).filter(Boolean).length;
    }, [checkedItems]);

    const globalPercent = totalGlobalItems > 0 ? Math.round((checkedGlobalCount / totalGlobalItems) * 100) : 0;

    // Completar una orden y delegar a Caja o Patio
    const handleFinalizeSingleOrder = async (order: any, target: 'caja' | 'carga' | 'pickup') => {
        if (!isOrderFullyChecked(order)) {
            toast.warning(`Aún faltan artículos por recolectar en el pedido ${order.id}`);
            return;
        }
        setIsSubmitting(true);
        try {
            await onCompleteOrder(order.id, target);
            setCompletedOrderIds(prev => ({ ...prev, [order.id]: true }));
            toast.success(`✅ Pedido ${order.id} recolectado y enviado a ${target.toUpperCase()}`);
            // Avanzar al siguiente pedido no completado si hay
            const nextIdx = orders.findIndex((o, idx) => idx !== selectedOrderIndex && !completedOrderIds[o.id]);
            if (nextIdx !== -1) {
                setSelectedOrderIndex(nextIdx);
            }
        } catch (e: any) {
            toast.error(e?.message || 'Error al completar recolección');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!orders || orders.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[195] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-zinc-950/95 border border-cyan-500/30 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-white relative"
            >
                {/* Header superior */}
                <div className="p-4 bg-zinc-900/90 border-b border-white/10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 border border-cyan-500/40 shadow-inner">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black uppercase text-white tracking-wide">
                                    Recolección Multipedido en Cesta
                                </h2>
                                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                                    {orders.length} pedidos simultáneos
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400">
                                Recolecta varios pedidos en un solo recorrido con checklist y verificación en cesta.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Selector de modo: Por Pedido vs Por Estante */}
                        <div className="flex bg-black/60 p-1 rounded-xl border border-white/10">
                            <button
                                onClick={() => setViewMode('by_order')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === 'by_order' 
                                        ? 'bg-cyan-500 text-black shadow-md' 
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                Por Pedido
                            </button>
                            <button
                                onClick={() => setViewMode('by_shelf')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === 'by_shelf' 
                                        ? 'bg-cyan-500 text-black shadow-md' 
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                Ruta de Estantes
                            </button>
                        </div>

                        <button 
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Barra de progreso global */}
                <div className="px-5 py-2.5 bg-zinc-900/40 border-b border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                        <ShoppingCart className="w-4 h-4 text-cyan-400" />
                        <span>Artículos en Cesta: <strong className="text-white">{checkedGlobalCount}</strong> de <strong className="text-white">{totalGlobalItems}</strong></span>
                    </div>
                    <div className="flex-1 max-w-md bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-white/10">
                        <div 
                            className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-300 rounded-full"
                            style={{ width: `${globalPercent}%` }}
                        />
                    </div>
                    <span className="text-xs font-mono font-black text-cyan-400">{globalPercent}%</span>
                </div>

                {/* Selector de pestañas de órdenes si está en modo 'by_order' */}
                {viewMode === 'by_order' && (
                    <div className="px-4 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                        {orders.map((o, idx) => {
                            const isSelected = selectedOrderIndex === idx;
                            const isDone = completedOrderIds[o.id] || isOrderFullyChecked(o);

                            return (
                                <button
                                    key={o.id}
                                    onClick={() => setSelectedOrderIndex(idx)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 border ${
                                        isSelected 
                                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/30' 
                                            : isDone
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                : 'bg-zinc-900/60 text-zinc-400 hover:text-white border-white/5'
                                    }`}
                                >
                                    {isDone ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                        <Circle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                    )}
                                    <span className="font-mono">{o.id}</span>
                                    <span className="text-zinc-500 truncate max-w-[100px]">
                                        ({o.customer?.name?.split(' ')[0] || o.customerName?.split(' ')[0] || 'Cliente'})
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Contenido principal */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                    {viewMode === 'by_order' ? (
                        /* Vista individual por orden seleccionada */
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-zinc-900/60 rounded-xl border border-white/5">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-black text-cyan-400">{activeOrder.id}</span>
                                        <span className="text-xs text-zinc-300 font-bold">
                                            {activeOrder.customer?.name || activeOrder.customerName || 'Cliente'}
                                        </span>
                                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/5">
                                            Destino: {activeOrder.deliveryType === 'PATIO' ? 'Patio / Bahía' : 'Caja / Mostrador'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-1">
                                        {(activeOrder.items || []).length} artículos a recolectar en bodega.
                                    </p>
                                </div>

                                <button
                                    onClick={() => handleCheckAllForOrder(activeOrder)}
                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5 transition-all"
                                >
                                    <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Marcar todos listos</span>
                                </button>
                            </div>

                            {/* Checklist de productos del pedido activo */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(activeOrder.items || []).map((item: any) => {
                                    const itemId = item.productId || item.id;
                                    const key = `${activeOrder.id}__${itemId}`;
                                    const isChecked = !!checkedItems[key];
                                    const estante = item?.product?.location?.estante || item?.product?.estante || item?.location?.estante || 'Bodega';
                                    const fila = item?.product?.location?.fila || item?.product?.fila || item?.location?.fila || 'Gral';

                                    return (
                                        <div
                                            key={itemId}
                                            onClick={() => toggleItem(activeOrder.id, itemId)}
                                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                                isChecked
                                                    ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                                                    : 'bg-zinc-900/60 hover:bg-zinc-900 border-white/5 hover:border-cyan-500/30'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <button
                                                    type="button"
                                                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                                        isChecked 
                                                            ? 'bg-emerald-500 text-black font-black' 
                                                            : 'border border-zinc-600 hover:border-cyan-400'
                                                    }`}
                                                >
                                                    {isChecked && <CheckCircle2 className="w-4 h-4" />}
                                                </button>
                                                <div className="min-w-0">
                                                    <div className={`text-xs font-bold truncate ${isChecked ? 'line-through text-zinc-400' : 'text-white'}`}>
                                                        {item.quantity}x {item.name}
                                                    </div>
                                                    <div className="text-[11px] font-mono text-cyan-400/90 flex items-center gap-1 mt-0.5">
                                                        <MapPin className="w-3 h-3 shrink-0" />
                                                        <span>Estante {estante} • {fila}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold shrink-0 ${
                                                isChecked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                                            }`}>
                                                {isChecked ? 'En Cesta' : 'Pendiente'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Barra de entrega del pedido activo */}
                            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs text-zinc-300 font-medium">
                                    {isOrderFullyChecked(activeOrder) ? (
                                        <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4" />
                                            Todos los artículos de este pedido están verificados en la cesta.
                                        </span>
                                    ) : (
                                        <span className="text-amber-400 font-bold flex items-center gap-1.5">
                                            <Sparkles className="w-4 h-4" />
                                            Verifica cada artículo con su palomita para habilitar el despacho.
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <button
                                        disabled={!isOrderFullyChecked(activeOrder) || isSubmitting}
                                        onClick={() => handleFinalizeSingleOrder(activeOrder, 'caja')}
                                        className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        <Store className="w-3.5 h-3.5" />
                                        <span>Entregar a Caja</span>
                                    </button>

                                    <button
                                        disabled={!isOrderFullyChecked(activeOrder) || isSubmitting}
                                        onClick={() => handleFinalizeSingleOrder(activeOrder, 'carga')}
                                        className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                        <Truck className="w-3.5 h-3.5" />
                                        <span>Entregar a Patio Carga</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Vista unificada por Ruta de Estantes (recorrido óptimo) */
                        <div className="space-y-6">
                            <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/30 rounded-xl text-xs text-cyan-300">
                                💡 <strong>Ruta Óptima de Bodega:</strong> Los artículos de todos los pedidos seleccionados están agrupados por estante para que no des vueltas dobles en el almacén.
                            </div>

                            {shelfRoute.map(shelf => (
                                <div key={shelf.shelfName} className="p-4 bg-zinc-900/60 rounded-xl border border-white/5 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-400">
                                        <MapPin className="w-4 h-4 text-cyan-400" />
                                        <span>{shelf.shelfName}</span>
                                        <span className="text-[10px] text-zinc-500 font-mono">
                                            ({shelf.items.length} artículos en este punto)
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {shelf.items.map(({ orderId, customerName, item }, idx) => {
                                            const itemId = item.productId || item.id;
                                            const key = `${orderId}__${itemId}`;
                                            const isChecked = !!checkedItems[key];

                                            return (
                                                <div
                                                    key={`${orderId}_${itemId}_${idx}`}
                                                    onClick={() => toggleItem(orderId, itemId)}
                                                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                                        isChecked
                                                            ? 'bg-emerald-950/20 border-emerald-500/40 text-zinc-400'
                                                            : 'bg-black/40 hover:bg-black/60 border-white/5'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className={`w-5 h-5 rounded flex items-center justify-center ${
                                                            isChecked ? 'bg-emerald-500 text-black font-bold' : 'border border-zinc-600'
                                                        }`}>
                                                            {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className={`text-xs font-bold truncate ${isChecked ? 'line-through text-zinc-500' : 'text-white'}`}>
                                                                {item.quantity}x {item.name}
                                                            </div>
                                                            <div className="text-[10px] font-mono text-cyan-400/80">
                                                                Para: <strong className="text-zinc-300">{orderId}</strong> ({customerName})
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                                                        isChecked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-400'
                                                    }`}>
                                                        {isChecked ? 'Listo' : 'Recolectar'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-zinc-900/90 border-t border-white/10 flex items-center justify-between text-xs text-zinc-400">
                    <span>
                        Consejo: Marca cada producto en cuanto lo coloques en tu cesta o carrito físico.
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-xs transition-colors"
                    >
                        Cerrar Asistente
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
