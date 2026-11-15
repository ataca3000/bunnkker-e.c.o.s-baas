"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
    PackagePlus,
    X,
    CheckCircle2,
    AlertTriangle,
    ArrowRight,
    Loader2,
    History,
    MapPin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product } from '@/lib/types';
import {
    validateRestockPiecesInput,
    getRestockMismatchFeedback,
    type RestockAuditEntry,
} from '@/lib/restockConfirmation';

interface QuickRestockModalProps {
    isOpen: boolean;
    product: Product | null;
    effectiveThreshold?: number;
    recentEntries?: RestockAuditEntry[];
    onClose: () => void;
    onConfirmRestock: (params: {
        product: Product;
        qtyToAdd: number;
        confirmQtyToAdd: number;
        notes: string;
    }) => Promise<void>;
}

export default function QuickRestockModal({
    isOpen,
    product,
    effectiveThreshold = 5,
    recentEntries = [],
    onClose,
    onConfirmRestock,
}: QuickRestockModalProps) {
    const [qtyInput, setQtyInput] = useState('');
    const [confirmQtyInput, setConfirmQtyInput] = useState('');
    const [notes, setNotes] = useState('');
    const [mismatchCount, setMismatchCount] = useState(0);
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const qtyInputRef = useRef<HTMLInputElement>(null);
    const confirmInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && product) {
            setQtyInput('');
            setConfirmQtyInput('');
            setNotes('');
            setMismatchCount(0);
            setErrorMessage('');
            setIsSubmitting(false);
            const t = window.setTimeout(() => qtyInputRef.current?.focus(), 60);
            return () => window.clearTimeout(t);
        }
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    const currentStock = Number(product.stock) || 0;
    const allowDecimal = false;
    const unitLabel = product.unitType || 'PZA';
    const deficit = Math.max(0, effectiveThreshold - currentStock);

    const parsedQty = Number(qtyInput);
    const hasValidFirst = Number.isFinite(parsedQty) && parsedQty > 0 && (allowDecimal || Number.isInteger(parsedQty));
    const hasBothInputs = qtyInput.trim() !== '' && confirmQtyInput.trim() !== '';
    const isExactMatch =
        hasBothInputs &&
        hasValidFirst &&
        Number.isFinite(Number(confirmQtyInput)) &&
        Math.abs(Number(confirmQtyInput) - parsedQty) < 0.0001;

    const previewNewStock = hasValidFirst
        ? Number((currentStock + parsedQty).toFixed(allowDecimal ? 3 : 0))
        : currentStock;

    const productHistory = recentEntries.filter((e) => e.productId === product.id).slice(0, 3);

    const handlePresetQty = (amount: number) => {
        if (amount <= 0) return;
        setQtyInput(String(amount));
        setConfirmQtyInput('');
        setMismatchCount(0);
        setErrorMessage('');
        confirmInputRef.current?.focus();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        const check = validateRestockPiecesInput(qtyInput, confirmQtyInput, {
            allowDecimal,
            currentStock,
        });

        if (!check.valid) {
            if (check.reason === 'MISMATCH' && confirmQtyInput.trim() !== '') {
                const nextFails = mismatchCount + 1;
                setMismatchCount(nextFails);
                setErrorMessage(getRestockMismatchFeedback(nextFails, qtyInput, confirmQtyInput));
            } else {
                setErrorMessage(check.message);
            }
            return;
        }

        setErrorMessage('');
        setIsSubmitting(true);
        try {
            await onConfirmRestock({
                product,
                qtyToAdd: check.qty,
                confirmQtyToAdd: check.qty,
                notes: notes.trim(),
            });
            onClose();
        } catch (err: any) {
            setErrorMessage(err?.message || 'No se pudo registrar la recarga de piezas.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[240] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 12 }}
                    transition={{ duration: 0.18 }}
                    className="bg-slate-950 border border-emerald-500/40 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-white my-6"
                >
                    {/* Header */}
                    <div className="p-4 sm:p-5 bg-slate-900/90 border-b border-slate-800 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                                <PackagePlus size={22} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                    Recarga Rápida de Inventario
                                </p>
                                <h3 className="text-base font-black text-white truncate mt-0.5">
                                    {product.name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                                    <span className="inline-flex items-center gap-1">
                                        <MapPin size={12} className="text-cyan-400" />
                                        {product.location?.estante || product.estante || 'Sin estante'} / {product.location?.fila || product.fila || 'General'}
                                    </span>
                                    {product.barcode && (
                                        <span className="font-mono text-slate-500">CB: {product.barcode}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Cerrar recarga rápida"
                            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Estado actual vs mínimo */}
                    <div className="grid grid-cols-3 gap-2 p-4 bg-slate-900/40 border-b border-slate-800 text-center">
                        <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5">
                            <span className="block text-[10px] font-bold uppercase text-slate-400">Stock Actual</span>
                            <span className={`font-mono font-black text-lg tabular-nums ${currentStock <= 0 ? 'text-rose-400' : currentStock <= effectiveThreshold ? 'text-amber-300' : 'text-emerald-300'}`}>
                                {currentStock} <span className="text-[10px] font-bold">{unitLabel}</span>
                            </span>
                        </div>
                        <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5">
                            <span className="block text-[10px] font-bold uppercase text-slate-400">Mínimo</span>
                            <span className="font-mono font-black text-lg tabular-nums text-slate-200">
                                {effectiveThreshold} <span className="text-[10px] font-bold">{unitLabel}</span>
                            </span>
                        </div>
                        <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5">
                            <span className="block text-[10px] font-bold uppercase text-slate-400">Faltante</span>
                            <span className={`font-mono font-black text-lg tabular-nums ${deficit > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {deficit > 0 ? `-${deficit}` : '0'} <span className="text-[10px] font-bold">{unitLabel}</span>
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
                        {/* Presets rápidos (llenan solo el campo 1 para mantener confirmación real) */}
                        <div>
                            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                Atajos de recarga (requiere confirmación manual)
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {deficit > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handlePresetQty(deficit)}
                                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-black tabular-nums transition-colors"
                                    >
                                        +{deficit} (Cubrir mínimo)
                                    </button>
                                )}
                                {[5, 10, 20, 50].map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => handlePresetQty(preset)}
                                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold tabular-nums transition-colors"
                                    >
                                        +{preset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Campo 1 + Campo 2 (Doble confirmación anti-dedos igual que Precio) */}
                        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5 space-y-3">
                            <div>
                                <label className="text-[11px] font-black text-emerald-300 uppercase tracking-wider mb-1.5 block">
                                    Piezas a Agregar (+) *
                                </label>
                                <input
                                    ref={qtyInputRef}
                                    type="number"
                                    inputMode={allowDecimal ? 'decimal' : 'numeric'}
                                    min={allowDecimal ? '0.01' : '1'}
                                    step={allowDecimal ? '0.01' : '1'}
                                    value={qtyInput}
                                    onChange={(e) => {
                                        setQtyInput(e.target.value);
                                        setErrorMessage('');
                                    }}
                                    placeholder={allowDecimal ? 'Ej. 12.5' : 'Ej. 20'}
                                    className="w-full bg-slate-900 border border-emerald-500/40 p-3 rounded-xl font-black text-2xl tabular-nums text-emerald-300 placeholder-emerald-900/60 outline-none focus:border-emerald-400"
                                />
                            </div>

                            <div className="pt-2.5 border-t border-emerald-500/20">
                                <label className="text-[11px] font-black text-emerald-300 uppercase tracking-wider mb-1.5 flex items-center justify-between gap-2">
                                    <span>Repetir Piezas a Agregar *</span>
                                    {hasBothInputs && (
                                        isExactMatch ? (
                                            <span className="text-emerald-400 flex items-center gap-1 text-[10px] font-bold">
                                                <CheckCircle2 size={12} /> Coincide
                                            </span>
                                        ) : (
                                            <span className="text-rose-400 flex items-center gap-1 text-[10px] font-bold">
                                                <AlertTriangle size={12} /> Difieren
                                            </span>
                                        )
                                    )}
                                </label>
                                <input
                                    ref={confirmInputRef}
                                    type="number"
                                    inputMode={allowDecimal ? 'decimal' : 'numeric'}
                                    min={allowDecimal ? '0.01' : '1'}
                                    step={allowDecimal ? '0.01' : '1'}
                                    value={confirmQtyInput}
                                    onChange={(e) => {
                                        setConfirmQtyInput(e.target.value);
                                        setErrorMessage('');
                                    }}
                                    placeholder="Repite la cantidad exacta"
                                    className={`w-full bg-slate-900 border p-3 rounded-xl font-black text-xl tabular-nums placeholder-emerald-900/60 outline-none transition-all ${
                                        !confirmQtyInput
                                            ? 'border-emerald-500/30 text-emerald-300'
                                            : isExactMatch
                                                ? 'border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/20'
                                                : 'border-rose-500 text-rose-300 ring-2 ring-rose-500/20'
                                    }`}
                                />
                            </div>

                            {errorMessage && (
                                <p className="text-xs font-bold text-rose-400 flex items-start gap-1.5 pt-1">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                    <span>{errorMessage}</span>
                                </p>
                            )}
                        </div>

                        {/* Vista previa del nuevo stock */}
                        <div className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800 px-3.5 py-2.5 text-xs">
                            <div className="flex items-center gap-2 font-mono tabular-nums">
                                <span className="text-slate-400">{currentStock}</span>
                                <span className="text-emerald-400 font-black">
                                    +{hasValidFirst ? parsedQty : 0}
                                </span>
                                <ArrowRight size={14} className="text-slate-500" />
                                <span className="text-white font-black text-sm">
                                    {previewNewStock} {unitLabel}
                                </span>
                            </div>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                previewNewStock > effectiveThreshold
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}>
                                {previewNewStock > effectiveThreshold ? 'Stock saludable' : 'Aún bajo mínimo'}
                            </span>
                        </div>

                        {/* Nota / Referencia para Auditoría */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                Nota o Referencia para Auditoría (Opcional)
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Ej. Remisión proveedor #482 / Reposición pasillo A"
                                maxLength={180}
                                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                            />
                        </div>

                        {/* Últimas recargas de este producto */}
                        {productHistory.length > 0 && (
                            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-3">
                                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                    <History size={12} className="text-cyan-400" />
                                    <span>Últimas recargas registradas</span>
                                </div>
                                <div className="space-y-1.5">
                                    {productHistory.map((h) => (
                                        <div key={h.id} className="flex items-center justify-between text-[11px] text-slate-300">
                                            <span className="truncate pr-2">
                                                <strong className="text-emerald-400 font-mono tabular-nums">+{h.addedQty ?? '?'}</strong> por {h.operatorName}
                                            </span>
                                            <span className="font-mono text-[10px] text-slate-500 shrink-0 tabular-nums">
                                                {h.previousStock ?? '?'} → {h.newStock ?? '?'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Botones */}
                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
                            >
                                {isSubmitting ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <PackagePlus size={16} />
                                )}
                                <span>
                                    {isSubmitting
                                        ? 'Guardando y Auditando...'
                                        : `Confirmar Recarga${hasValidFirst ? ` (+${parsedQty} ${unitLabel})` : ''}`}
                                </span>
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
