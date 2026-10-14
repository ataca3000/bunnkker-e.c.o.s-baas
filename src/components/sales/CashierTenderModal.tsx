"use client";

import React, { useState } from 'react';
import { X, DollarSign, CheckCircle2, Calculator, QrCode, Truck, Package, Clock, ShieldCheck, Printer } from 'lucide-react';
import { motion } from 'framer-motion';

interface CashierTenderModalProps {
    order: any;
    onClose: () => void;
    cashierName: string;
    onConfirm: (amountReceived: number, change: number) => Promise<void>;
    isProcessing?: boolean;
}

export default function CashierTenderModal({
    order,
    onClose,
    cashierName,
    onConfirm,
    isProcessing = false
}: CashierTenderModalProps) {
    const total = Number(order?.total) || 0;
    const [receivedInput, setReceivedInput] = useState<string>('');
    const receivedAmount = parseFloat(receivedInput) || 0;
    const change = Math.max(0, receivedAmount - total);
    const isValid = receivedAmount >= total;

    const quickAmounts = [
        total,
        Math.ceil(total / 50) * 50,
        Math.ceil(total / 100) * 100,
        Math.ceil(total / 200) * 200,
        Math.ceil(total / 500) * 500,
        Math.ceil(total / 1000) * 1000,
    ].filter((v, i, a) => a.indexOf(v) === i && v >= total);

    const isPatio = order?.deliveryType === 'PATIO' || order?.deliveryMethod === 'patio';

    const handleConfirm = async () => {
        if (!isValid || isProcessing) return;
        const finalReceived = receivedAmount > 0 ? receivedAmount : total;
        const finalChange = Math.max(0, finalReceived - total);
        await onConfirm(finalReceived, finalChange);
    };

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-white my-6"
            >
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/90">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-white text-base">Cobro en Caja & Ticket Digital</h3>
                            <p className="text-xs text-zinc-400">
                                Folio: <span className="font-mono text-emerald-400 font-bold">{order?.id}</span> • Cajero: {cashierName}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Resumen del Cliente y Destino */}
                    <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-400">Cliente:</span>
                            <span className="font-bold text-white uppercase">{order?.customer?.name || order?.customerName || 'Cliente Mostrador'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-400">Destino de Entrega:</span>
                            {isPatio ? (
                                <span className="text-[11px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Truck size={12} /> BAHÍA DE CARGA / PATIO (PoD)
                                </span>
                            ) : (
                                <span className="text-[11px] font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Package size={12} /> MOSTRADOR / CAJA DIRECTA
                                </span>
                            )}
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-zinc-400">Surtido por Almacén:</span>
                            <span className="font-bold text-sky-400 flex items-center gap-1">
                                <ShieldCheck size={12} /> {order?.loadedBy || 'Listo en bodega'}
                            </span>
                        </div>
                    </div>

                    {/* Desglose de Artículos */}
                    <div className="bg-black/40 border border-white/5 rounded-xl p-3 max-h-32 overflow-y-auto space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                            Artículos a liquidar ({order?.items?.length || 0}):
                        </span>
                        {(order?.items || []).map((it: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-zinc-300 text-[11px]">
                                <span className="truncate max-w-[240px]">{it.quantity || it.cantidad}x {it.name || 'Producto'}</span>
                                <span className="font-mono text-zinc-400">${Number((it.price || 0) * (it.quantity || 1)).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Total a Cobrar */}
                    <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 border border-emerald-500/30 rounded-2xl p-4 text-center">
                        <span className="text-xs font-black uppercase tracking-widest text-zinc-400 block mb-1">
                            Total a Cobrar
                        </span>
                        <div className="text-4xl font-black text-white font-mono tracking-tight text-emerald-400">
                            ${total.toFixed(2)} <span className="text-sm font-normal text-zinc-400">MXN</span>
                        </div>
                    </div>

                    {/* ¿Cuánto Recibes? Input */}
                    <div className="space-y-2">
                        <label className="flex items-center justify-between text-xs font-bold text-zinc-300">
                            <span className="flex items-center gap-1.5">
                                <Calculator size={14} className="text-emerald-400" />
                                ¿Cuánto Recibes en Efectivo?
                            </span>
                            <span className="text-[10px] text-zinc-500">Ingresa monto o usa botones rápidos</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-400 font-mono">$</span>
                            <input
                                type="number"
                                autoFocus
                                step="any"
                                min={total}
                                value={receivedInput}
                                onChange={(e) => setReceivedInput(e.target.value)}
                                placeholder={total.toFixed(2)}
                                className="w-full bg-black/60 border-2 border-white/15 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-white font-mono font-black text-3xl py-3 pl-10 pr-4 rounded-xl outline-none transition-all placeholder:text-zinc-600"
                            />
                        </div>

                        {/* Chips rápidos de billetes */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {quickAmounts.map((amt) => (
                                <button
                                    key={amt}
                                    type="button"
                                    onClick={() => setReceivedInput(amt.toString())}
                                    className="px-3 py-1.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 rounded-lg text-xs font-bold text-zinc-200 hover:text-emerald-300 transition-colors"
                                >
                                    ${amt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ¿Cuánto debe dar de Cambio? Display */}
                    <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                        isValid && receivedAmount > 0
                            ? 'bg-emerald-500/15 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                            : 'bg-zinc-900/50 border-white/10 text-zinc-500'
                    }`}>
                        <div>
                            <span className="text-xs font-black uppercase tracking-wider block text-zinc-300">
                                Cambio a Entregar al Cliente:
                            </span>
                            <span className="text-[10px] text-zinc-400">
                                {receivedAmount >= total ? 'Entrega el efectivo indicado' : 'Monto insuficiente'}
                            </span>
                        </div>
                        <div className="text-2xl font-black font-mono">
                            {receivedAmount >= total ? (
                                <span className="text-emerald-400">${change.toFixed(2)}</span>
                            ) : (
                                <span className="text-zinc-600 font-normal">---</span>
                            )}
                        </div>
                    </div>

                    {/* Aviso de Siguiente Paso */}
                    <div className="p-3 bg-zinc-900/40 rounded-xl border border-white/5 text-[11px] text-zinc-400 flex items-start gap-2">
                        <QrCode size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                        <div>
                            Al confirmar se guardará el cobro, se descontará en caja y se generará el <strong>Ticket Digital con QR y Serial</strong> para {isPatio ? 'que el personal de carga valide la entrega de mercancía con firma y foto.' : 'entregar la mercancía al cliente en mostrador.'}
                        </div>
                    </div>

                    {/* Botón de Confirmación */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!isValid || isProcessing}
                            className={`flex-[2] py-3.5 px-6 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all active:scale-95 ${
                                isValid && !isProcessing
                                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-emerald-950/50 cursor-pointer'
                                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                            }`}
                        >
                            {isProcessing ? (
                                <span>Procesando Cobro...</span>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    <span>Cobrar ${total.toFixed(2)} & Generar Ticket</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
