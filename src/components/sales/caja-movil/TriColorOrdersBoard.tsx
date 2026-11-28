"use client";

import React from 'react';
import {
    User, ShoppingCart, UserCheck, Trash2, Zap, Package, CheckCircle2,
    Clock, Receipt, Scale, PenTool, Lock, Unlock
} from 'lucide-react';
import {
    getOrderLockInfo,
    getOrderWorkflowStage,
    getStageMeta,
    normalizeDeliveryType,
} from '@/lib/orderWorkflow';

interface TriColorOrdersBoardProps {
    greenOrders: any[];
    yellowOrders: any[];
    blueOrders: any[];
    readyOrders?: any[];
    currentUserUid?: string | null;
    currentUserRole?: string | null;
    onClaimOrder: (orderId: string) => void;
    onReleaseClaim?: (orderId: string, slot?: 'loading' | 'cashier' | 'delivery' | 'auto') => void;
    onUpdateStatus?: (orderId: string, status: string) => void;
    onLoadToPos: (order: any) => void;
    onPicking: (order: any) => void;
    onTender: (order: any) => void;
    onDeliveryProof?: (order: any) => void;
    onCancel: (orderId: string) => void;
    onDelete: (orderId: string) => void;
    onOpenHistory: () => void;
    onOpenCorte: () => void;
    formatCurrency: (amount: number) => string;
    claimingOrderId?: string | null;
}

function DeliveryMethodBadge({ order }: { order: any }) {
    const dt = normalizeDeliveryType(order);
    if (dt === 'DELIVERY') {
        return (
            <span className="text-[10px] text-sky-300 font-bold bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 rounded">
                🛵 Reparto
            </span>
        );
    }
    if (dt === 'PATIO') {
        return (
            <span className="text-[10px] text-amber-300 font-bold bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded">
                🏗️ Patio
            </span>
        );
    }
    return (
        <span className="text-[10px] text-emerald-300 font-bold bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded">
            📦 Mostrador
        </span>
    );
}

function LockStatusBanner({
    order,
    currentUserUid,
    currentUserRole,
    onReleaseClaim,
}: {
    order: any;
    currentUserUid?: string | null;
    currentUserRole?: string | null;
    onReleaseClaim?: (orderId: string, slot?: 'loading' | 'cashier' | 'delivery' | 'auto') => void;
}) {
    const lock = getOrderLockInfo(order, currentUserUid, currentUserRole);
    const stageMeta = getStageMeta(getOrderWorkflowStage(order));

    if (!lock.isLocked) {
        return (
            <div className="flex items-center justify-between text-[10px] bg-black/35 border border-white/5 rounded-lg px-2 py-1 text-zinc-400">
                <span>{stageMeta.shortLabel}</span>
                <span className="text-emerald-400 font-bold">Libre</span>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center justify-between gap-2 text-[10px] rounded-lg px-2 py-1 border ${
                lock.isLockedByMe
                    ? 'bg-sky-500/15 border-sky-500/35 text-sky-200'
                    : 'bg-rose-500/15 border-rose-500/35 text-rose-200'
            }`}
        >
            <span className="flex items-center gap-1 truncate font-bold">
                <Lock size={11} className="shrink-0" />
                {lock.isLockedByMe
                    ? `Tomado por ti (${lock.lockedRoleLabel})`
                    : `Bloqueado: ${lock.lockedByName} (${lock.lockedRoleLabel})`}
            </span>
            {onReleaseClaim && (lock.isLockedByMe || lock.canAdminOverride) && (
                <button
                    type="button"
                    onClick={() => onReleaseClaim(order.id, lock.lockedScope || 'auto')}
                    className="px-1.5 py-0.5 rounded bg-black/40 hover:bg-black/70 text-[10px] font-bold flex items-center gap-0.5 shrink-0 cursor-pointer"
                    title="Liberar bloqueo y devolver pedido a la pizarra"
                >
                    <Unlock size={10} /> Soltar
                </button>
            )}
        </div>
    );
}

export function TriColorOrdersBoard({
    greenOrders,
    yellowOrders,
    blueOrders,
    readyOrders = [],
    currentUserUid,
    currentUserRole,
    onClaimOrder,
    onReleaseClaim,
    onUpdateStatus,
    onLoadToPos,
    onPicking,
    onTender,
    onDeliveryProof,
    onDelete,
    onOpenHistory,
    onOpenCorte,
    formatCurrency,
    claimingOrderId
}: TriColorOrdersBoardProps) {
    const totalBlueCash = blueOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 sm:gap-4 max-w-full mx-auto select-none">

            {/* COLUMNA 1: VERDE — En Pizarra (Disponibles para Tomar) */}
            <div className="xl:col-span-2 flex flex-col bg-emerald-950/15 border border-emerald-500/40 rounded-2xl p-3 sm:p-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-400" />
                        <div>
                            <h3 className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-wider">
                                1. Pizarra ({greenOrders.length})
                            </h3>
                            <span className="text-[10px] text-emerald-300/70 font-mono">Disponibles / Libres</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 max-h-[calc(100vh-270px)] custom-scrollbar pr-1">
                    {greenOrders.length === 0 ? (
                        <div className="py-12 text-center text-emerald-300/40 text-xs font-mono border border-dashed border-emerald-500/20 rounded-xl p-4">
                            Sin pedidos libres en pizarra
                        </div>
                    ) : (
                        greenOrders.map((order, idx) => {
                            const lock = getOrderLockInfo(order, currentUserUid, currentUserRole);
                            const blockedForMe = lock.isLockedByOther && !lock.canAdminOverride;

                            return (
                                <div
                                    key={order.id}
                                    className={`bg-zinc-900/95 border rounded-xl p-3 shadow-md transition-all flex flex-col justify-between gap-2.5 ${
                                        lock.isLockedByOther
                                            ? 'border-rose-500/35 opacity-80'
                                            : 'border-emerald-500/30 hover:border-emerald-400/80'
                                    }`}
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-2 gap-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 font-mono text-[11px] font-black flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <span className="font-mono font-black text-xs text-white truncate">
                                                    #{order.id.slice(-8)}
                                                </span>
                                            </div>
                                            <DeliveryMethodBadge order={order} />
                                        </div>

                                        <LockStatusBanner
                                            order={order}
                                            currentUserUid={currentUserUid}
                                            currentUserRole={currentUserRole}
                                            onReleaseClaim={onReleaseClaim}
                                        />

                                        <div className="space-y-1 text-xs">
                                            <p className="font-bold text-zinc-200 truncate flex items-center gap-1.5">
                                                <User size={13} className="text-emerald-400 shrink-0" />
                                                {order.customer?.name || 'Cliente'}
                                            </p>
                                            {order.customer?.phone && (
                                                <p className="text-[11px] text-zinc-400 font-mono">
                                                    Tel: {order.customer?.phone}
                                                </p>
                                            )}
                                        </div>

                                        {order.items && order.items.length > 0 && (
                                            <div className="bg-black/40 rounded-lg p-2 border border-white/5 max-h-20 overflow-y-auto text-[11px] text-zinc-300 space-y-0.5 custom-scrollbar">
                                                {order.items.slice(0, 3).map((it: any, i: number) => (
                                                    <div key={i} className="flex justify-between">
                                                        <span className="truncate max-w-[130px]">{it.quantity}x {it.name || it.productName || 'Prod'}</span>
                                                        <span className="font-mono text-zinc-400">${Number((it.price || 0) * (it.quantity || 1)).toFixed(2)}</span>
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

                                    <div className="flex gap-1.5 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => onClaimOrder(order.id)}
                                            disabled={claimingOrderId === order.id || blockedForMe || lock.isLockedByMe}
                                            className={`flex-1 py-2 px-2 font-black rounded-lg text-xs transition-all flex items-center justify-center gap-1 ${
                                                blockedForMe || lock.isLockedByMe
                                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white active:scale-95 cursor-pointer'
                                            }`}
                                            title={blockedForMe ? `Bloqueado por ${lock.lockedByName}` : 'Tomar y bloquear este pedido en mi rol'}
                                        >
                                            <UserCheck size={14} /> {blockedForMe ? 'Bloqueado' : 'Tomar'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onLoadToPos(order)}
                                            disabled={blockedForMe}
                                            className="p-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 font-bold rounded-lg text-xs transition-all disabled:opacity-40 cursor-pointer"
                                            title="Cargar al POS"
                                        >
                                            <ShoppingCart size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDelete(order.id)}
                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs cursor-pointer"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* COLUMNA 2: AMARILLO — En Preparación / Bloqueados por Rol */}
            <div className="xl:col-span-2 flex flex-col bg-amber-950/15 border border-amber-500/40 rounded-2xl p-3 sm:p-4 shadow-lg backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-400" />
                        <div>
                            <h3 className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wider">
                                2. Preparando ({yellowOrders.length})
                            </h3>
                            <span className="text-[10px] text-amber-300/70 font-mono">Surtido y Estado</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 max-h-[calc(100vh-270px)] custom-scrollbar pr-1">
                    {yellowOrders.length === 0 ? (
                        <div className="py-12 text-center text-amber-300/40 text-xs font-mono border border-dashed border-amber-500/20 rounded-xl p-4">
                            No hay pedidos pendientes de preparación
                        </div>
                    ) : (
                        yellowOrders.map((order, idx) => {
                            const lock = getOrderLockInfo(order, currentUserUid, currentUserRole);
                            const blockedForMe = lock.isLockedByOther && !lock.canAdminOverride;

                            return (
                                <div
                                    key={order.id}
                                    className={`bg-zinc-900/95 border rounded-xl p-3 shadow-md transition-all flex flex-col justify-between gap-2.5 ${
                                        lock.isLockedByOther
                                            ? 'border-rose-500/35 opacity-85'
                                            : 'border-amber-500/30 hover:border-amber-400/80'
                                    }`}
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-2 gap-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 font-mono text-[11px] font-black flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <span className="font-mono font-black text-xs text-white truncate">
                                                    #{order.id.slice(-8)}
                                                </span>
                                            </div>
                                            <DeliveryMethodBadge order={order} />
                                        </div>

                                        <LockStatusBanner
                                            order={order}
                                            currentUserUid={currentUserUid}
                                            currentUserRole={currentUserRole}
                                            onReleaseClaim={onReleaseClaim}
                                        />

                                        <div className="space-y-1 text-xs">
                                            <p className="font-bold text-zinc-200 truncate flex items-center gap-1.5">
                                                <User size={13} className="text-amber-400 shrink-0" />
                                                {order.customer?.name || 'Cliente Mostrador'}
                                            </p>
                                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={11} className="text-amber-400" />
                                                    Estado: <strong className="text-amber-300">{order.status}</strong>
                                                </span>
                                            </div>
                                        </div>

                                        {order.items && order.items.length > 0 && (
                                            <div className="bg-black/40 rounded-lg p-2 border border-white/5 max-h-20 overflow-y-auto text-[11px] text-zinc-300 space-y-0.5 custom-scrollbar">
                                                {order.items.slice(0, 3).map((it: any, i: number) => (
                                                    <div key={i} className="flex justify-between">
                                                        <span className="truncate max-w-[130px]">{it.quantity}x {it.name || it.productName || 'Prod'}</span>
                                                        <span className="font-mono text-zinc-400">${Number((it.price || 0) * (it.quantity || 1)).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                                {order.items.length > 3 && (
                                                    <span className="text-[9px] text-amber-400 italic">+{order.items.length - 3} artículos más</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Selector de actualización de estado para quien tiene el bloqueo */}
                                        {onUpdateStatus && !blockedForMe && (
                                            <select
                                                value={['PREPARANDO', 'EN_ESPERA', 'PENDIENTE_LLEGADA', 'READY_FOR_PICKUP', 'READY_TO_SHIP'].includes(order.status) ? order.status : ''}
                                                onChange={(e) => {
                                                    if (e.target.value) onUpdateStatus(order.id, e.target.value);
                                                }}
                                                className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-2 py-1.5 text-[11px] font-bold text-amber-200 outline-none cursor-pointer"
                                                title="Actualizar estado del pedido"
                                            >
                                                <option value="">Actualizar estado...</option>
                                                <option value="PREPARANDO">En Preparación</option>
                                                <option value="EN_ESPERA">En Espera</option>
                                                <option value="PENDIENTE_LLEGADA">Pendiente Llegada</option>
                                                <option value={normalizeDeliveryType(order) === 'DELIVERY' ? 'READY_TO_SHIP' : 'READY_FOR_PICKUP'}>
                                                    Marcar Listo p/ Cobro en Caja
                                                </option>
                                            </select>
                                        )}

                                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/50 border border-white/5">
                                            <span className="text-[10px] uppercase font-bold text-zinc-400">Total</span>
                                            <span className="text-sm font-black font-mono text-amber-400">
                                                {formatCurrency(order.total)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                                        <button
                                            type="button"
                                            disabled={blockedForMe}
                                            onClick={() => onPicking(order)}
                                            className={`py-2 px-2 font-black rounded-lg text-xs flex items-center justify-center gap-1 transition-all ${
                                                blockedForMe
                                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 active:scale-95 cursor-pointer'
                                            }`}
                                            title="Recolectar artículo por artículo"
                                        >
                                            <Package size={13} /> Surtir
                                        </button>
                                        <button
                                            type="button"
                                            disabled={blockedForMe}
                                            onClick={() => onTender(order)}
                                            className={`py-2 px-2 font-black rounded-lg text-xs flex items-center justify-center gap-1 transition-all ${
                                                blockedForMe
                                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                                    : 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 active:scale-95 cursor-pointer'
                                            }`}
                                            title="Surtir, cobrar, tomar firma y emitir ticket"
                                        >
                                            <Zap size={13} /> Cobrar
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* COLUMNA 3: AZUL — Listos para Cobro, Firma y Ticket en Caja */}
            <div className="xl:col-span-3 flex flex-col bg-sky-950/20 border border-sky-500/50 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-sky-500/20">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-cyan-400" />
                        <div>
                            <h3 className="text-xs sm:text-sm font-black text-cyan-400 uppercase tracking-wider">
                                3. Cobro en Caja ({blueOrders.length})
                            </h3>
                            <span className="text-[10px] text-cyan-300/80 font-mono font-bold">
                                Por cobrar: ${totalBlueCash.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 max-h-[calc(100vh-270px)] custom-scrollbar pr-1">
                    {blueOrders.length === 0 ? (
                        <div className="py-12 text-center text-cyan-300/40 text-xs font-mono border border-dashed border-cyan-500/20 rounded-xl p-4">
                            No hay pedidos listos para cobrar en este momento
                        </div>
                    ) : (
                        blueOrders.map((order, idx) => {
                            const lock = getOrderLockInfo(order, currentUserUid, currentUserRole);
                            const blockedForMe = lock.isLockedByOther && !lock.canAdminOverride;

                            return (
                                <div
                                    key={order.id}
                                    className="bg-zinc-900/95 border border-cyan-500/50 hover:border-cyan-400 rounded-xl p-3.5 shadow-lg transition-all flex flex-col justify-between gap-3"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between border-b border-white/10 pb-2 gap-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-300 font-mono text-xs font-black flex items-center justify-center border border-cyan-500/40 shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <span className="font-mono font-black text-sm text-white truncate">
                                                    #{order.id.slice(-8)}
                                                </span>
                                            </div>
                                            <DeliveryMethodBadge order={order} />
                                        </div>

                                        <LockStatusBanner
                                            order={order}
                                            currentUserUid={currentUserUid}
                                            currentUserRole={currentUserRole}
                                            onReleaseClaim={onReleaseClaim}
                                        />

                                        <div className="space-y-1 text-xs">
                                            <p className="font-extrabold text-white text-sm flex items-center gap-1.5 truncate">
                                                <User size={14} className="text-cyan-400 shrink-0" />
                                                {order.customer?.name || 'Cliente Mostrador'}
                                            </p>
                                            <div className="text-[11px] text-zinc-400">
                                                Preparó: <strong className="text-cyan-300">{order.loadedBy || 'Almacén'}</strong>
                                            </div>
                                        </div>

                                        {order.items && order.items.length > 0 && (
                                            <div className="bg-black/40 rounded-lg p-2.5 border border-white/10 max-h-24 overflow-y-auto text-xs text-zinc-200 space-y-1 custom-scrollbar">
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Artículos ({order.items.length}):</span>
                                                {order.items.map((it: any, i: number) => (
                                                    <div key={i} className="flex justify-between text-[11px]">
                                                        <span className="truncate max-w-[170px]">{it.quantity}x {it.name || it.productName || 'Prod'}</span>
                                                        <span className="font-mono text-zinc-300 font-semibold">${Number((it.price || 0) * (it.quantity || 1)).toFixed(2)}</span>
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

                                    <button
                                        type="button"
                                        disabled={blockedForMe}
                                        onClick={() => onTender(order)}
                                        className={`w-full py-3 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                                            blockedForMe
                                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white active:scale-95 cursor-pointer'
                                        }`}
                                    >
                                        <CheckCircle2 size={16} />
                                        <span>{blockedForMe ? `En Caja de ${lock.lockedByName}` : `Cobrar, Firmar y Ticket ($${Number(order.total).toFixed(2)})`}</span>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* COLUMNA 4: CYAN — Listos Entrega Física en Mostrador / Patio */}
            <div className="xl:col-span-3 flex flex-col bg-cyan-950/20 border border-cyan-500/50 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-cyan-500/20">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-400" />
                        <div>
                            <h3 className="text-xs sm:text-sm font-black text-cyan-400 uppercase tracking-wider">
                                4. Entrega Tienda ({(readyOrders || []).length})
                            </h3>
                            <span className="text-[10px] text-cyan-300/80 font-mono font-bold">
                                Mostrador y Bahía de Patio
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 overflow-y-auto flex-1 max-h-[calc(100vh-270px)] custom-scrollbar pr-1">
                    {(readyOrders || []).length === 0 ? (
                        <div className="py-12 text-center text-cyan-300/40 text-xs font-mono border border-dashed border-cyan-500/20 rounded-xl p-4">
                            No hay pedidos pendientes de entrega en mostrador/patio
                        </div>
                    ) : (
                        (readyOrders || []).map((order, idx) => (
                            <div
                                key={order.id}
                                className="bg-zinc-900/95 border border-cyan-500/50 hover:border-cyan-400 rounded-xl p-3.5 shadow-lg transition-all flex flex-col justify-between gap-3"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between border-b border-white/10 pb-2 gap-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-300 font-mono text-xs font-black flex items-center justify-center border border-cyan-500/40 shrink-0">
                                                {idx + 1}
                                            </span>
                                            <span className="font-mono font-black text-sm text-white truncate">
                                                #{order.id.slice(-8)}
                                            </span>
                                        </div>
                                        <DeliveryMethodBadge order={order} />
                                    </div>

                                    <div className="space-y-1 text-xs">
                                        <p className="font-extrabold text-white text-sm flex items-center gap-1.5 truncate">
                                            <User size={14} className="text-cyan-400 shrink-0" />
                                            {order.customer?.name || order.customerName || 'Cliente Mostrador'}
                                        </p>
                                        <div className="flex items-center justify-between text-[11px] text-zinc-400">
                                            <span>Cobró: <strong className="text-emerald-300">{order.vendedorName || 'Caja'}</strong></span>
                                            {order.signatureData && (
                                                <span className="text-emerald-300 font-bold">✓ Firmado en Caja</span>
                                            )}
                                        </div>
                                    </div>

                                    {order.items && order.items.length > 0 && (
                                        <div className="bg-black/40 rounded-lg p-2.5 border border-white/10 max-h-24 overflow-y-auto text-xs text-zinc-200 space-y-1 custom-scrollbar">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase block">Artículos ({order.items.length}):</span>
                                            {order.items.map((it: any, i: number) => (
                                                <div key={i} className="flex justify-between text-[11px]">
                                                    <span className="truncate max-w-[170px]">{it.quantity}x {it.name || it.productName || 'Prod'}</span>
                                                    <span className="font-mono text-zinc-300 font-semibold">${Number((it.price || 0) * (it.quantity || 1)).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-cyan-500/30">
                                        <span className="text-xs uppercase font-bold text-zinc-400">Total Pagado</span>
                                        <span className="text-base font-black font-mono text-emerald-400">
                                            {formatCurrency(order.total)}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onDeliveryProof ? onDeliveryProof(order) : null}
                                    className="w-full py-3 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                                >
                                    <PenTool size={16} />
                                    <span>Validar Entrega Física (PoD)</span>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* COLUMNA 5: CONTROL DE CAJA Y RESUMEN */}
            <div className="xl:col-span-2 flex flex-col justify-between bg-gradient-to-b from-amber-950/20 via-slate-900/60 to-slate-950/80 border border-amber-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-4">
                <div className="space-y-4">
                    <div className="border-b border-amber-500/20 pb-3">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block">
                            CONTROL RÁPIDO
                        </span>
                        <h3 className="text-sm font-black text-white uppercase mt-0.5">
                            Tickets y Corte
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={onOpenHistory}
                        className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 shadow-lg transition-all active:scale-95 cursor-pointer"
                    >
                        <Receipt size={22} />
                        <span>Historial de Tickets</span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenCorte}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                        <Scale size={15} />
                        <span>Corte de Caja Ciego</span>
                    </button>

                    <div className="bg-black/50 rounded-xl p-3 border border-white/5 space-y-2 text-xs">
                        <span className="text-[10px] font-bold uppercase text-zinc-500 block">Flujo de Pedidos:</span>

                        <div className="flex items-center justify-between text-emerald-400">
                            <span>1. Pizarra libre:</span>
                            <span className="font-mono font-bold">{greenOrders.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-400">
                            <span>2. En surtido:</span>
                            <span className="font-mono font-bold">{yellowOrders.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-cyan-400 font-bold">
                            <span>3. Cobro en Caja:</span>
                            <span className="font-mono">{blueOrders.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-cyan-300 font-bold">
                            <span>4. Entrega Tienda:</span>
                            <span className="font-mono font-bold">{(readyOrders || []).length}</span>
                        </div>

                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-white font-mono font-bold">
                            <span>Por Cobrar:</span>
                            <span className="text-cyan-400">${totalBlueCash.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-[10px] text-cyan-300/80 leading-relaxed">
                    <strong>Flujo Unificado:</strong> Un rol toma y prepara en Pizarra bloqueando el pedido; Caja cobra, toma firma y emite ticket. Los pedidos a domicilio pasan directo a Repartidor.
                </div>
            </div>
        </div>
    );
}
