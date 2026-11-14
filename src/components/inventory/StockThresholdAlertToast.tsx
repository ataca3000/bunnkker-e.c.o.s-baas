"use client";

import React, { useState } from 'react';
import { AlertTriangle, X, ArrowRight, ShieldAlert, Sliders } from 'lucide-react';
import type { StockAlertSummary } from '@/lib/stockThresholds';
import { motion, AnimatePresence } from 'framer-motion';

interface StockThresholdAlertToastProps {
  summary: StockAlertSummary;
  onOpenModal: () => void;
  onNavigateToThresholds?: () => void;
  onDismiss?: () => void;
}

export default function StockThresholdAlertToast({
  summary,
  onOpenModal,
  onNavigateToThresholds,
  onDismiss
}: StockThresholdAlertToastProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  if (dismissed || summary.totalAlerts === 0 || !summary.alertsEnabled) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        className="fixed bottom-5 right-5 z-[140] max-w-sm w-full bg-slate-950/95 border border-amber-500/50 rounded-2xl shadow-[0_10px_35px_rgba(0,0,0,0.7),0_0_20px_rgba(245,158,11,0.2)] p-4 text-white backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 mt-0.5">
            <AlertTriangle size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <h4 className="text-xs font-black uppercase text-amber-300 tracking-wide">
                Alerta de Stock Mínimo
              </h4>
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                title="Descartar aviso flotante"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-[11px] text-slate-300 mt-1 leading-snug">
              {summary.criticalCount > 0 ? (
                <>
                  <span className="text-red-400 font-bold">{summary.criticalCount} producto(s) agotados</span> y {summary.lowStockCount} alcanzaron su límite mínimo.
                </>
              ) : (
                <>
                  <span className="text-amber-300 font-bold">{summary.lowStockCount} producto(s)</span> han alcanzado el umbral mínimo definido.
                </>
              )}
            </p>

            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
              <button
                onClick={onOpenModal}
                className="flex-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider rounded-lg transition-all shadow-sm active:scale-95 text-center"
              >
                Ver Detalle ({summary.totalAlerts})
              </button>
              <button
                onClick={onNavigateToThresholds}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1"
                title="Ir al panel de configuración de umbrales"
              >
                <Sliders size={12} />
                <span>Configurar</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
