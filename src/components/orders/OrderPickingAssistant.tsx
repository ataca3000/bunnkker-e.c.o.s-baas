"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, Circle, MapPin, X, ShieldCheck, ArrowLeftRight,
    ThumbsUp, SkipForward, CheckCheck, PauseCircle, LockKeyhole, ShieldAlert
} from 'lucide-react';
import { toast } from '@/lib/toast';
import PinAuthorizationModal, { type PinAuthorizationResult } from '@/components/security/PinAuthorizationModal';
import {
    loadPickingDraft,
    savePickingDraft,
    putPickingOperationOnHold,
    clearPickingDraft,
    hasStartedPickingProgress,
} from '@/lib/operationGuard';

export interface OrderPickingAssistantProps {
    order: any;
    role: 'sales' | 'inventory' | 'carga' | 'pickup' | 'driver' | string;
    mode?: 'picking' | 'deconstruction';
    onClose: () => void;
    onComplete: (orderId: string) => void | Promise<void>;
    onDelegate?: (orderId: string, targetRole: 'caja' | 'carga' | 'pickup') => void | Promise<void>;
    onPutOnHold?: (orderId: string, reason?: string) => void | Promise<void>;
    onAbandon?: (orderId: string, result: PinAuthorizationResult) => void | Promise<void>;
}

export default function OrderPickingAssistant({
    order,
    role,
    mode = 'picking',
    onClose,
    onComplete,
    onDelegate,
    onPutOnHold,
    onAbandon,
}: OrderPickingAssistantProps) {
    const items = useMemo(() => order?.items || [], [order]);
    const orderId = String(order?.id || '');

    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
        const saved = orderId ? loadPickingDraft(orderId, mode) : null;
        const initial: Record<string, boolean> = {};
        items.forEach((item: any) => {
            const itemId = item.productId || item.id;
            initial[itemId] = Boolean(saved?.checkedItems?.[itemId]);
        });
        return initial;
    });

    const [currentItemIndex, setCurrentItemIndex] = useState<number>(() => {
        const saved = orderId ? loadPickingDraft(orderId, mode) : null;
        if (saved && Number.isInteger(saved.currentItemIndex) && saved.currentItemIndex >= 0 && saved.currentItemIndex < items.length) {
            return saved.currentItemIndex;
        }
        return 0;
    });

    const [isDelegating, setIsDelegating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCloseGuard, setShowCloseGuard] = useState(false);
    const [showAbandonPinModal, setShowAbandonPinModal] = useState(false);
    const [restoredFromDraft, setRestoredFromDraft] = useState(false);
    const operationSettledRef = useRef(false);

    useEffect(() => {
        if (!orderId) return;
        const saved = loadPickingDraft(orderId, mode);
        if (saved && hasStartedPickingProgress(saved.checkedItems)) {
            setRestoredFromDraft(true);
        }
    }, [orderId, mode]);

    // Auto-persistir el progreso de surtido localmente en todo momento
    useEffect(() => {
        if (!orderId || operationSettledRef.current) return;
        savePickingDraft({
            orderId,
            mode,
            checkedItems,
            currentItemIndex,
            holdStatus: order?.status === 'EN_ESPERA' ? 'ON_HOLD' : 'ACTIVE',
        });
    }, [orderId, mode, checkedItems, currentItemIndex, order?.status]);

    // Protección contra recarga o cierre accidental de pestaña mientras el trabajador prepara
    useEffect(() => {
        if (typeof window === 'undefined' || !orderId) return;
        const handleBeforeUnload = (ev: BeforeUnloadEvent) => {
            if (operationSettledRef.current) return;
            ev.preventDefault();
            ev.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [orderId]);

    const totalItems = items.length;
    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
    const isAllChecked = totalItems > 0 && checkedCount === totalItems;

    const currentItem = items[currentItemIndex] || items[0];
    const currentItemId = currentItem?.productId || currentItem?.id;

    const getItemLocation = (item: any) => {
        const loc = item?.product?.location || item?.location;
        const estante = loc?.estante || item?.product?.estante || 'Bodega';
        const fila = loc?.fila || item?.product?.fila || 'Nivel 1';
        return `Estante ${estante} · ${fila}`;
    };

    const toggleItem = (itemId: string) => {
        setCheckedItems(prev => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    };

    const markCurrentAndNext = () => {
        if (!currentItemId) return;
        const updated: Record<string, boolean> = { ...checkedItems, [String(currentItemId)]: true };
        setCheckedItems(updated);
        const nextIndex = items.findIndex((it: any, idx: number) => idx > currentItemIndex && !updated[String(it.productId || it.id)]);
        if (nextIndex !== -1) {
            setCurrentItemIndex(nextIndex);
        } else if (currentItemIndex < totalItems - 1) {
            setCurrentItemIndex(prev => prev + 1);
        }
    };

    const handleSkipCurrent = () => {
        if (currentItemIndex < totalItems - 1) {
            setCurrentItemIndex(prev => prev + 1);
        } else {
            setCurrentItemIndex(0);
        }
    };

    const handleSelectAll = () => {
        const next: Record<string, boolean> = {};
        items.forEach((it: any) => {
            next[it.productId || it.id] = true;
        });
        setCheckedItems(next);
        toast.success(mode === 'deconstruction' ? 'Todos los materiales marcados como devueltos.' : 'Todos los productos marcados como recolectados.');
    };

    const handleFinish = async () => {
        if (!isAllChecked) {
            toast.warning(mode === 'deconstruction' ? 'Aún faltan materiales por reacomodar.' : 'Aún faltan productos por recolectar.');
            return;
        }
        setIsSubmitting(true);
        try {
            operationSettledRef.current = true;
            await onComplete(order.id);
            if (orderId) {
                clearPickingDraft(orderId, mode);
            }
        } catch (e: any) {
            operationSettledRef.current = false;
            toast.error(e?.message || 'Error al completar la operación.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePutOnHold = async () => {
        if (!orderId) {
            onClose();
            return;
        }
        setIsSubmitting(true);
        const holdReason = 'Puesto en espera durante surtido';
        try {
            operationSettledRef.current = true;
            putPickingOperationOnHold({
                orderId,
                mode,
                checkedItems,
                currentItemIndex,
                holdReason,
            });

            if (mode === 'picking') {
                await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        id: orderId,
                        action: 'hold_preparation',
                        reason: holdReason,
                    }),
                }).catch(() => {});
            }

            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'ORDER_HOLD', id: orderId });
            }

            toast.success(`Pedido #${orderId.slice(-6)} guardado en espera (${checkedCount}/${totalItems} verificados).`);
            setShowCloseGuard(false);
            if (onPutOnHold) {
                await onPutOnHold(orderId, holdReason);
            } else {
                onClose();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmAbandon = async (authResult: PinAuthorizationResult) => {
        if (!orderId) {
            setShowAbandonPinModal(false);
            onClose();
            return;
        }
        setIsSubmitting(true);
        try {
            operationSettledRef.current = true;
            if (mode === 'picking') {
                const res = await fetch('/api/orders', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        id: orderId,
                        action: 'abandon_preparation',
                        verificationPin: authResult.pin,
                        reason: authResult.reason || 'Operación cancelada / liberada por operador',
                    }),
                });
                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.success) {
                    operationSettledRef.current = false;
                    toast.error(data?.error || 'No se pudo cancelar la preparación en el servidor.');
                    return;
                }
            }

            clearPickingDraft(orderId, mode);
            if (typeof window !== 'undefined' && (window as any).__inventorySocket) {
                (window as any).__inventorySocket.emit('sync_db_event', { action: 'ORDER_ABANDONED', id: orderId });
            }
            toast.success(`Operación liberada con NIP por ${authResult.verifiedBy.name}.`);
            setShowAbandonPinModal(false);
            setShowCloseGuard(false);
            if (onAbandon) {
                await onAbandon(orderId, authResult);
            } else {
                onClose();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelegateClick = (target: 'caja' | 'carga' | 'pickup') => {
        if (onDelegate) {
            operationSettledRef.current = true;
            clearPickingDraft(orderId, mode);
            onDelegate(order.id, target);
        }
        setIsDelegating(false);
    };

    const getChatbotSpeech = () => {
        const currentName = currentItem?.product?.name || currentItem?.name || 'este artículo';
        const currentQty = currentItem?.cantidad || currentItem?.quantity || 1;
        const currentLoc = getItemLocation(currentItem);

        if (isAllChecked) {
            if (mode === 'deconstruction') {
                return 'Todos los productos están de regreso en su lugar. El pedido queda marcado como Cancelado con stock restituido en anaqueles.';
            }
            if (role === 'sales') {
                return 'Ya reuniste todos los productos de este pedido en mostrador. Está listo para pasar directo a cobrar y generar ticket.';
            }
            if (role === 'driver') {
                return 'Ya verificaste la carga completa de esta orden en tu vehículo. Estás listo para arrancar la ruta con seguridad.';
            }
            if (role === 'carga' || order?.deliveryType === 'PATIO') {
                return 'Todo completo en bahía de carga. Los materiales están listos para entregar al cliente con foto y firma.';
            }
            return 'Todo el pedido está completo y listo para entregar al cliente.';
        }

        if (mode === 'deconstruction') {
            if (currentItemIndex === 0) {
                return `Este artículo "${currentName}" (${currentQty} pzas) va de vuelta en ${currentLoc}. Colócalo en su anaquel y márcalo.`;
            }
            return `Ahora reubica "${currentName}" (${currentQty} pzas) en ${currentLoc} para reponer stock.`;
        }

        if (currentItemIndex === 0) {
            return `El primero es "${currentName}" (${currentQty} pzas), ubicado en ${currentLoc}. Confírmalo al tomarlo.`;
        }
        return `Siguiente artículo: "${currentName}" (${currentQty} pzas), ubicado en ${currentLoc}.`;
    };

    const finishButtonText = () => {
        if (mode === 'deconstruction') return 'Confirmar Stock de Vuelta (100%)';
        if (role === 'sales') return 'Pasar a Cobro y Ticket';
        if (role === 'driver') return 'Carga Verificada — Salir a Ruta';
        if (role === 'inventory') {
            return order?.deliveryType === 'PATIO' ? 'Entregar a Bahía de Carga (Patio)' : 'Entregar a Mostrador (Caja)';
        }
        if (role === 'carga' || order?.deliveryType === 'PATIO') return 'Listo en Bahía de Patio (PoD)';
        return 'Marcar Listo para Entrega';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-6">
            <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden font-sans relative"
            >
                {/* Cabecera */}
                <div className="bg-slate-900 px-4 sm:px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className={mode === 'deconstruction' ? 'text-amber-400 font-semibold' : 'text-sky-400 font-semibold'}>
                                {mode === 'deconstruction' ? 'Deconstrucción' : 'Asistente de Surtido'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono uppercase">{order?.deliveryType || 'LOCAL'}</span>
                            {restoredFromDraft && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-emerald-400 font-medium">Avance recuperado</span>
                                </>
                            )}
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                            {mode === 'deconstruction' ? 'Reacomodar #' : 'Pedido #'}
                            <span className="font-mono tabular-nums">{order?.id?.slice(0, 8)}</span>
                            <span className="text-slate-400 font-normal"> · {order?.customerName || order?.customer?.name || 'Cliente'}</span>
                        </h3>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handlePutOnHold}
                            disabled={isSubmitting}
                            className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold border border-amber-500/30 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                            title="Guardar avance y poner pedido en espera"
                        >
                            <PauseCircle size={15} />
                            <span className="hidden sm:inline">En Espera</span>
                        </button>
                        {role !== 'driver' && onDelegate && (
                            <button
                                type="button"
                                onClick={() => setIsDelegating(!isDelegating)}
                                className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                                title="Delegar pedido a otra área"
                            >
                                <ArrowLeftRight size={14} className="text-sky-400" />
                                <span className="hidden sm:inline">Delegar</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowCloseGuard(true)}
                            aria-label="Cerrar o abandonar surtido"
                            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Sub-menú de delegación */}
                <AnimatePresence>
                    {isDelegating && role !== 'driver' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-slate-950 border-b border-slate-800 p-3 px-5 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2 shrink-0"
                        >
                            <span>Transferir pedido a otra área sin perder el turno:</span>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleDelegateClick('caja')}
                                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 font-semibold"
                                >
                                    A Caja (Mostrador)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelegateClick('carga')}
                                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 font-semibold"
                                >
                                    A Carga (Patio)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelegateClick('pickup')}
                                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 font-semibold"
                                >
                                    A Pick up
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Cuerpo en 3 Columnas */}
                <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto lg:overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                    {/* COLUMNA 1: Guía y Artículo en turno */}
                    <div className="lg:col-span-4 p-4 sm:p-5 flex flex-col justify-between bg-slate-900/60 overflow-y-auto space-y-4">
                        <div className="space-y-3">
                            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 leading-relaxed">
                                <span className="font-semibold text-amber-400 block text-xs mb-1">
                                    LION Guía Operativa
                                </span>
                                <p>{getChatbotSpeech()}</p>
                            </div>

                            {currentItem && (
                                <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                                    <span className="text-xs font-medium text-sky-400 block tabular-nums">
                                        Artículo en Turno ({currentItemIndex + 1} de {totalItems})
                                    </span>
                                    <div className="text-base font-bold text-white">
                                        {currentItem.product?.name || currentItem.name || 'Producto'}
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-1">
                                        <span className="text-sky-300 font-mono flex items-center gap-1.5">
                                            <MapPin size={13} /> {getItemLocation(currentItem)}
                                        </span>
                                        <span className="font-mono tabular-nums font-bold text-amber-300">
                                            Cantidad: {currentItem.cantidad || currentItem.quantity || 1}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            {!isAllChecked ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={markCurrentAndNext}
                                        className="w-full min-h-[48px] py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                                    >
                                        <ThumbsUp size={16} />
                                        <span>{mode === 'deconstruction' ? 'Listo, ya lo regresé' : 'Listo, ya lo tomé'}</span>
                                    </button>

                                    <div className="flex items-center gap-2">
                                        {totalItems > 1 && (
                                            <button
                                                type="button"
                                                onClick={handleSkipCurrent}
                                                className="flex-1 min-h-[44px] py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                                            >
                                                <SkipForward size={14} />
                                                <span>Saltar por ahora</span>
                                            </button>
                                        )}

                                        {mode === 'deconstruction' && (
                                            <button
                                                type="button"
                                                onClick={handleSelectAll}
                                                className="flex-1 min-h-[44px] py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                                            >
                                                <CheckCheck size={14} />
                                                <span>Restituir todos</span>
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-center text-xs font-semibold">
                                    Todos los artículos han sido verificados.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUMNA 2: Lista Completa */}
                    <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col overflow-hidden bg-slate-950/40">
                        <div className="pb-3 border-b border-slate-800 mb-3 shrink-0">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                                <span>{mode === 'deconstruction' ? 'Progreso de reacomodo' : 'Progreso de surtido'}</span>
                                <span className="font-mono tabular-nums text-amber-400">
                                    {checkedCount} / {totalItems} ({progressPercent}%)
                                </span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-400 transition-all duration-200 rounded-full"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {items.map((item: any, idx: number) => {
                                const itemId = item.productId || item.id;
                                const isChecked = Boolean(checkedItems[itemId]);
                                const isSelected = idx === currentItemIndex;
                                const loc = getItemLocation(item);
                                const qty = item.cantidad || item.quantity || 1;

                                return (
                                    <button
                                        type="button"
                                        key={itemId}
                                        onClick={() => {
                                            toggleItem(itemId);
                                            setCurrentItemIndex(idx);
                                        }}
                                        className={`w-full min-h-[56px] p-3 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors ${
                                            isChecked
                                                ? 'bg-emerald-950/25 border-emerald-500/40 text-slate-300'
                                                : isSelected
                                                  ? 'bg-slate-800 border-amber-500/60 text-white'
                                                  : 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="shrink-0">
                                                {isChecked ? (
                                                    <CheckCircle2 size={20} className="text-emerald-400" />
                                                ) : (
                                                    <Circle size={20} className="text-slate-500" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`text-sm font-semibold truncate ${isChecked ? 'line-through text-slate-400' : 'text-white'}`}>
                                                    {item.product?.name || item.name || 'Producto'}
                                                </div>
                                                <div className="text-xs text-sky-400 font-mono flex items-center gap-1.5 mt-0.5 truncate">
                                                    <MapPin size={11} className="shrink-0" />
                                                    <span className="truncate">{loc}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <span className="text-xs font-mono tabular-nums font-bold text-amber-300 shrink-0">
                                            x{qty}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* COLUMNA 3: Cierre Operativo y Protección */}
                    <div className="lg:col-span-3 p-4 sm:p-5 flex flex-col justify-between bg-slate-900/40 space-y-4">
                        <div className="space-y-4">
                            <div>
                                <span className="text-xs font-semibold text-slate-400 block mb-1.5">
                                    Destino Operativo
                                </span>
                                <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800">
                                    <div className="text-sm font-bold text-white">
                                        {order?.deliveryType === 'PATIO'
                                            ? 'Bahía de Carga (Patio)'
                                            : order?.deliveryType === 'DELIVERY'
                                              ? 'Ruta de Reparto Domicilio'
                                              : 'Mostrador / Caja Central'}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        {order?.deliveryType === 'PATIO'
                                            ? 'Los materiales se entregan al operador de patio.'
                                            : 'El cliente retirará en mostrador local.'}
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
                                <div className="flex justify-between text-slate-400">
                                    <span>Total Artículos</span>
                                    <span className="font-mono tabular-nums text-white font-bold">{totalItems}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Verificados</span>
                                    <span className="font-mono tabular-nums text-emerald-400 font-bold">{checkedCount}</span>
                                </div>
                                <div className="flex justify-between text-slate-400">
                                    <span>Pendientes</span>
                                    <span className="font-mono tabular-nums text-amber-400 font-bold">{totalItems - checkedCount}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={handleFinish}
                                disabled={!isAllChecked || isSubmitting}
                                className={`w-full min-h-[48px] py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                                    isAllChecked
                                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 active:scale-[0.98] cursor-pointer'
                                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                                }`}
                            >
                                <ShieldCheck size={17} />
                                <span className="truncate">{finishButtonText()}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handlePutOnHold}
                                disabled={isSubmitting}
                                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-semibold text-amber-300 flex items-center justify-center gap-2 transition-colors"
                            >
                                <PauseCircle size={15} />
                                <span>Poner en Espera (Guardar avance)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowCloseGuard(true)}
                                disabled={isSubmitting}
                                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center justify-center gap-2 transition-colors"
                            >
                                <LockKeyhole size={14} />
                                <span>Abandonar / Cancelar</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Overlay de Protección contra Abandono */}
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
                                        <h4 className="text-base font-bold text-white">Protección de Operación Activa</h4>
                                        <p className="text-xs text-slate-400 font-mono tabular-nums">
                                            Pedido #{orderId.slice(-6)} · {checkedCount}/{totalItems} verificados
                                        </p>
                                    </div>
                                </div>

                                <p className="text-sm text-slate-300 leading-relaxed">
                                    Para evitar pérdida de surtido o bloqueos en almacén, pon el pedido en espera o autoriza su abandono con tu NIP.
                                </p>

                                <div className="flex flex-col gap-2.5 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowCloseGuard(false)}
                                        className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors"
                                    >
                                        Seguir preparando
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePutOnHold}
                                        disabled={isSubmitting}
                                        className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <PauseCircle size={16} />
                                        <span>Poner en espera (Guardar avance)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowAbandonPinModal(true)}
                                        disabled={isSubmitting}
                                        className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <LockKeyhole size={15} />
                                        <span>Abandonar / Cancelar (Requiere NIP)</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <PinAuthorizationModal
                isOpen={showAbandonPinModal}
                title="Confirmar Abandono de Surtido"
                description={`Ingresa tu NIP de operador para liberar el pedido #${orderId.slice(-6)} y descartar el avance actual.`}
                actionLabel="Abandonar Pedido"
                actionTone="danger"
                requireReason={true}
                defaultReason="Operador pausó / liberó pedido con NIP"
                reasonLabel="Motivo de cancelación o liberación"
                onClose={() => setShowAbandonPinModal(false)}
                onAuthorized={handleConfirmAbandon}
            />
        </div>
    );
}
