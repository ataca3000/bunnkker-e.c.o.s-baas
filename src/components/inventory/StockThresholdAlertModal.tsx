"use client";

import React from 'react';
import { 
  AlertTriangle, ShieldAlert, X, ArrowRight, BellOff, Volume2, 
  VolumeX, Package, MapPin, CheckCircle2, Sliders, ExternalLink, PackagePlus
} from 'lucide-react';
import type { ProductStockAnalysis, StockAlertSummary } from '@/lib/stockThresholds';
import { setAlertSnooze } from '@/lib/stockThresholds';
import { motion, AnimatePresence } from 'framer-motion';

interface StockThresholdAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: StockAlertSummary;
  onNavigateToThresholds?: () => void;
  onConfigureThresholds?: () => void;
  onEditProduct?: (product: any) => void;
  onQuickRestock?: (productId: string) => void;
  formatCurrency?: (val: number) => string;
}

export default function StockThresholdAlertModal({
  isOpen,
  onClose,
  summary,
  onNavigateToThresholds,
  onConfigureThresholds,
  onEditProduct,
  onQuickRestock,
  formatCurrency = (v) => `$${v.toFixed(2)}`
}: StockThresholdAlertModalProps) {
  if (!isOpen || summary.totalAlerts === 0 || !summary.alertsEnabled) return null;

  const handleSnooze = (minutes = 60) => {
    setAlertSnooze(minutes);
    onClose();
  };

  const criticalItems = summary.criticalItems;
  const lowStockItems = summary.lowStockItems;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-950 border border-amber-500/50 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.25)] w-full max-w-2xl overflow-hidden text-white my-8 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-red-950/80 via-amber-950/70 to-slate-900 border-b border-amber-500/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-black text-white text-base sm:text-lg uppercase tracking-tight flex items-center gap-2">
                  <span>Alerta de Stock Mínimo</span>
                  <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                    {summary.totalAlerts} en alerta
                  </span>
                </h3>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  {summary.criticalCount > 0 
                    ? `${summary.criticalCount} producto(s) totalmente agotados y ${summary.lowStockCount} por debajo del umbral mínimo.`
                    : `${summary.lowStockCount} producto(s) han alcanzado o caído por debajo del umbral mínimo de existencias.`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0"
              title="Cerrar aviso"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 bg-slate-900/60 border-b border-slate-800 p-3 px-5 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
              <span className="text-slate-400">Agotados Críticos:</span>
              <span className="font-black text-red-400 text-sm">{summary.criticalCount}</span>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-slate-400">En Límite Mínimo:</span>
              <span className="font-black text-amber-300 text-sm">{summary.lowStockCount}</span>
            </div>
          </div>

          {/* Scrollable List of Breached Products */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-2.5 flex-1">
            {/* Critical First */}
            {criticalItems.map((item) => (
              <div 
                key={item.productId}
                className="bg-red-950/20 border border-red-500/40 rounded-xl p-3 flex items-center justify-between gap-3 hover:bg-red-950/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold shrink-0">
                    <Package size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-xs truncate">{item.productName}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="bg-slate-800 px-1.5 py-0.2 rounded text-slate-300">{item.category}</span>
                      <span className="text-red-400 font-bold">Faltan {item.deficit} para el umbral ({item.effectiveThreshold})</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span className="inline-block bg-red-600 text-white font-black text-xs px-2.5 py-1 rounded-md uppercase tracking-wider tabular-nums">
                      0 en stock
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5 tabular-nums">Umbral: {item.effectiveThreshold}</span>
                  </div>
                  {onQuickRestock && (
                    <button
                      type="button"
                      onClick={() => onQuickRestock(item.productId)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 transition-all active:scale-95"
                      title="Agregar piezas rápidamente"
                    >
                      <PackagePlus size={14} /> Recargar
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Low Stock Items */}
            {lowStockItems.map((item) => (
              <div 
                key={item.productId}
                className="bg-amber-950/15 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between gap-3 hover:bg-amber-950/25 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
                    <Package size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-xs truncate">{item.productName}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span className="bg-slate-800 px-1.5 py-0.2 rounded text-slate-300">{item.category}</span>
                      <span className="text-amber-300 font-bold">Déficit: -{item.deficit} pzas</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <span className="inline-block bg-amber-500/30 text-amber-300 border border-amber-500/50 font-black text-xs px-2.5 py-1 rounded-md tabular-nums">
                      {item.currentStock} disp.
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5 tabular-nums">Mínimo: {item.effectiveThreshold}</span>
                  </div>
                  {onQuickRestock && (
                    <button
                      type="button"
                      onClick={() => onQuickRestock(item.productId)}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 transition-all active:scale-95"
                      title="Agregar piezas rápidamente"
                    >
                      <PackagePlus size={14} /> Recargar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Footer */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <button
              onClick={() => handleSnooze(60)}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center justify-center gap-2"
              title="No volver a mostrar esta ventana por 1 hora"
            >
              <BellOff size={14} />
              <span>Silenciar 1 hora</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
              >
                Cerrar
              </button>

              <button
                onClick={() => {
                  onClose();
                  (onConfigureThresholds || onNavigateToThresholds)?.();
                }}
                className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Sliders size={14} />
                <span>Gestionar Umbrales</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
