"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
    History, Search, FileText, Printer, X, Eye, Calendar, User, DollarSign, 
    CheckCircle2, MessageSquare, Plus, Check, Ban, AlertOctagon, Filter, 
    Receipt, RefreshCw, ArrowLeft, ArrowUpRight, TrendingUp
} from 'lucide-react';
import { getDigitalTickets, addNoteToDigitalTicket, cancelDigitalTicket, clearDigitalTickets, type DigitalTicket } from '@/lib/digitalTicket';

interface TicketHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    cajaId?: string;
    onSelectTicket: (ticket: DigitalTicket) => void;
}

export function TicketHistoryModal({ isOpen, onClose, cajaId = 'caja_1', onSelectTicket }: TicketHistoryModalProps) {
    const [tickets, setTickets] = useState<DigitalTicket[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'cancelled' | 'facturado'>('all');
    const [activeNoteTicketId, setActiveNoteTicketId] = useState<string | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [cancellingTicketId, setCancellingTicketId] = useState<string | null>(null);
    const [cancelReasonInput, setCancelReasonInput] = useState('');
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const reloadTickets = async () => {
        const localList = getDigitalTickets(cajaId);
        setTickets(localList);

        try {
            const res = await fetch('/api/orders');
            const json = await res.json();
            if (json.success && Array.isArray(json.data)) {
                const serverTickets: DigitalTicket[] = json.data.map((order: any, idx: number) => {
                    const timeIso = order.date ? new Date(order.date).toISOString() : new Date().toISOString();
                    const now = new Date(timeIso);
                    const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const dateStr = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    return {
                        id: order.id.startsWith('TCK') ? order.id : `TCK-${order.id}`,
                        orderId: order.id,
                        cajaId: cajaId || 'caja_1',
                        cajaName: `Caja ${(cajaId || 'caja_1').replace('caja_', '').toUpperCase()}`,
                        cashierName: order.vendedorName || 'Cajero de Turno',
                        vendedorId: order.vendedorId || 'LOCAL',
                        vendedorName: order.vendedorName || 'Vendedor Piso',
                        customerName: order.customer?.name || order.customerName || 'Cliente Mostrador',
                        customerPhone: order.customer?.phone || '',
                        customerAddress: order.customer?.address || order.deliveryAddress || '',
                        timestamp: `${timeStr} - ${dateStr}`,
                        dateIso: timeIso,
                        items: (order.items || []).map((it: any) => ({
                            id: it.productId || it.id,
                            name: it.name || it.product?.name || 'Producto',
                            quantity: Number(it.quantity ?? it.cantidad ?? 1),
                            unitType: it.unitType || 'PZA',
                            price: Number(it.price ?? it.precio ?? 0),
                            subtotal: Number((it.quantity ?? it.cantidad ?? 1) * (it.price ?? it.precio ?? 0))
                        })),
                        total: Number(order.total || 0),
                        amountReceived: Number(order.amountReceived || order.total || 0),
                        change: Number(order.change || 0),
                        paymentMethod: order.paymentMethod || 'EFECTIVO EN CAJA',
                        consecutiveNumber: idx + 1,
                        status: order.status === 'cancelled' || order.status === 'refunded' ? 'CANCELADO' : 'COMPLETADO',
                        deliveryType: order.deliveryType || 'CAJA'
                    };
                });

                const mergedMap = new Map<string, DigitalTicket>();
                for (const st of serverTickets) {
                    mergedMap.set(st.orderId, st);
                }
                for (const lt of localList) {
                    const existing = mergedMap.get(lt.orderId);
                    if (existing) {
                        mergedMap.set(lt.orderId, {
                            ...existing,
                            notes: lt.notes || existing.notes,
                            evidencePhoto: lt.evidencePhoto || existing.evidencePhoto,
                            signatureData: lt.signatureData || existing.signatureData
                        });
                    } else {
                        mergedMap.set(lt.orderId || lt.id, lt);
                    }
                }
                const combined = Array.from(mergedMap.values()).sort(
                    (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime()
                );
                setTickets(combined);
            }
        } catch (e) {
            console.warn('[TicketHistoryModal] Server orders sync error, using local tickets:', e);
        }
    };

    useEffect(() => {
        if (isOpen) {
            reloadTickets();
            setActiveNoteTicketId(null);
            setNoteInput('');
            setCancellingTicketId(null);
            setCancelReasonInput('');
        }
    }, [isOpen, cajaId]);

    // Cerrar con tecla Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                if (cancellingTicketId) {
                    setCancellingTicketId(null);
                } else if (activeNoteTicketId) {
                    setActiveNoteTicketId(null);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, cancellingTicketId, activeNoteTicketId, onClose]);

    const handleSaveNote = (ticketId: string) => {
        if (!noteInput.trim()) return;
        addNoteToDigitalTicket(cajaId, ticketId, noteInput.trim());
        reloadTickets();
        setActiveNoteTicketId(null);
        setNoteInput('');
    };

    const handleCancelTicket = (ticketId: string) => {
        if (!cancelReasonInput.trim()) return;
        cancelDigitalTicket(cajaId, ticketId, cancelReasonInput.trim());
        reloadTickets();
        setCancellingTicketId(null);
        setCancelReasonInput('');
    };

    const filtered = useMemo(() => {
        return tickets.filter(t => {
            // Filtro por Estatus
            if (statusFilter === 'valid' && t.status === 'CANCELADO') return false;
            if (statusFilter === 'cancelled' && t.status !== 'CANCELADO') return false;
            if (statusFilter === 'facturado' && t.facturaStatus !== 'facturado') return false;

            // Filtro por Búsqueda
            if (!searchTerm.trim()) return true;
            const query = searchTerm.toLowerCase();
            return (
                t.id.toLowerCase().includes(query) ||
                t.orderId.toLowerCase().includes(query) ||
                t.customerName.toLowerCase().includes(query) ||
                (t.vendedorName && t.vendedorName.toLowerCase().includes(query)) ||
                (t.cashierName && t.cashierName.toLowerCase().includes(query)) ||
                (t.paymentMethod && t.paymentMethod.toLowerCase().includes(query)) ||
                t.items.some(it => it.name.toLowerCase().includes(query))
            );
        });
    }, [tickets, searchTerm, statusFilter]);

    if (!isOpen) return null;

    const totalSold = tickets.filter(t => t.status !== 'CANCELADO').reduce((acc, t) => acc + (t.total || 0), 0);
    const validCount = tickets.filter(t => t.status !== 'CANCELADO').length;
    const cancelledCount = tickets.filter(t => t.status === 'CANCELADO').length;
    const facturadosCount = tickets.filter(t => t.facturaStatus === 'facturado').length;

    return (
        <div className="fixed inset-0 z-[190] bg-[#060a16] flex flex-col w-screen h-screen text-white overflow-hidden animate-in fade-in duration-150 select-none">
            {/* ── ENCABEZADO SUPERIOR A PANTALLA COMPLETA ── */}
            <header className="p-3.5 sm:px-6 bg-slate-950/90 backdrop-blur-xl border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-lg relative z-20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 sm:p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-cyan-500/20 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-2 text-xs font-mono active:scale-95"
                        title="Volver a la Caja (Esc)"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Caja (Esc)</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                            <Receipt className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                                    Bitácora de Tickets e Historial de Caja
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                    PANTALLA COMPLETA
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Registro inmutable de transacciones cobradas y tickets emitidos en este turno
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── MÉTRICAS Y TOTALES DEL TURNO ── */}
                <div className="flex items-center gap-2.5 sm:gap-4 overflow-x-auto py-1">
                    <div className="bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Total Cobrado</span>
                            <span className="text-sm sm:text-base font-black font-mono text-emerald-400">${totalSold.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                        <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Válidos</span>
                            <span className="text-sm sm:text-base font-black font-mono text-cyan-300">{validCount}</span>
                        </div>
                    </div>

                    {cancelledCount > 0 && (
                        <div className="bg-rose-950/40 border border-rose-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2">
                            <Ban className="w-4 h-4 text-rose-400" />
                            <div>
                                <span className="text-[10px] uppercase font-bold text-rose-300 block leading-tight">Cancelados</span>
                                <span className="text-sm sm:text-base font-black font-mono text-rose-400">{cancelledCount}</span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setShowClearConfirm(true)}
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-rose-950/40 text-rose-300 hover:text-white hover:bg-rose-900 border border-rose-500/40 transition-colors flex items-center gap-1.5 text-xs font-bold active:scale-95"
                        title="Limpiar bitácora de tickets o reiniciar turno"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">Reiniciar Turno</span>
                    </button>

                    <button
                        onClick={onClose}
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors flex items-center gap-1.5 text-xs font-bold"
                        title="Cerrar ventana"
                    >
                        <X className="w-5 h-5" />
                        <span className="hidden sm:inline">Cerrar</span>
                    </button>
                </div>
            </header>

            {/* ── BARRA DE BÚSQUEDA Y FILTROS RÁPIDOS ── */}
            <div className="p-3 sm:px-6 bg-slate-950/60 border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="relative flex-1 min-w-[260px] max-w-xl">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por folio (TCK-...), pedido (ORD-...), cliente, vendedor o artículo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        autoFocus
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Filtros de Estado */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            statusFilter === 'all'
                                ? 'bg-cyan-500 text-slate-950 shadow-sm font-black'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                    >
                        Todos ({tickets.length})
                    </button>
                    <button
                        onClick={() => setStatusFilter('valid')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            statusFilter === 'valid'
                                ? 'bg-emerald-500 text-slate-950 shadow-sm font-black'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                    >
                        Válidos ({validCount})
                    </button>
                    {cancelledCount > 0 && (
                        <button
                            onClick={() => setStatusFilter('cancelled')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                statusFilter === 'cancelled'
                                    ? 'bg-rose-500 text-white shadow-sm font-black'
                                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                        >
                            Cancelados ({cancelledCount})
                        </button>
                    )}
                    {facturadosCount > 0 && (
                        <button
                            onClick={() => setStatusFilter('facturado')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                statusFilter === 'facturado'
                                    ? 'bg-blue-500 text-white shadow-sm font-black'
                                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                        >
                            Facturados SAT ({facturadosCount})
                        </button>
                    )}
                    <button
                        onClick={reloadTickets}
                        className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition"
                        title="Recargar tickets"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── CUADRÍCULA A PANTALLA COMPLETA DE TICKETS (FULLSCREEN GRID) ── */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                {filtered.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-24 text-center">
                        <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 text-slate-500 mb-3">
                            <Receipt className="w-12 h-12" />
                        </div>
                        <h3 className="text-lg font-bold text-white">No se encontraron tickets registrados</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm">
                            {searchTerm 
                                ? `No hay resultados para "${searchTerm}". Intenta con otro folio o nombre.`
                                : 'Aún no se han cobrado pedidos en este turno. Una vez cobrados en la columna azul, aparecerán aquí automáticamente.'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 sm:gap-4">
                        {filtered.map((t) => {
                            const isCancelled = t.status === 'CANCELADO';

                            return (
                                <div
                                    key={t.id}
                                    className={`rounded-2xl p-4 border transition-all flex flex-col justify-between shadow-lg relative group ${
                                        isCancelled
                                            ? 'bg-rose-950/15 border-rose-500/20 hover:border-rose-500/40'
                                            : 'bg-slate-900/80 border-slate-800/80 hover:border-cyan-500/40 hover:shadow-cyan-500/10'
                                    }`}
                                >
                                    {/* Cabecera del Ticket */}
                                    <div>
                                        <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2.5 mb-2.5">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-black text-sm text-cyan-400">
                                                        {t.id}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                                        {t.orderId}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                                    {t.timestamp}
                                                </span>
                                            </div>

                                            <div>
                                                {isCancelled ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/40 flex items-center gap-1">
                                                        <Ban className="w-3 h-3" /> CANCELADO
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> VÁLIDO
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Cliente y Vendedor */}
                                        <div className="space-y-1 text-xs mb-3">
                                            <p className="font-bold text-white flex items-center gap-1.5 truncate">
                                                <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                <span className="truncate">{t.customerName || 'Cliente Mostrador'}</span>
                                            </p>
                                            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                                                <span className="text-slate-500">Atendió:</span>
                                                <span className="text-slate-300 truncate">{t.vendedorName || t.cashierName || 'Caja'}</span>
                                            </p>
                                            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                                <span className="text-slate-500">Pago:</span>
                                                <span className="text-cyan-300 font-mono font-semibold">{t.paymentMethod || 'EFECTIVO'}</span>
                                            </p>
                                        </div>

                                        {/* Desglose de Artículos (Pills o Lista Compacta) */}
                                        <div className="bg-black/40 rounded-xl p-2.5 border border-white/5 space-y-1 mb-3 max-h-28 overflow-y-auto custom-scrollbar text-[11px]">
                                            <span className="text-[10px] uppercase font-bold text-slate-500 block">
                                                Artículos ({t.items.length}):
                                            </span>
                                            {t.items.map((it, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-slate-300">
                                                    <span className="truncate max-w-[150px]">{it.quantity}x {it.name}</span>
                                                    <span className="font-mono text-slate-400">${it.subtotal.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Total e Importes */}
                                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between mb-3">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Cobrado</span>
                                                <span className={`text-base font-black font-mono ${isCancelled ? 'line-through text-slate-500' : 'text-emerald-400'}`}>
                                                    ${t.total.toFixed(2)}
                                                </span>
                                            </div>
                                            <div className="text-right text-[11px] font-mono text-slate-400">
                                                <span>Recibido: ${t.amountReceived.toFixed(2)}</span>
                                                <span className="block text-slate-500">Cambio: ${t.change.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Factura SAT si aplica */}
                                        {t.facturaStatus === 'facturado' && (
                                            <div className="mb-3 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[10px] font-mono text-blue-300 flex items-center gap-1">
                                                <FileText className="w-3 h-3" />
                                                <span>SAT CFDI: {t.facturaRfc}</span>
                                            </div>
                                        )}

                                        {/* Motivo de Cancelación si está cancelado */}
                                        {isCancelled && t.cancellationReason && (
                                            <div className="mb-3 p-2 rounded-xl bg-rose-950/40 border border-rose-500/30 text-[11px] text-rose-300 space-y-0.5">
                                                <span className="font-bold block text-rose-400 flex items-center gap-1">
                                                    <AlertOctagon className="w-3 h-3" /> Motivo de cancelación:
                                                </span>
                                                <p className="italic text-rose-200">{t.cancellationReason}</p>
                                            </div>
                                        )}

                                        {/* Notas del ticket */}
                                        {t.notes && t.notes.length > 0 && (
                                            <div className="mb-3 space-y-1">
                                                {t.notes.map((note, idx) => (
                                                    <div key={idx} className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg flex items-center gap-1.5">
                                                        <MessageSquare className="w-3 h-3 text-amber-400 shrink-0" />
                                                        <span className="truncate">{note}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Input para agregar nota */}
                                        {activeNoteTicketId === t.id && (
                                            <div className="mb-3 pt-2 border-t border-amber-500/20 flex items-center gap-1.5">
                                                <input
                                                    type="text"
                                                    placeholder="Escribir nota..."
                                                    value={noteInput}
                                                    onChange={(e) => setNoteInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveNote(t.id);
                                                    }}
                                                    className="flex-1 bg-black/60 border border-amber-500/40 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-400"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSaveNote(t.id)}
                                                    className="p-1.5 bg-amber-500 text-black rounded-lg font-bold hover:bg-amber-400"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => setActiveNoteTicketId(null)}
                                                    className="p-1.5 text-slate-400 hover:text-white"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Input para cancelar con motivo */}
                                        {cancellingTicketId === t.id && (
                                            <div className="mb-3 p-2 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-1.5">
                                                <span className="text-[10px] font-bold text-rose-300 block">
                                                    Motivo obligatorio de anulación:
                                                </span>
                                                <input
                                                    type="text"
                                                    placeholder="Ej. Devolución de cliente o error de cobro..."
                                                    value={cancelReasonInput}
                                                    onChange={(e) => setCancelReasonInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCancelTicket(t.id);
                                                    }}
                                                    className="w-full bg-black/70 border border-rose-500/40 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-rose-400"
                                                    autoFocus
                                                />
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => setCancellingTicketId(null)}
                                                        className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelTicket(t.id)}
                                                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs"
                                                    >
                                                        Confirmar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── BOTONES DE ACCIÓN DEL TICKET ── */}
                                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => setActiveNoteTicketId(activeNoteTicketId === t.id ? null : t.id)}
                                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-bold transition flex items-center gap-1"
                                                title="Agregar nota"
                                            >
                                                <MessageSquare className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline text-[11px]">Nota</span>
                                            </button>

                                            {!isCancelled && (
                                                <button
                                                    onClick={() => setCancellingTicketId(cancellingTicketId === t.id ? null : t.id)}
                                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-bold transition flex items-center gap-1"
                                                    title="Cancelar ticket"
                                                >
                                                    <Ban className="w-3.5 h-3.5" />
                                                    <span className="hidden sm:inline text-[11px]">Anular</span>
                                                </button>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => {
                                                onSelectTicket(t);
                                                onClose();
                                            }}
                                            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/40 text-xs font-black transition flex items-center gap-1.5 active:scale-95 shadow-sm"
                                            title="Ver y reimprimir comprobante"
                                        >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Ver / Reimprimir</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── FOOTER INFERIOR ── */}
            <footer className="p-3 sm:px-6 bg-slate-950/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Bitácora de Caja Resguardada Localmente • {tickets.length} tickets en histórico</span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition shadow-md active:scale-95"
                    >
                        Volver a la Caja (Esc)
                    </button>
                </div>
            </footer>

            {/* ── MODAL CONFIRMACIÓN REINICIAR TURNO / LIMPIAR TICKETS ── */}
            {showClearConfirm && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 text-rose-400">
                            <AlertOctagon className="w-8 h-8 shrink-0" />
                            <div>
                                <h3 className="text-base font-black uppercase text-white">¿Reiniciar Bitácora de Turno?</h3>
                                <p className="text-xs text-slate-400">Esto limpiará el historial de tickets de esta caja para comenzar un turno nuevo desde $0.00.</p>
                            </div>
                        </div>
                        <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/20 text-xs text-rose-300">
                            ⚠️ Se borrarán los {tickets.length} tickets registrados en la memoria local de esta caja.
                        </div>
                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    clearDigitalTickets(cajaId);
                                    reloadTickets();
                                    setShowClearConfirm(false);
                                }}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider shadow-lg active:scale-95"
                            >
                                Sí, Limpiar y Reiniciar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
