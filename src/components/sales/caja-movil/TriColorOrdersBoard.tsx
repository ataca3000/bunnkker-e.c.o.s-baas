"use client";

import React from 'react';
import { 
    User, ShoppingCart, UserCheck, Trash2, Zap, Package, CheckCircle2, 
    Clock, Receipt, Scale, XCircle, ArrowRight, ShieldCheck, AlertCircle 
} from 'lucide-react';

interface TriColorOrdersBoardProps {
    greenOrders: any[];
    yellowOrders: any[];
    blueOrders: any[];
    onClaimOrder: (orderId: string) => void;
    onLoadToPos: (order: any) => void;
    onPicking: (order: any) => void;
    onTender: (order: any) => void;
    onCancel: (orderId: string) => void;
    onDelete: (orderId: string) => void;
    onOpenHistory: () => void;
    onOpenCorte: () => void;
    formatCurrency: (amount: number) => string;
    claimingOrderId?: string | null;
}

export function TriColorOrdersBoard({
    greenOrders,
    yellowOrders,
    blueOrders,
    onClaimOrder,
    onLoadToPos,
    onPicking,
    onTender,
    onCancel,
    onDelete,
    onOpenHistory,
    onOpenCorte,
    formatCurrency,
    claimingOrderId
}: TriColorOrdersBoardProps) {
    const totalBlueCash = blueOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 max-w-full mx-auto select-none">
            
            {/* 🟢 COLUMNA 1: VERDE — "Los que pueden tomar" (Libres / Disponibles) */}
            <div className="xl:col-span-3 flex flex-col bg-emerald-950/15 border-2 border-emerald-500/40 rounded-2xl p-3 sm:p-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                        <div>
                            <h3 className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-wider">
                                1. Por Tomar ({greenOrders.length})
                            </h3>
                            <span className="text-[10px] text-emerald-300/70 font-mono">Disponibles / Libres</span>
                        </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                        VERDE
                    </span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 max-h-[calc(100vh-270px)] custom-scrollbar pr-1">
                    {greenOrders.length === 0 ? (
                        <div className="py-12 text-center text-emerald-300/40 text-xs font-mono border border-dashed border-emerald-500/20 rounded-xl p-4">
                            Sin pedidos por tomar en este momento
                        </div>
                    ) : (
                        greenOrders.map((order, idx) => (
                            <div
                                key={order.id}
                                className="bg-zinc-900/95 border border-emerald-500/30 hover:border-emerald-400/80 rounded-xl p-3 shadow-md transition-all flex flex-col justify-between gap-2.5 relative group"
                            >
                                <div>
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono text-[11px] font-black flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <span className="font-mono font-black text-xs text-white truncate max-w-[140px]">
                                                #{order.id}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            ⚡ LIBRE
                                        </span>
                                    </div>

                                    <div className="space-y-1 text-xs mt-2">
                                        <p className="font-bold text-zinc-200 truncate flex items-center gap-1.5">
                                            <User size={13} className="text-emerald-400 shrink-0" />
                                            {order.customer?.name || 'Cliente Mostrador'}
                                        </p>
                                        {order.customer?.phone && (
                                            <p className="text-[11px] text-zinc-400 font-mono">
                                                Tel: {order.customer?.phone}
                                            </p>
                                        )}
                                    </div>

                                    {/* Artículos */}
                                    {order.items && order.items.length > 0 && (
                                        <div className="bg-black/40 rounded-lg p-2 my-2 border border-white/5 max-h-20 overflow-y-auto text-[11px] text-zinc-300 space-y-0.5 custom-scrollbar">
                                            {order.items.slice(0, 3).map((it: any, i: number) => (
                                                <div key={i} className="flex justify-between">
                                                    <span className="truncate max-w-[140px]">{it.quantity}x {it.name || it.productName || 'Prod'}</span>
                                                    <span className="font-mono text-zinc-400">${Number(it.price * it.quantity).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {order.items.length > 3 && (
                                                <span className="text-[9px] text-emerald-400 italic">+{order.items.length - 3} artículos más</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/50 border border-white/5">
                                        <span className="text-[10px] uppercase font-bold text-zinc-400">Total</span>
                                        <span className="text-sm font-black font-mono text-emerald-400">
                                            {formatCurrency(order.total)}
                                        </span>
                                    </div>
                                </div>

                                {/* Acciones Verde: Tomar y Cargar POS */}
                                <div className="flex gap-1.5 pt-1">
                                    <button
                                        onClick={() => onClaimOrder(order.id)}
                                        disabled={claimingOrderId === order.id}
                                        className="flex-1 py-2 px-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black rounded-lg text-xs transition-all shadow-sm flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                                        title="Asignar este pedido a mi caja"
                                    >
                                        <UserCheck size={14} /> Tomar
                                    </button>
                                    <button
                                        onClick={() => onLoadToPos(order)}
                                        className="p-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 font-bold rounded-lg text-xs transition-all"
                                        title="Cargar al POS"
                                    >
                                        <ShoppingCart size={14} />
                                    </button>
                                    <button
                                        onClick={() => onDelete(order.id)}
                                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 🟡 COLUMNA 2: AMARILLO — "Los que tienes que preparar" (En Almacén / Mostrador) */}
            <div className="xl:col-span-3 flex flex-col bg-amber-950/15 border-2 border-amber-500/40 rounded-2xl p-3 sm:p-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
                        <div>
                            <h3 className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wider">
                                2. Por Preparar ({yellowOrders.length})
                            </h3>
                            <span className="text-[10px] text-amber-300/70 font-mono">Almacén / Mostrador</span>
                        </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                        AMARILLO
                    </span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 max-h-[calc(100vh-270px)] custom-scrollbar pr-1">
                    {yellowOrders.length === 0 ? (
                        <div className="py-12 text-center text-amber-300/40 text-xs font-mono border border-dashed border-amber-500/20 rounded-xl p-4">
                            No hay pedidos pendientes de preparación
                        </div>
                    ) : (
                        yellowOrders.map((order, idx) => (
                            <div
                                key={order.id}
                                className="bg-zinc-900/95 border border-amber-500/30 hover:border-amber-400/80 rounded-xl p-3 shadow-md transition-all flex flex-col justify-between gap-2.5 relative group"
                            >
                                <div>
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 font-mono text-[11px] font-black flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <span className="font-mono font-black text-xs text-white truncate max-w-[140px]">
                                                #{order.id}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                            <Clock size={11} className="animate-spin" /> POR PREPARAR
                                        </span>
                                    </div>

                                    <div className="space-y-1 text-xs mt-2">
                                        <p className="font-bold text-zinc-200 truncate flex items-center gap-1.5">
                                            <User size={13} className="text-amber-400 shrink-0" />
                                            {order.customer?.name || 'Cliente Mostrador'}
                                        </p>
                                        <p className="text-[11px] text-zinc-400">
                                            Atendió: <span className="text-amber-300 font-semibold">{order.vendedorName || 'Caja'}</span>
                                        </p>
                                    </div>

                                    {/* Artículos */}
                                    {order.items && order.items.length > 0 && (
                                        <div className="bg-black/40 rounded-lg p-2 my-2 border border-white/5 max-h-20 overflow-y-auto text-[11px] text-zinc-300 space-y-0.5 custom-scrollbar">
                                            {order.items.slice(0, 3).map((it: any, i: number) => (
                                                <div key={i} className="flex justify-between">
                                                    <span className="truncate max-w-[140px]">{it.quantity}x {it.name || it.productName || 'Prod'}</span>
                                                    <span className="font-mono text-zinc-400">${Number(it.price * it.quantity).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {order.items.length > 3 && (
                                                <span className="text-[9px] text-amber-400 italic">+{order.items.length - 3} artículos más</span>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between p-2 rounded-lg bg-black/50 border border-white/5">
                                        <span className="text-[10px] uppercase font-bold text-zinc-400">Total</span>
                                        <span className="text-sm font-black font-mono text-amber-400">
                                            {formatCurrency(order.total)}
                                        </span>
                                    </div>
                                </div>

                                {/* Acciones Amarillo: Preparar o Surtir y Cobrar */}
                                <div className="space-y-1.5 pt-1">
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <button
                                            onClick={() => onPicking(order)}
                                            className="py-2 px-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black rounded-lg text-xs shadow-md flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                                            title="Recolectar producto por producto con asistencia IA"
                                        >
                                            <Package size={13} /> Recolectar IA
                                        </button>
                                        <button
                                            onClick={() => onTender(order)}
                                            className="py-2 px-2 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-black rounded-lg text-xs flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                                            title="Auto-surtir en mostrador y cobrar de inmediato"
                                        >
                                            <Zap size={13} /> Surtir & Cobrar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 🔵 COLUMNA 3: AZUL — "Los que ya puedes cobrar" (LISTOS PARA COBRO - TODOS) */}
            <div className="xl:col-span-4 flex flex-col bg-sky-950/20 border-2 border-sky-500/50 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-sky-500/20">
                    <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.9)] animate-ping" />
                        <div>
                            <h3 className="text-xs sm:text-sm font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                                3. Listos p/ Cobro ({blueOrders.length})
                            </h3>
                            <span className="text-[10px] text-cyan-300/80 font-mono font-bold">
                                🌐 Caja cobra a todos (${totalBlueCash.toFixed(2)})
                            </span>
                        </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-black border border-cyan-500/40">
                        AZUL (TODOS)
                    </span>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 max-h-[calc(100vh-270px)] custom-scrollbar pr-1">
                    {blueOrders.length === 0 ? (
                        <div className="py-12 text-center text-cyan-300/40 text-xs font-mono border border-dashed border-cyan-500/20 rounded-xl p-4">
                            No hay pedidos listos para cobrar en este momento
                        </div>
                    ) : (
                        blueOrders.map((order, idx) => (
                            <div
                                key={order.id}
                                className="bg-zinc-900/95 border-2 border-cyan-500/50 hover:border-cyan-400 rounded-xl p-3.5 shadow-lg shadow-cyan-950/40 transition-all flex flex-col justify-between gap-3 relative group"
                            >
                                <div>
                                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-300 font-mono text-xs font-black flex items-center justify-center border border-cyan-500/40">
                                                {idx + 1}
                                            </span>
                                            <span className="font-mono font-black text-sm text-white">
                                                #{order.id}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                                            ✓ LISTO P/ COBRO
                                        </span>
                                    </div>

                                    <div className="space-y-1 text-xs mt-2.5">
                                        <p className="font-extrabold text-white text-sm flex items-center gap-1.5 truncate">
                                            <User size={14} className="text-cyan-400 shrink-0" />
                                            {order.customer?.name || 'Cliente Mostrador'}
                                        </p>
                                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                            <span>Surtido por: <strong className="text-cyan-300">{order.loadedBy || 'Almacén'}</strong></span>
                                            {order.deliveryType === 'PATIO' ? (
                                                <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded">
                                                    🏗️ Patio
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/20 px-2 py-0.5 rounded">
                                                    📦 Mostrador
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Artículos */}
                                    {order.items && order.items.length > 0 && (
                                        <div className="bg-black/40 rounded-lg p-2.5 my-2.5 border border-white/10 max-h-24 overflow-y-auto text-xs text-zinc-200 space-y-1 custom-scrollbar">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase block">Artículos ({order.items.length}):</span>
                                            {order.items.map((it: any, i: number) => (
                                                <div key={i} className="flex justify-between text-[11px]">
                                                    <span className="truncate max-w-[180px]">{it.quantity}x {it.name || it.productName || 'Prod'}</span>
                                                    <span className="font-mono text-zinc-300 font-semibold">${Number(it.price * it.quantity).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-cyan-500/30">
                                        <span className="text-xs uppercase font-bold text-zinc-400">Total a Cobrar</span>
                                        <span className="text-base font-black font-mono text-cyan-400">
                                            {formatCurrency(order.total)}
                                        </span>
                                    </div>
                                </div>

                                {/* BOTÓN GIGANTE DE COBRO EN CAJA */}
                                <button
                                    onClick={() => onTender(order)}
                                    className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-black rounded-xl text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                                >
                                    <CheckCircle2 size={18} />
                                    <span>Cobrar en Caja (${Number(order.total).toFixed(2)})</span>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 🟠 COLUMNA 4: NARANJA — LATERAL DE HISTORIAL & CONTROL DE CAJA */}
            <div className="xl:col-span-2 flex flex-col justify-between bg-gradient-to-b from-amber-950/20 via-slate-900/60 to-slate-950/80 border-2 border-amber-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-4">
                <div className="space-y-4">
                    <div className="border-b border-amber-500/20 pb-3">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
                            CONTROL RÁPIDO
                        </span>
                        <h3 className="text-sm font-black text-white uppercase mt-0.5">
                            Historial de Tickets
                        </h3>
                    </div>

                    {/* Botón Principal a Pantalla Completa para Tickets */}
                    <button
                        onClick={onOpenHistory}
                        className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all active:scale-95 group cursor-pointer"
                    >
                        <Receipt size={24} className="group-hover:scale-110 transition-transform" />
                        <span>Ver Historial de Tickets</span>
                        <span className="text-[10px] font-mono bg-black/25 text-slate-950 px-2 py-0.5 rounded-full font-bold">
                            PANTALLA COMPLETA
                        </span>
                    </button>

                    {/* Botón Corte de Caja */}
                    <button
                        onClick={onOpenCorte}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                        <Scale size={15} />
                        <span>Corte de Caja Ciego</span>
                    </button>

                    {/* Resumen del Flujo */}
                    <div className="bg-black/50 rounded-xl p-3 border border-white/5 space-y-2 text-xs">
                        <span className="text-[10px] font-bold uppercase text-zinc-500 block">Flujo de Pedidos:</span>
                        
                        <div className="flex items-center justify-between text-emerald-400">
                            <span>🟢 Por Tomar:</span>
                            <span className="font-mono font-bold">{greenOrders.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-400">
                            <span>🟡 Por Preparar:</span>
                            <span className="font-mono font-bold">{yellowOrders.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-cyan-400 font-bold">
                            <span>🔵 Listos Cobro:</span>
                            <span className="font-mono">{blueOrders.length}</span>
                        </div>
                        
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-white font-mono font-bold">
                            <span>Por Cobrar:</span>
                            <span className="text-cyan-400">${totalBlueCash.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Nota informativa de Fontanería */}
                <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-[10px] text-cyan-300/80 leading-relaxed font-sans">
                    💡 <strong>Regla de Caja:</strong> Una vez cobrados en la columna azul, los pedidos pasan al <strong>Historial de Tickets</strong> y se expulsa el comprobante fiscal/impreso.
                </div>
            </div>

        </div>
    );
}
