"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, Circle, MapPin, Truck, Store,
    Sparkles, X, CheckCheck, Layers, ShoppingCart,
    PauseCircle, LockKeyhole, ShieldAlert
} from 'lucide-react';
import { toast } from '@/lib/toast';
import PinAuthorizationModal, { type PinAuthorizationResult } from '@/components/security/PinAuthorizationModal';
import {
    loadMultiPickingDraft,
    saveMultiPickingDraft,
    clearMultiPickingDraft,
} from '@/lib/operationGuard';

export interface MultiOrderPickingAssistantProps {
    orders: any[];
    role: 'sales' | 'inventory' | 'carga' | 'pickup' | 'driver' | string;
    onClose: () => void;
    onCompleteOrder: (orderId: string, targetRole: 'caja' | 'carga' | 'pickup') => Promise<void> | void;
    onBatchCompleteAll?: (orderIds: string[], targetRole: 'caja' | 'carga' | 'pickup') => Promise<void> | void;
}

export default function MultiOrderPickingAssistant({
    orders = [],
    onClose,
    onCompleteOrder,
}: MultiOrderPickingAssistantProps) {
    const safeOrders = useMemo(() => orders || [], [orders]);
    const orderIds = useMemo(() => safeOrders.map((o) => String(o.id)).filter(Boolean), [safeOrders]);
    const orderIdsKey = orderIds.join('|');

    const [viewMode, setViewMode] = useState<'by_order' | 'by_shelf'>(() => {
        const saved = orderIds.length > 0 ? loadMultiPickingDraft(orderIds) : null;
        return saved?.viewMode || 'by_order';
    });
    const [selectedOrderIndex, setSelectedOrderIndex] = useState(() => {
        const saved = orderIds.length > 0 ? loadMultiPickingDraft(orderIds) : null;
        if (saved && Number.isInteger(saved.selectedOrderIndex) && saved.selectedOrderIndex < safeOrders.length) {
            return saved.selectedOrderIndex;
        }
        return 0;
    });
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
        const saved = orderIds.length > 0 ? loadMultiPickingDraft(orderIds) : null;
        return saved?.checkedItems || {};
    });
    const [completedOrderIds, setCompletedOrderIds] = useState<Record<string, boolean>>(() => {
        const saved = orderIds.length > 0 ? loadMultiPickingDraft(orderIds) : null;
        return saved?.completedOrderIds || {};
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCloseGuard, setShowCloseGuard] = useState(false);
    const [showAbandonPinModal, setShowAbandonPinModal] = useState(false);
    const settledRef = useRef(false);

    useEffect(() => {
        if (orderIds.length === 0 || settledRef.current) return;
        saveMultiPickingDraft({
            orderIds,
            viewMode,
            selectedOrderIndex,
            checkedItems,
            completedOrderIds,
            holdStatus: 'ACTIVE',
        });
    }, [orderIdsKey, orderIds, viewMode, selectedOrderIndex, checkedItems, completedOrderIds]);

    useEffect(() => {
        if (typeof window === 'undefined' || orderIds.length === 0) return;
        const handleBeforeUnload = (ev: BeforeUnloadEvent) => {
            if (settledRef.current) return;
            ev.preventDefault();
            ev.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [orderIdsKey, orderIds.length]);

    const activeOrder = safeOrders[selectedOrderIndex] || safeOrders[0];

    const toggleItem = (orderId: string, itemId: string) => {
        const key = `${orderId}__${itemId}`;
        setCheckedItems(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const isOrderFullyChecked = (order: any) => {
        const items = order.items || [];
        if (items.length === 0) return false;
        return items.every((item: any) => {
            const key = `${order.id}__${item.productId || item.id}`;
            return !!checkedItems[key];
        });
    };

    const handleCheckAllForOrder = (order: any) => {
        const next = { ...checkedItems };
        (order.items || []).forEach((item: any) => {
            const key = `${order.id}__${item.productId || item.id}`;
            next[key] = true;
        });
        setCheckedItems(next);
        toast.success(`Todos los artículos de ${order.id} listos en la cesta.`);
    };

    const shelfRoute = useMemo(() => {
        const shelfMap: Record<string, { shelfName: string; items: { orderId: string; customerName: string; item: any }[] }> = {};

        safeOrders.forEach(order => {
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
    }, [safeOrders]);

    const totalGlobalItems = useMemo(() => {
        return safeOrders.reduce((acc, o) => acc + (o.items || []).length, 0);
    }, [safeOrders]);

    const checkedGlobalCount = useMemo(() => {
        return Object.values(checkedItems).filter(Boolean).length;
    }, [checkedItems]);

    const globalPercent = totalGlobalItems > 0 ? Math.round((checkedGlobalCount / totalGlobalItems) * 100) : 0;

    const remainingOrderIds = orderIds.filter((id) => !completedOrderIds[id]);

    const handleFinalizeSingleOrder = async (order: any, target: 'caja' | 'carga' | 'pickup') => {
        if (!isOrderFullyChecked(order)) {
            toast.warning(`Aún faltan artículos por recolectar en el pedido ${order.id}`);
            return;
        }
        setIsSubmitting(true);
        try {
            await onCompleteOrder(order.id, target);
            const nextCompleted: Record<string, boolean> = { ...completedOrderIds, [String(order.id)]: true };
            setCompletedOrderIds(nextCompleted);
            toast.success(`Pedido ${order.id} recolectado y enviado a ${target.toUpperCase()}`);
            const allCompleted = orderIds.every((id) => Boolean(nextCompleted[id]));
            if (allCompleted) {
                settledRef.current = true;
                clearMultiPickingDraft(orderIds);
            } else {
                const nextIdx = safeOrders.findIndex((o, idx) => idx !== selectedOrderIndex && !nextCompleted[String(o.id)]);
                if (nextIdx !== -1) {
                    setSelectedOrderIndex(nextIdx);
                }
            }
        } catch (e: any) {
            toast.error(e?.message || 'Error al completar recolección');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePutBatchOnHold = async () => {
        setIsSubmitting(true);
        try {
            settledRef.current = true;
            saveMultiPickingDraft({
                orderIds,
                viewMode,
                selectedOrderIndex,
                checkedItems,
                completedOrderIds,
                holdStatus: 'ON_HOLD',
                holdReason: 'Lote en espera',
                heldAt: new Date().toISOString(),
            });
            await Promise.allSettled(
                remainingOrderIds.map((id) =>
                    fetch('/api/orders', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ id, action: 'hold_preparation', reason: 'Lote de surtido puesto en espera' }),
                    })
                )
            );
            toast.success(`Lote de ${remainingOrderIds.length || orderIds.length} pedido(s) guardado en espera.`);
            setShowCloseGuard(false);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmAbandonBatch = async (authResult: PinAuthorizationResult) => {
        setIsSubmitting(true);
        try {
            settledRef.current = true;
            await Promise.allSettled(
                remainingOrderIds.map((id) =>
                    fetch('/api/orders', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            id,
                            action: 'abandon_preparation',
                            verificationPin: authResult.pin,
                            reason: authResult.reason || 'Lote abandonado con NIP',
                        }),
                    })
                )
            );
            clearMultiPickingDraft(orderIds);
            toast.success(`Lote liberado con NIP por ${authResult.verifiedBy.name}.`);
            setShowAbandonPinModal(false);
            setShowCloseGuard(false);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!orders || orders.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[195] flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.16 }}
                className="bg-zinc-950 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-white relative"
            >
                {/* Header superior */}
                <div className="p-4 bg-zinc-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span className="font-semibold text-white">Recolección Multipedido en Cesta</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">{orders.length} pedidos simultáneos</span>
                            </div>
                            <p className="text-xs text-zinc-400">
                                Agrupados por pedido y ruta de estantes con guardado automático.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-black/60 p-1 rounded-xl border border-white/10">
                            <button
                                type="button"
                                onClick={() => setViewMode('by_order')}
                                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === 'by_order' ? 'bg-sky-500 text-slate-950' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                Por Pedido
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('by_shelf')}
                                className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === 'by_shelf' ? 'bg-sky-500 text-slate-950' : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                Ruta de Estantes
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                if (remainingOrderIds.length === 0) {
                                    settledRef.current = true;
                                    clearMultiPickingDraft(orderIds);
                                    onClose();
                                } else {
                                    setShowCloseGuard(true);
                                }
                            }}
                            aria-label="Cerrar o pausar lote"
                            className="min-w-[44px] min-h-[44px] text-zinc-400 hover:text-white rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Barra de progreso global */}
                <div className="px-5 py-2.5 bg-zinc-900/50 border-b border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                        <ShoppingCart className="w-4 h-4 text-sky-400" />
                        <span className="tabular-nums">
                            En cesta: <strong className="text-white">{checkedGlobalCount}</strong> de <strong className="text-white">{totalGlobalItems}</strong>
                        </span>
                    </div>
                    <div className="flex-1 max-w-md bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-emerald-400 h-full transition-all duration-200 rounded-full"
                            style={{ width: `${globalPercent}%` }}
                        />
                    </div>
                    <span className="text-xs font-mono tabular-nums font-bold text-sky-400">{globalPercent}%</span>
                </div>

                {/* Selector de pestañas */}
                {viewMode === 'by_order' && (
                    <div className="px-4 py-2 bg-black/40 border-b border-white/5 flex items-center gap-2 overflow-x-auto custom-scrollbar">
                        {safeOrders.map((o, idx) => {
                            const isSelected = selectedOrderIndex === idx;
                            const isDone = completedOrderIds[o.id] || isOrderFullyChecked(o);

                            return (
                                <button
                                    type="button"
                                    key={o.id}
                                    onClick={() => setSelectedOrderIndex(idx)}
                                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 border ${
                                        isSelected
                                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                                            : isDone
                                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                              : 'bg-zinc-900/60 text-zinc-400 hover:text-white border-white/10'
                                    }`}
                                >
                                    {isDone ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    ) : (
                                        <Circle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                    )}
                                    <span className="font-mono tabular-nums">{o.id}</span>
                                    <span className="text-zinc-400 truncate max-w-[100px]">
                                        ({o.customer?.name?.split(' ')[0] || o.customerName?.split(' ')[0] || 'Cliente'})
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Contenido principal */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                    {viewMode === 'by_order' && activeOrder ? (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-zinc-900/70 rounded-xl border border-white/10">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                                        <span className="font-mono text-sm font-bold text-sky-400 tabular-nums">{activeOrder.id}</span>
                                        <span aria-hidden="true">·</span>
                                        <span className="font-semibold text-white">
                                            {activeOrder.customer?.name || activeOrder.customerName || 'Cliente'}
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span className="text-slate-400">
                                            Destino: {activeOrder.deliveryType === 'PATIO' ? 'Patio / Bahía' : 'Caja / Mostrador'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-400 mt-1 tabular-nums">
                                        {(activeOrder.items || []).length} artículos a recolectar en bodega.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleCheckAllForOrder(activeOrder)}
                                    className="min-h-[44px] px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5 transition-all"
                                >
                                    <CheckCheck className="w-4 h-4 text-sky-400" />
                                    <span>Marcar todos listos</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {(activeOrder.items || []).map((item: any) => {
                                    const itemId = item.productId || item.id;
                                    const key = `${activeOrder.id}__${itemId}`;
                                    const isChecked = !!checkedItems[key];
                                    const estante = item?.product?.location?.estante || item?.product?.estante || item?.location?.estante || 'Bodega';
                                    const fila = item?.product?.location?.fila || item?.product?.fila || item?.location?.fila || 'Gral';

                                    return (
                                        <button
                                            type="button"
                                            key={itemId}
                                            onClick={() => toggleItem(activeOrder.id, itemId)}
                                            className={`min-h-[56px] p-3.5 rounded-xl border transition-all text-left flex items-center justify-between gap-3 ${
                                                isChecked
                                                    ? 'bg-emerald-950/20 border-emerald-500/40'
                                                    : 'bg-zinc-900/60 hover:bg-zinc-900 border-white/10 hover:border-sky-500/30'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div
                                                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                                        isChecked ? 'bg-emerald-500 text-slate-950' : 'border border-zinc-600'
                                                    }`}
                                                >
                                                    {isChecked && <CheckCircle2 className="w-4 h-4" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className={`text-xs sm:text-sm font-semibold truncate ${isChecked ? 'line-through text-zinc-400' : 'text-white'}`}>
                                                        {item.quantity}x {item.name}
                                                    </div>
                                                    <div className="text-xs font-mono text-sky-400 flex items-center gap-1 mt-0.5">
                                                        <MapPin className="w-3 h-3 shrink-0" />
                                                        <span>Estante {estante} · {fila}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <span className={`text-xs font-mono shrink-0 ${isChecked ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                                {isChecked ? 'Listo' : 'Pendiente'}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-4 p-4 rounded-xl bg-zinc-900 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs font-medium">
                                    {isOrderFullyChecked(activeOrder) ? (
                                        <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4" />
                                            Pedido verificado al 100% en cesta.
                                        </span>
                                    ) : (
                                        <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                                            <Sparkles className="w-4 h-4" />
                                            Verifica cada artículo para habilitar el despacho.
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        disabled={!isOrderFullyChecked(activeOrder) || isSubmitting}
                                        onClick={() => handleFinalizeSingleOrder(activeOrder, 'caja')}
                                        className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Store className="w-4 h-4" />
                                        <span>Entregar a Caja</span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={!isOrderFullyChecked(activeOrder) || isSubmitting}
                                        onClick={() => handleFinalizeSingleOrder(activeOrder, 'carga')}
                                        className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Truck className="w-4 h-4" />
                                        <span>Entregar a Patio Carga</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {shelfRoute.map(shelf => (
                                <div key={shelf.shelfName} className="p-4 bg-zinc-900/70 rounded-xl border border-white/10 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                                        <MapPin className="w-4 h-4 text-sky-400" />
                                        <span>{shelf.shelfName}</span>
                                        <span className="text-zinc-400 font-mono font-normal tabular-nums">
                                            · {shelf.items.length} artículos
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                        {shelf.items.map(({ orderId: oId, customerName, item }, idx) => {
                                            const itemId = item.productId || item.id;
                                            const key = `${oId}__${itemId}`;
                                            const isChecked = !!checkedItems[key];

                                            return (
                                                <button
                                                    type="button"
                                                    key={`${oId}_${itemId}_${idx}`}
                                                    onClick={() => toggleItem(oId, itemId)}
                                                    className={`min-h-[52px] p-3 rounded-lg border transition-all text-left flex items-center justify-between gap-3 ${
                                                        isChecked
                                                            ? 'bg-emerald-950/20 border-emerald-500/40 text-zinc-400'
                                                            : 'bg-black/40 hover:bg-black/60 border-white/10'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div
                                                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                                                                isChecked ? 'bg-emerald-500 text-slate-950' : 'border border-zinc-600'
                                                            }`}
                                                        >
                                                            {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className={`text-xs font-semibold truncate ${isChecked ? 'line-through text-zinc-500' : 'text-white'}`}>
                                                                {item.quantity}x {item.name}
                                                            </div>
                                                            <div className="text-xs font-mono text-sky-400/90">
                                                                {oId} · {customerName}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={`text-xs font-mono shrink-0 ${isChecked ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                                        {isChecked ? 'Listo' : 'Pendiente'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-zinc-900 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                    <span>El avance del lote se guarda automáticamente ante pausas o cortes de red.</span>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={handlePutBatchOnHold}
                            disabled={isSubmitting}
                            className="min-h-[44px] px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                        >
                            <PauseCircle size={15} />
                            <span>Poner Lote en Espera</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (remainingOrderIds.length === 0) {
                                    settledRef.current = true;
                                    clearMultiPickingDraft(orderIds);
                                    onClose();
                                } else {
                                    setShowCloseGuard(true);
                                }
                            }}
                            className="min-h-[44px] px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                        >
                            <LockKeyhole size={14} />
                            <span>Cerrar / Abandonar</span>
                        </button>
                    </div>
                </div>

                {/* Guard de abandono de lote */}
                <AnimatePresence>
                    {showCloseGuard && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
                        >
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                                        <ShieldAlert size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-white">Protección de Lote en Surtido</h4>
                                        <p className="text-xs text-slate-400 font-mono tabular-nums">
                                            {remainingOrderIds.length} pedido(s) pendiente(s) · {checkedGlobalCount}/{totalGlobalItems} ítems
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed">
                                    Pon el lote en espera para conservar tu progreso o autoriza el abandono con tu NIP de operador.
                                </p>
                                <div className="flex flex-col gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setShowCloseGuard(false)}
                                        className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm"
                                    >
                                        Seguir recolectando
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePutBatchOnHold}
                                        disabled={isSubmitting}
                                        className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold text-sm flex items-center justify-center gap-2"
                                    >
                                        <PauseCircle size={16} />
                                        <span>Poner lote en espera (Guardar avance)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAbandonPinModal(true)}
                                        disabled={isSubmitting}
                                        className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-200 font-semibold text-sm flex items-center justify-center gap-2"
                                    >
                                        <LockKeyhole size={15} />
                                        <span>Abandonar lote (Requiere NIP)</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <PinAuthorizationModal
                isOpen={showAbandonPinModal}
                title="Confirmar Abandono de Lote"
                description={`Ingresa tu NIP para liberar los ${remainingOrderIds.length} pedido(s) activos del lote actual.`}
                actionLabel="Abandonar Lote"
                actionTone="danger"
                requireReason={true}
                defaultReason="Lote de surtido liberado por operador con NIP"
                onClose={() => setShowAbandonPinModal(false)}
                onAuthorized={handleConfirmAbandonBatch}
            />
        </div>
    );
}
