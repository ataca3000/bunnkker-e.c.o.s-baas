"use client";

import React from 'react';
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, PackageX, Trash2, X } from 'lucide-react';
import type { Product } from '@/context/CartContext';

export interface StockIssue {
  item: Product & { quantity: number };
  requested: number;
  available: number;
  diff: number;
}

interface StockAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  issues: StockIssue[];
  onAdjustItem: (productId: string, newQuantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onAdjustAll: () => void;
  onRemoveAllDeficits: () => void;
}

export function StockAlertModal({
  isOpen,
  onClose,
  issues,
  onAdjustItem,
  onRemoveItem,
  onAdjustAll,
  onRemoveAllDeficits,
}: StockAlertModalProps) {
  if (!isOpen || issues.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-950/95 border-2 border-red-500/60 rounded-3xl shadow-[0_0_60px_rgba(239,68,68,0.35)] w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header con advertencia visual fuerte */}
        <div className="p-5 bg-gradient-to-r from-red-950/80 via-red-900/40 to-zinc-950 border-b border-red-500/30 flex items-start gap-4 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center text-red-400 shrink-0 shadow-[0_0_25px_rgba(239,68,68,0.5)] animate-pulse">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-black uppercase tracking-widest text-red-300 mb-1">
              Bloqueo de Seguridad POS
            </div>
            <h2 className="text-xl font-black text-white tracking-tight uppercase">
              Venta Bloqueada: Stock Insuficiente
            </h2>
            <p className="text-xs text-red-200/80 mt-0.5">
              El inventario físico disponible es menor a la cantidad solicitada. No se puede cobrar hasta resolver los faltantes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            title="Cerrar alerta"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de productos en conflicto */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Productos con stock insuficiente ({issues.length}):</span>
            <span className="text-red-400 font-mono">Acción requerida</span>
          </div>

          {issues.map((issue) => {
            const hasSomeStock = issue.available > 0;
            return (
              <div
                key={issue.item.id}
                className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
                    <h3 className="text-sm font-bold text-white truncate">
                      {issue.item.name}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-black/40 text-zinc-300 border border-white/10">
                      Solicitado: <strong className="text-white">{issue.requested}</strong>
                    </span>
                    <span className={`px-2 py-0.5 rounded-md border font-semibold ${
                      hasSomeStock
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                    }`}>
                      Disponible: <strong>{issue.available}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-red-600/30 text-red-200 border border-red-500/40 font-bold">
                      Faltante: -{issue.diff}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {hasSomeStock ? (
                    <button
                      onClick={() => onAdjustItem(issue.item.id, issue.available)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                      title={`Ajustar cantidad a ${issue.available}`}
                    >
                      <CheckCircle2 size={13} />
                      Ajustar a {issue.available}
                    </button>
                  ) : null}
                  <button
                    onClick={() => onRemoveItem(issue.item.id)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                    title="Eliminar este producto del pedido"
                  >
                    <Trash2 size={13} />
                    Quitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Acciones globales para el cajero */}
        <div className="p-5 bg-zinc-900/90 border-t border-white/10 flex flex-col sm:flex-row gap-2.5 shrink-0">
          <button
            onClick={onAdjustAll}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 active:scale-95"
          >
            <CheckCircle2 size={16} />
            Ajustar todo al stock disponible
          </button>
          <button
            onClick={onRemoveAllDeficits}
            className="py-3 px-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <PackageX size={16} />
            Quitar sin stock
          </button>
          <button
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors"
          >
            Modificar manualmente
          </button>
        </div>

      </div>
    </div>
  );
}
