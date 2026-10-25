"use client";

import React, { useState, useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { 
    Swords, Package, Clock, CheckCircle2, AlertTriangle, 
    Truck, Store, ShieldAlert, ArrowRight, User, RefreshCw,
    Search, Layers, Sparkles, DollarSign
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { playSupermarketBeep, playErrorBeep } from '@/lib/scannerAudio';

interface FosaComunDePedidosProps {
    rolUsuario: string;
    usuarioActivo: any;
    onSelectPicking?: (order: any) => void;
    onSelectCobro?: (order: any) => void;
}

export function FosaComunDePedidos({
    rolUsuario,
    usuarioActivo,
    onSelectPicking,
    onSelectCobro
}: FosaComunDePedidosProps) {
    const { orders, startLoading, claimCashierOrder, formatCurrency } = useCart();
    const { profile } = useAuth();
    const [filter, setFilter] = useState<'all' | 'unclaimed' | 'my_orders' | 'ready_to_charge'>('all');
    const [search, setSearch] = useState('');
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

    const currentUid = profile?.uid || usuarioActivo?.id || 'OPERADOR';
    const currentName = profile?.displayName || usuarioActivo?.nombre || 'Operador';

    // Clasificación de pedidos activos en la fosa común
    const fosaOrders = useMemo(() => {
        return orders.filter((o: any) => {
            const isTerminal = ['DELIVERED', 'COMPLETED', 'cancelled', 'refunded'].includes(o.status);
            if (isTerminal) return false;
            
            // Búsqueda por folio o cliente
            if (search.trim()) {
                const q = search.toLowerCase();
                const idMatch = o.id.toLowerCase().includes(q);
                const clientMatch = (o.customer?.name || o.customerName || '').toLowerCase().includes(q);
                if (!idMatch && !clientMatch) return false;
            }

            if (filter === 'unclaimed') {
                return !o.loadedByUid && !o.isLoaded && ['pending', 'pending_payment', 'pending_confirmation', 'paid', 'NIGHT_QUEUE'].includes(o.status);
            }
            if (filter === 'my_orders') {
                return o.loadedByUid === currentUid || o.vendedorId === currentUid;
            }
            if (filter === 'ready_to_charge') {
                return !o.confirmedAt && (o.isLoaded || ['READY_FOR_PICKUP', 'READY_TO_SHIP', 'pending_payment'].includes(o.status));
            }
            return true;
        });
    }, [orders, filter, search, currentUid]);

    // Métricas en vivo de la fosa
    const stats = useMemo(() => {
        const unclaimed = orders.filter((o: any) => !['DELIVERED', 'COMPLETED', 'cancelled'].includes(o.status) && !o.loadedByUid && !o.isLoaded).length;
        const myActive = orders.filter((o: any) => (o.loadedByUid === currentUid || o.vendedorId === currentUid) && !['DELIVERED', 'COMPLETED', 'cancelled'].includes(o.status)).length;
        const readyCharge = orders.filter((o: any) => !o.confirmedAt && !['DELIVERED', 'COMPLETED', 'cancelled'].includes(o.status) && (o.isLoaded || ['READY_FOR_PICKUP', 'READY_TO_SHIP'].includes(o.status))).length;
        return { unclaimed, myActive, readyCharge };
    }, [orders, currentUid]);

    // Acción Atómica: Pelear / Reclamar pedido en SQLite WAL
    const handlePelearPedido = async (order: any) => {
        setActionLoadingId(order.id);
        try {
            await startLoading(order.id);
            playSupermarketBeep();
            toast.success(`⚔️ ¡Pedido #${order.id.slice(-6).toUpperCase()} ganado! Iniciando recolección por incisos.`);
            if (onSelectPicking) {
                onSelectPicking(order);
            }
        } catch (err: any) {
            playErrorBeep();
            toast.error(err?.message || '¡El pedido ya fue ganado por otro operador en la LAN!', 'Conflicto de Bloqueo');
        } finally {
            setActionLoadingId(null);
        }
    };

    const getDeliveryBadge = (type: string) => {
        switch (type) {
            case 'PATIO':
                return { label: 'Patio Carga', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
            case 'DELIVERY':
                return { label: 'Repartidor', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
            case 'PICKUP':
                return { label: 'Mostrador', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
            default:
                return { label: 'Tienda / Caja', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' };
        }
    };

    return (
        <section className="bg-[#0f172a]/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-md mb-6">
            {/* Header de la Fosa */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 shadow-inner">
                        <Swords size={24} className="animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white tracking-wide">FOSA COMÚN DE PEDIDOS (LAN)</h2>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
                                16+ Operadores
                            </span>
                        </div>
                        <p className="text-xs text-slate-400">
                            Bloqueo atómico SQLite WAL concurrente. El primer operador en presionar gana la orden.
                        </p>
                    </div>
                </div>

                {/* Métricas rápidas */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setFilter('unclaimed')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            filter === 'unclaimed' 
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                    >
                        ⚡ Libres para Pelear ({stats.unclaimed})
                    </button>
                    <button 
                        onClick={() => setFilter('my_orders')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            filter === 'my_orders' 
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                    >
                        🎯 Mis Ganados ({stats.myActive})
                    </button>
                    {['sales', 'billing', 'caja'].includes(rolUsuario) && (
                        <button 
                            onClick={() => setFilter('ready_to_charge')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                filter === 'ready_to_charge' 
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                        >
                            💵 Listos para Cobrar ({stats.readyCharge})
                        </button>
                    )}
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 my-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                    <input 
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por folio o cliente..."
                        className="w-full bg-slate-900/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                </div>

                <div className="flex items-center gap-1.5 self-end text-xs text-slate-400">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>Sincronización LAN activa (0ms)</span>
                </div>
            </div>

            {/* Cuadrícula de Órdenes en Fosa */}
            {fosaOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-800/80 rounded-xl bg-slate-900/30">
                    <Layers className="text-slate-600 mb-2" size={32} />
                    <p className="text-sm font-semibold text-slate-300">No hay pedidos pendientes en la fosa común</p>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                        Los nuevos pedidos levantados por clientes o caja aparecerán aquí al instante para ser preparados.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {fosaOrders.map((order: any) => {
                        const badge = getDeliveryBadge(order.deliveryType);
                        const isMine = order.loadedByUid === currentUid;
                        const isClaimedByOther = order.loadedByUid && order.loadedByUid !== currentUid;
                        const isPaid = Boolean(order.confirmedAt) || order.status === 'paid' || order.status === 'READY_FOR_PICKUP_PAID';
                        const itemCount = order.items?.length || 0;
                        const isActionBusy = actionLoadingId === order.id;

                        return (
                            <div 
                                key={order.id}
                                className={`rounded-xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                                    isMine 
                                        ? 'bg-gradient-to-br from-cyan-950/40 via-slate-900/90 to-slate-900 border-cyan-500/50 shadow-lg shadow-cyan-950/20 ring-1 ring-cyan-500/30' 
                                        : isClaimedByOther
                                            ? 'bg-slate-900/40 border-slate-800/70 opacity-80'
                                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:shadow-md'
                                }`}
                            >
                                <div>
                                    {/* Cabecera de la Tarjeta */}
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-bold text-white tracking-wider">
                                                    #{order.id.slice(-6).toUpperCase()}
                                                </span>
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 font-medium truncate max-w-[180px] mt-0.5">
                                                {order.customer?.name || order.customerName || 'Cliente Mostrador'}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-sm font-bold text-cyan-400">
                                                {formatCurrency(order.total)}
                                            </span>
                                            <div className="flex items-center gap-1 justify-end text-[10px] text-slate-400 mt-0.5">
                                                <Package size={11} />
                                                <span>{itemCount} incisos</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Estado Operativo */}
                                    <div className="my-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-400">Estado:</span>
                                            <span className={`font-semibold ${
                                                order.isLoaded ? 'text-emerald-400' : isMine ? 'text-cyan-400' : 'text-amber-400'
                                            }`}>
                                                {order.isLoaded 
                                                    ? '✅ Recolección completa' 
                                                    : order.loadedByUid 
                                                        ? `⏳ Preparando: ${order.loadedBy || 'Operador'}` 
                                                        : '⚡ Listo para pelear'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-1 text-[11px]">
                                            <span className="text-slate-500">Cobro:</span>
                                            <span className={isPaid ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                                                {isPaid ? 'Cobrado en Caja Física' : 'Pendiente de Cobro'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Botonera de Acción Reactiva */}
                                <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2">
                                    {!order.loadedByUid && !order.isLoaded ? (
                                        <button
                                            onClick={() => handlePelearPedido(order)}
                                            disabled={isActionBusy}
                                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            <Swords size={14} />
                                            <span>{isActionBusy ? 'Bloqueando en WAL...' : '⚔️ Pelear Pedido'}</span>
                                        </button>
                                    ) : isMine ? (
                                        <button
                                            onClick={() => onSelectPicking && onSelectPicking(order)}
                                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-950/30 transition-all active:scale-95"
                                        >
                                            <Package size={14} />
                                            <span>{order.isLoaded ? 'Ver Incisos Validados' : '📦 Validar Incisos (Nota)'}</span>
                                        </button>
                                    ) : isClaimedByOther ? (
                                        <div className="w-full py-1.5 px-3 rounded-lg bg-slate-800/40 text-center text-[11px] text-slate-400 font-mono">
                                            Tomado por {order.loadedBy || 'otro operador'}
                                        </div>
                                    ) : null}

                                    {/* Botón de Cobro Rápido si es Cajero y la orden está lista */}
                                    {['sales', 'billing', 'caja'].includes(rolUsuario) && !isPaid && (
                                        <button
                                            onClick={() => onSelectCobro && onSelectCobro(order)}
                                            className="px-3 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 transition-colors active:scale-95"
                                            title="Cobrar en Caja Física"
                                        >
                                            <DollarSign size={14} />
                                            <span>Cobrar</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export default FosaComunDePedidos;
