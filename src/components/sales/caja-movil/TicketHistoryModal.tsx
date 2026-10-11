"use client";

import React, { useState, useEffect } from 'react';
import { History, Search, FileText, Printer, X, Eye, Calendar, User, DollarSign, CheckCircle2 } from 'lucide-react';
import { getDigitalTickets, type DigitalTicket } from '@/lib/digitalTicket';

interface TicketHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    cajaId?: string;
    onSelectTicket: (ticket: DigitalTicket) => void;
}

export function TicketHistoryModal({ isOpen, onClose, cajaId = 'caja_1', onSelectTicket }: TicketHistoryModalProps) {
    const [tickets, setTickets] = useState<DigitalTicket[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            const list = getDigitalTickets(cajaId);
            setTickets(list);
        }
    }, [isOpen, cajaId]);

    if (!isOpen) return null;

    const filtered = tickets.filter(t => {
        const query = searchTerm.toLowerCase();
        return (
            t.id.toLowerCase().includes(query) ||
            t.orderId.toLowerCase().includes(query) ||
            t.customerName.toLowerCase().includes(query) ||
            (t.vendedorName && t.vendedorName.toLowerCase().includes(query)) ||
            (t.cashierName && t.cashierName.toLowerCase().includes(query))
        );
    });

    const totalSold = tickets.reduce((acc, t) => acc + (t.total || 0), 0);

    return (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col text-white overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/80">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-base">Bitácora de Tickets e Historial de Caja</h3>
                            <p className="text-xs text-zinc-400">
                                {tickets.length} tickets emitidos en este turno • Total: ${totalSold.toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Buscador */}
                <div className="p-3 bg-zinc-900/40 border-b border-white/5">
                    <div className="relative">
                        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar por folio, cliente, vendedor o ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                    </div>
                </div>

                {/* Lista de tickets */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filtered.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 text-xs">
                            No se encontraron tickets registrados en esta caja.
                        </div>
                    ) : (
                        filtered.map((t) => (
                            <div
                                key={t.id}
                                className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/30 transition-all flex items-center justify-between gap-3"
                            >
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-black text-cyan-400 text-xs">{t.id}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                                            {t.orderId}
                                        </span>
                                        {t.facturaStatus === 'facturado' && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                                                SAT: {t.facturaRfc}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-zinc-300 font-medium truncate">
                                        {t.customerName} • <span className="text-zinc-400">Vendedor: {t.vendedorName || t.cashierName}</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-500">
                                        {t.timestamp} • {t.items.length} artículos • Pago: {t.paymentMethod}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                        <div className="font-black text-white text-sm font-mono">
                                            ${t.total.toFixed(2)}
                                        </div>
                                        <div className="text-[10px] text-zinc-400">
                                            Cambio: ${t.change.toFixed(2)}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            onSelectTicket(t);
                                            onClose();
                                        }}
                                        className="p-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                                        title="Ver y reimprimir comprobante"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Ver</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-white/10 bg-zinc-900/80 flex justify-between items-center text-xs text-zinc-400">
                    <span>Resguardo local en dispositivo (Bitácora inmutable)</span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
