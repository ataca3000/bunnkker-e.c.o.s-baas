"use client";

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, Circle, Package, MapPin, Truck, Store, 
    Sparkles, RefreshCw, X, ShieldCheck, ArrowLeftRight,
    CornerDownRight, ThumbsUp, SkipForward, CheckCheck
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface OrderPickingAssistantProps {
    order: any;
    role: 'sales' | 'inventory' | 'carga' | 'pickup' | 'driver' | string;
    mode?: 'picking' | 'deconstruction';
    onClose: () => void;
    onComplete: (orderId: string) => void | Promise<void>;
    onDelegate?: (orderId: string, targetRole: 'caja' | 'carga' | 'pickup') => void | Promise<void>;
}

export default function OrderPickingAssistant({
    order,
    role,
    mode = 'picking',
    onClose,
    onComplete,
    onDelegate
}: OrderPickingAssistantProps) {
    const items = useMemo(() => order?.items || [], [order]);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        items.forEach((item: any) => {
            const itemId = item.productId || item.id;
            initial[itemId] = false;
        });
        return initial;
    });

    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [isDelegating, setIsDelegating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const totalItems = items.length;
    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    const progressPercent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;
    const isAllChecked = totalItems > 0 && checkedCount === totalItems;

    const currentItem = items[currentItemIndex] || items[0];
    const currentItemId = currentItem?.productId || currentItem?.id;

    // Obtener formato amigable de ubicación
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
        setCheckedItems(prev => ({ ...prev, [currentItemId]: true }));
        // Avanzar al siguiente ítem aún no completado
        const nextIndex = items.findIndex((it: any, idx: number) => idx > currentItemIndex && !checkedItems[it.productId || it.id]);
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
            await onComplete(order.id);
        } catch (e: any) {
            toast.error(e?.message || 'Error al completar la operación.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelegateClick = (target: 'caja' | 'carga' | 'pickup') => {
        if (onDelegate) {
            onDelegate(order.id, target);
        }
        setIsDelegating(false);
    };

    // Chatbot Conversacional LION: Mensajes dinámicos según el avance
    const getChatbotSpeech = () => {
        const currentName = currentItem?.product?.name || currentItem?.name || 'este artículo';
        const currentQty = currentItem?.cantidad || currentItem?.quantity || 1;
        const currentLoc = getItemLocation(currentItem);

        if (isAllChecked) {
            if (mode === 'deconstruction') {
                return `¡Listo! Todos los productos están de regreso en su lugar. El pedido queda marcado como Cancelado con stock restituido en anaqueles.`;
            }
            if (role === 'sales') {
                return `¡Genial! Ya reuniste todos los productos de este pedido en mostrador. Ya está listo para pasar directo a cobrar y generar ticket.`;
            }
            if (role === 'driver') {
                return `¡Excelente! Ya verificaste la carga completa de esta orden en tu vehículo. Estás listo para arrancar la ruta con seguridad.`;
            }
            if (role === 'carga' || order?.deliveryType === 'PATIO') {
                return `¡Todo completo en batea! Los materiales pesados están listos para que el cliente pase a cargar con foto y firma.`;
            }
            return `¡Excelente trabajo! Todo el pedido está completo y listo para entregar al cliente.`;
        }

        if (mode === 'deconstruction') {
            if (currentItemIndex === 0) {
                return `¡Uy, qué mal que se canceló! Pero te ayudo a reacomodarlo: este "${currentName}" (${currentQty} pzas) va de vuelta en [📍 ${currentLoc}]. Colócalo en su anaquel y márcalo.`;
            }
            return `Listo. Ahora este "${currentName}" (${currentQty} pzas) se ubicaba en [📍 ${currentLoc}]. Regrésalo a su lugar físico para reponer stock.`;
        }

        // Modo Picking Normal
        if (currentItemIndex === 0) {
            return `Bien, el primero es "${currentName}" (${currentQty} pzas), ubicado en [📍 ${currentLoc}]. ¿Lo tienes a la mano?`;
        }
        return `¡Excelente! Ahora recolectemos "${currentName}" (${currentQty} pzas), que está ubicado en [📍 ${currentLoc}].`;
    };

    const finishButtonText = () => {
        if (mode === 'deconstruction') return '↩️ Confirmar Stock de Vuelta (100%)';
        if (role === 'sales') return '💳 Pasar a Cobro y Ticket';
        if (role === 'driver') return '🚚 Carga Verificada — Salir a Ruta';
        if (role === 'inventory') {
            return order?.deliveryType === 'PATIO' ? '🏗️ Entregar a Bahía de Carga (Patio)' : '🏪 Entregar a Mostrador (Caja)';
        }
        if (role === 'carga' || order?.deliveryType === 'PATIO') return '🏗️ Listo en Bahía de Patio (PoD)';
        return '🛍️ Marcar Listo para Entrega';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200">
            <motion.div 
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans"
            >
                {/* Cabecera */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-3 border-b border-slate-700/70 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base shadow-md shrink-0 ${
                            mode === 'deconstruction' 
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                                : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        }`}>
                            🦁
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                    mode === 'deconstruction'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                        : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                                }`}>
                                    {mode === 'deconstruction' ? 'Deconstrucción' : 'Recolección IA'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                                    {order?.deliveryType || 'LOCAL'}
                                </span>
                            </div>
                            <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                                {mode === 'deconstruction' ? 'Reacomodar — ' : 'Pedido #'}
                                {order?.id?.slice(0, 8)} • <span className="text-slate-400 font-normal">{order?.customerName || order?.customer?.name || 'Cliente'}</span>
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {role !== 'driver' && (
                            <button
                                onClick={() => setIsDelegating(!isDelegating)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
                                title="Delegar pedido a otra área si estás ocupado"
                            >
                                <ArrowLeftRight size={14} className="text-cyan-400" />
                                <span className="hidden sm:inline">Delegar</span>
                            </button>
                        )}
                        <button 
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                            <X size={16} />
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
                            className="bg-slate-950/95 border-b border-cyan-500/30 p-2.5 px-5 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-2 shrink-0"
                        >
                            <span>Pasar pedido a otra área:</span>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleDelegateClick('caja')}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 font-bold"
                                >
                                    A Caja (Mostrador)
                                </button>
                                <button 
                                    onClick={() => handleDelegateClick('carga')}
                                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-bold"
                                >
                                    A Carga (Patio)
                                </button>
                                <button 
                                    onClick={() => handleDelegateClick('pickup')}
                                    className="px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 font-bold"
                                >
                                    A Pick up
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Cuerpo del Asistente en 3 Columnas (Layout Ergonómico 1 | 2 | 3) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
                    
                    {/* COLUMNA 1: 🦁 LION Asistente y Diálogo Activo */}
                    <div className="lg:col-span-4 p-4 sm:p-5 flex flex-col justify-between bg-slate-900/60 overflow-y-auto space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-lg">
                                    🦁
                                </div>
                                <div className="flex-1 bg-slate-950/80 border border-slate-700/80 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-200 leading-relaxed shadow-sm">
                                    <span className="font-black text-amber-400 block text-xs uppercase tracking-wide mb-1">
                                        LION Asistente:
                                    </span>
                                    <p>{getChatbotSpeech()}</p>
                                </div>
                            </div>

                            {/* Ficha del artículo en curso */}
                            {currentItem && (
                                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                                    <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider block">
                                        Artículo en Turno ({currentItemIndex + 1} de {totalItems})
                                    </span>
                                    <div className="text-sm font-bold text-white">
                                        {currentItem.product?.name || currentItem.name || 'Producto'}
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-sky-300 font-mono flex items-center gap-1">
                                            <MapPin size={13} /> {getItemLocation(currentItem)}
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold text-xs">
                                            Cant: {currentItem.cantidad || currentItem.quantity || 1}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Botones de Respuesta Rápida de la Columna 1 */}
                        <div className="flex flex-col gap-2 pt-2">
                            {!isAllChecked ? (
                                <>
                                    <button
                                        onClick={markCurrentAndNext}
                                        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                                    >
                                        <ThumbsUp size={16} />
                                        <span>{mode === 'deconstruction' ? '¡Listo, ya lo regresé!' : '¡Listo, ya lo tomé!'}</span>
                                    </button>
                                    
                                    <div className="flex items-center gap-2">
                                        {totalItems > 1 && (
                                            <button
                                                onClick={handleSkipCurrent}
                                                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                                            >
                                                <SkipForward size={14} />
                                                <span>Saltar por ahora</span>
                                            </button>
                                        )}

                                        {mode === 'deconstruction' && (
                                            <button
                                                onClick={handleSelectAll}
                                                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                                            >
                                                <CheckCheck size={14} />
                                                <span>Restituir todos</span>
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-center text-xs font-bold">
                                    ✨ ¡Todos los artículos han sido verificados!
                                </div>
                            )}
                        </div>
                    </div>

                    {/* COLUMNA 2: Lista Completa de Artículos y Checklist */}
                    <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col overflow-hidden bg-slate-950/40">
                        {/* Barra de Progreso */}
                        <div className="pb-3 border-b border-slate-800 mb-3 shrink-0">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
                                <span className="uppercase tracking-wider">{mode === 'deconstruction' ? 'Reacomodo' : 'Surtido'}</span>
                                <span className="font-mono text-amber-400">{checkedCount} / {totalItems} ({progressPercent}%)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                                <div 
                                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300 rounded-full"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>

                        {/* Items Scrollable List */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                Checklist de Materiales ({totalItems})
                            </div>

                            {items.map((item: any, idx: number) => {
                                const itemId = item.productId || item.id;
                                const isChecked = Boolean(checkedItems[itemId]);
                                const isSelected = idx === currentItemIndex;
                                const loc = getItemLocation(item);
                                const qty = item.cantidad || item.quantity || 1;

                                return (
                                    <div
                                        key={itemId}
                                        onClick={() => {
                                            toggleItem(itemId);
                                            setCurrentItemIndex(idx);
                                        }}
                                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                            isChecked 
                                                ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-300' 
                                                : isSelected
                                                    ? 'bg-slate-800 border-amber-500/60 shadow-md text-white'
                                                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="text-sm shrink-0">
                                                {isChecked ? (
                                                    <CheckCircle2 size={18} className="text-emerald-400" />
                                                ) : (
                                                    <Circle size={18} className="text-slate-500 hover:text-amber-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className={`text-xs sm:text-sm font-bold truncate ${isChecked ? 'line-through text-slate-400' : 'text-white'}`}>
                                                    {item.product?.name || item.name || 'Producto'}
                                                </div>
                                                <div className="text-[11px] text-sky-400 font-mono flex items-center gap-1.5 mt-0.5 truncate">
                                                    <MapPin size={11} className="shrink-0" />
                                                    <span className="truncate">{loc}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right font-mono shrink-0">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400">
                                                x{qty}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* COLUMNA 3: Entrega, Destino y Cierre Operativo */}
                    <div className="lg:col-span-3 p-4 sm:p-5 flex flex-col justify-between bg-slate-900/40 space-y-4">
                        <div className="space-y-4">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                    Destino Operativo
                                </span>
                                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                        {order?.deliveryType === 'PATIO' ? (
                                            <><span>🏗️</span> Bahía de Carga (Patio)</>
                                        ) : order?.deliveryType === 'DELIVERY' ? (
                                            <><span>🚚</span> Ruta de Reparto Domicilio</>
                                        ) : (
                                            <><span>🏪</span> Mostrador / Caja Central</>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-1">
                                        {order?.deliveryType === 'PATIO'
                                            ? 'Los materiales se entregan al operador de patio.'
                                            : 'El cliente retirará en mostrador local.'}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                                    Resumen de Recolección
                                </span>
                                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
                                    <div className="flex justify-between text-slate-400">
                                        <span>Total Artículos:</span>
                                        <span className="font-mono text-white font-bold">{totalItems}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Recolectados:</span>
                                        <span className="font-mono text-emerald-400 font-bold">{checkedCount}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-400">
                                        <span>Pendientes:</span>
                                        <span className="font-mono text-amber-400 font-bold">{totalItems - checkedCount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Botones de Finalización en Columna 3 */}
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                            <button
                                onClick={handleFinish}
                                disabled={!isAllChecked || isSubmitting}
                                className={`w-full py-3.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                                    isAllChecked
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 active:scale-95 cursor-pointer'
                                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                                }`}
                            >
                                <ShieldCheck size={16} />
                                <span>{finishButtonText()}</span>
                            </button>

                            <button
                                onClick={onClose}
                                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                            >
                                Cancelar / Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
