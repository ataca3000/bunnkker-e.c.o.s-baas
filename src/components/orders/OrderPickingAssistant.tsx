"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    CheckCircle2, Circle, Package, MapPin, Truck, Store, 
    ArrowRight, Sparkles, UserCheck, RefreshCw, X, ShieldCheck, 
    Layers, AlertCircle, ArrowLeftRight
} from 'lucide-react';
import { toast } from '@/lib/toast';

export interface OrderPickingAssistantProps {
    order: any;
    role: 'sales' | 'inventory' | 'carga' | 'pickup' | 'driver' | string;
    mode?: 'picking' | 'deconstruction';
    onClose: () => void;
    onComplete: (data: { orderId: string; pickedItems: string[]; targetAction?: string }) => void;
    onDelegate?: (orderId: string, targetRole: 'caja' | 'carga' | 'pickup') => void;
}

export default function OrderPickingAssistant({
    order,
    role,
    mode = 'picking',
    onClose,
    onComplete,
    onDelegate
}: OrderPickingAssistantProps) {
    const items = order?.items || [];
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

    const toggleItem = (itemId: string) => {
        setCheckedItems(prev => {
            const next = { ...prev, [itemId]: !prev[itemId] };
            return next;
        });
    };

    const markCurrentAndNext = () => {
        if (!currentItemId) return;
        setCheckedItems(prev => ({ ...prev, [currentItemId]: true }));
        if (currentItemIndex < totalItems - 1) {
            setCurrentItemIndex(prev => prev + 1);
        }
    };

    const handleSelectAll = () => {
        const next: Record<string, boolean> = {};
        items.forEach((it: any) => {
            next[it.productId || it.id] = true;
        });
        setCheckedItems(next);
        toast.success('Todos los artículos marcados como recolectados.');
    };

    const handleFinish = async () => {
        if (!isAllChecked) {
            toast.warning('Aún faltan artículos por marcar como recolectados.');
            return;
        }
        setIsSubmitting(true);
        try {
            await onComplete({
                orderId: order.id,
                pickedItems: Object.keys(checkedItems).filter(k => checkedItems[k])
            });
        } catch (e: any) {
            toast.error(e?.message || 'Error al completar la recolección.');
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

    // Mensaje dinámico de IA LION según el rol y modo
    const getAiMessage = () => {
        if (mode === 'deconstruction') {
            return '🦁 LION Auditor: Modo Deconstrucción. Devuelve cada material físico a su estante y anaquel correspondiente para restaurar el inventario.';
        }
        const deliveryType = order?.deliveryType || 'LOCAL';
        if (role === 'driver') {
            return '🦁 LION Reparto: Audita que cada material esté físicamente colocado en tu batea/vehículo antes de confirmar la salida a ruta.';
        }
        if (role === 'carga' || deliveryType === 'PATIO') {
            return '🦁 LION Patio: Verifica bultos pesados (varilla, cemento, agregados). Si estás en bahía, ten lista la carretilla/montacargas.';
        }
        if (role === 'sales') {
            return '🦁 LION Mostrador: Modo Operador Único activo. Reúne estos productos en mostrador para pasar directamente al cobro y ticket.';
        }
        return '🦁 LION Almacén: Sigue la secuencia por pasillo y estante para optimizar tu tiempo de recolección.';
    };

    const getFinishButtonLabel = () => {
        if (mode === 'deconstruction') return '📦 Confirmar Reincorporación a Anaquel (100%)';
        if (role === 'sales') return '💳 Pasar a Cobro y Ticket';
        if (role === 'driver') return '🚚 Carga Verificada — Iniciar Ruta';
        if (role === 'carga' || order?.deliveryType === 'PATIO') return '🏗️ Listo en Bahía de Carga';
        return '✅ Marcar Listo en Mostrador';
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans"
            >
                {/* Cabecera */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700/70 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                            mode === 'deconstruction' 
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}>
                            <Package size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                    mode === 'deconstruction'
                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                }`}>
                                    {mode === 'deconstruction' ? 'Deconstrucción / Restock' : 'Recolección IA'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                                    {order?.deliveryType || 'LOCAL'}
                                </span>
                            </div>
                            <h3 className="text-base font-black text-white">
                                {mode === 'deconstruction' ? 'Regresar a Anaquel — ' : 'Pedido #'}
                                {order?.id?.slice(0, 8)}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {role !== 'driver' && (
                            <button
                                onClick={() => setIsDelegating(!isDelegating)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
                                title="Delegar a otro rol"
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
                    {isDelegating && (
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

                {/* Mensaje Asistente LION */}
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center gap-2.5 text-xs text-amber-200">
                    <Sparkles size={16} className="text-amber-400 shrink-0" />
                    <p className="font-medium">{getAiMessage()}</p>
                </div>

                {/* Barra de Progreso */}
                <div className="px-6 pt-4 pb-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
                        <span>Progreso de Recolección</span>
                        <span className="font-mono text-amber-400">{checkedCount} de {totalItems} artículos ({progressPercent}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                        <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300 rounded-full"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Contenido Principal con Scroll */}
                <div className="flex-1 overflow-y-auto px-6 py-3 space-y-4">
                    {/* Tarjeta de Foco: Producto Actual a recolectar */}
                    {currentItem && !isAllChecked && (
                        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-lg relative overflow-hidden">
                            <div className="text-[10px] font-black uppercase tracking-wider text-amber-400 mb-1">
                                Enfoque Actual ({currentItemIndex + 1} de {totalItems})
                            </div>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h4 className="text-lg font-black text-white leading-tight">
                                        {currentItem.product?.name || currentItem.name || 'Producto'}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-mono">
                                        <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                                            Cant: <strong className="text-amber-400 text-sm">{currentItem.cantidad || currentItem.quantity || 1}</strong>
                                        </span>
                                        <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 flex items-center gap-1">
                                            <MapPin size={12} className="text-cyan-400" />
                                            Estante: <strong className="text-white">{currentItem.product?.estante || 'A-1'}</strong> / Fila: <strong className="text-white">{currentItem.product?.fila || '1'}</strong>
                                        </span>
                                        {currentItem.product?.category && (
                                            <span className="px-2 py-0.5 rounded bg-slate-950/60 text-slate-400 border border-slate-800/60">
                                                {currentItem.product.category}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={markCurrentAndNext}
                                    className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-95 shrink-0"
                                >
                                    <CheckCircle2 size={16} />
                                    <span>Marcar y Siguiente</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Lista Completa Interactiva */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Checklist Completo ({totalItems} Productos)
                            </span>
                            {!isAllChecked && (
                                <button
                                    onClick={handleSelectAll}
                                    className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline transition-colors"
                                >
                                    Marcar todos listos
                                </button>
                            )}
                        </div>

                        <div className="space-y-2">
                            {items.map((item: any, idx: number) => {
                                const itemId = item.productId || item.id;
                                const isChecked = Boolean(checkedItems[itemId]);
                                const isSelected = idx === currentItemIndex;

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
                                                    ? 'bg-slate-800 border-amber-500/40 text-white'
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
                                                <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                                                    <span>Ubicación: {item.product?.estante || 'A-1'} / Fila {item.product?.fila || '1'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right font-mono">
                                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-amber-400">
                                                x{item.cantidad || item.quantity || 1}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
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
                        <span>{getFinishButtonLabel()}</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
