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
        if (role === 'carga' || order?.deliveryType === 'PATIO') return '🏗️ Listo en Bahía de Patio (PoD)';
        return '🛍️ Marcar Listo para Entrega';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans"
            >
                {/* Cabecera */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shadow-md ${
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
                                    {mode === 'deconstruction' ? 'Deconstrucción de Pedido' : 'Recolección IA'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                                    {order?.deliveryType || 'LOCAL'}
                                </span>
                            </div>
                            <h3 className="text-base font-black text-white">
                                {mode === 'deconstruction' ? 'Reacomodar a Anaquel — ' : 'Pedido #'}
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
                                <span>Delegar</span>
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
                            className="bg-slate-950/90 border-b border-cyan-500/30 p-3 px-6 flex items-center justify-between text-xs text-slate-300 overflow-hidden"
                        >
                            <span>¿Deseas pasar este pedido a otra área sin esperar?</span>
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

                {/* 🦁 CHATBOT DIALOG CON RESPUESTAS SUGERIDAS (Sin necesidad de teclear) */}
                <div className="bg-gradient-to-b from-slate-800/90 to-slate-850 p-5 border-b border-slate-700/60 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-base">
                            🦁
                        </div>
                        <div className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-2xl rounded-tl-sm p-3 text-sm text-slate-200 leading-relaxed shadow-sm">
                            <span className="font-black text-amber-400 block text-xs uppercase tracking-wide mb-1">
                                LION Asistente:
                            </span>
                            <p>{getChatbotSpeech()}</p>
                        </div>
                    </div>

                    {/* Botones de Respuestas Sugeridas Rápidas */}
                    <div className="flex flex-wrap items-center gap-2 pl-11">
                        {!isAllChecked ? (
                            <>
                                <button
                                    onClick={markCurrentAndNext}
                                    className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
                                >
                                    <ThumbsUp size={14} />
                                    <span>{mode === 'deconstruction' ? '¡Listo, ya lo regresé!' : '¡Listo, ya lo tomé!'}</span>
                                </button>
                                
                                {totalItems > 1 && (
                                    <button
                                        onClick={handleSkipCurrent}
                                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
                                    >
                                        <SkipForward size={14} />
                                        <span>Saltar por ahora</span>
                                    </button>
                                )}

                                <button
                                    onClick={handleSelectAll}
                                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors ml-auto"
                                >
                                    <CheckCheck size={14} />
                                    <span>Marcar todos</span>
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleFinish}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                            >
                                <ShieldCheck size={16} />
                                <span>{finishButtonText()}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Barra de Progreso */}
                <div className="px-6 pt-3 pb-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1">
                        <span>{mode === 'deconstruction' ? 'Progreso de Reacomodo' : 'Progreso de Surtido'}</span>
                        <span className="font-mono text-amber-400">{checkedCount} de {totalItems} artículos ({progressPercent}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Lista Completa Interactiva */}
                <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
                    <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider mb-2">
                        Lista de Artículos ({totalItems})
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
                                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                    isChecked 
                                        ? 'bg-emerald-950/20 border-emerald-500/40 text-slate-300' 
                                        : isSelected
                                            ? 'bg-slate-800 border-amber-500/50 shadow-md text-white'
                                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="text-sm">
                                        {isChecked ? (
                                            <CheckCircle2 size={20} className="text-emerald-400" />
                                        ) : (
                                            <Circle size={20} className="text-slate-500 hover:text-amber-400" />
                                        )}
                                    </div>
                                    <div>
                                        <div className={`text-sm font-bold ${isChecked ? 'line-through text-slate-400' : 'text-white'}`}>
                                            {item.product?.name || item.name || 'Producto'}
                                        </div>
                                        <div className="text-xs text-sky-400 font-mono flex items-center gap-1.5 mt-0.5">
                                            <MapPin size={12} />
                                            <span>{loc}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right font-mono">
                                    <span className="text-xs font-bold px-2 py-1 rounded bg-slate-900 border border-slate-800 text-amber-400">
                                        x{qty}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Pie de Acciones */}
                <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
                    >
                        Cerrar
                    </button>

                    <button
                        onClick={handleFinish}
                        disabled={!isAllChecked || isSubmitting}
                        className={`px-6 py-3 rounded-xl font-black text-xs flex items-center gap-2 shadow-lg transition-all ${
                            isAllChecked
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/20 active:scale-95 cursor-pointer'
                                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                        }`}
                    >
                        <ShieldCheck size={16} />
                        <span>{finishButtonText()}</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
