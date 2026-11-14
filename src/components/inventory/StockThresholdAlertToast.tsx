"use client";

import React from 'react';
import { AlertTriangle, X, Sliders, BellOff, Package } from 'lucide-react';
import type { StockAlertSummary } from '@/lib/stockThresholds';
import { motion, AnimatePresence } from 'framer-motion';

interface StockThresholdAlertToastProps {
  isVisible?: boolean;
  summary: StockAlertSummary;
  onOpenModal: () => void;
  onNavigateToThresholds?: () => void;
  onDismiss?: () => void;
  onSnooze?: () => void;
}

export default function StockThresholdAlertToast({
  isVisible = true,
  summary,
  onOpenModal,
  onNavigateToThresholds,
  onDismiss,
  onSnooze,
}: StockThresholdAlertToastProps) {
  const showToast = isVisible && summary.totalAlerts > 0 && summary.alertsEnabled;
  const breachedPreview = [...summary.criticalItems, ...summary.lowStockItems].slice(0, 3);
  const remainingCount = Math.max(0, summary.totalAlerts - breachedPreview.length);
  const isCritical = summary.criticalCount > 0;

  return (
    <AnimatePresence>
      {showToast && (
        <motion.div
          key="stock-threshold-alert-toast"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className={`fixed bottom-5 right-5 z-[140] max-w-md w-[calc(100vw-2rem)] sm:w-full bg-slate-950/95 border rounded-2xl p-4 text-white backdrop-blur-xl shadow-2xl ${
            isCritical
              ? 'border-rose-500/60 shadow-[0_12px_36px_rgba(0,0,0,0.75),0_0_24px_rgba(244,63,94,0.2)]'
              : 'border-amber-500/50 shadow-[0_12px_36px_rgba(0,0,0,0.75),0_0_20px_rgba(245,158,11,0.2)]'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-xl border shrink-0 mt-0.5 ${
                isCritical
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}
            >
              <AlertTriangle size={18} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4
                  className={`text-xs font-black uppercase tracking-wide ${
                    isCritical ? 'text-rose-300' : 'text-amber-300'
                  }`}
                >
                  Alerta de Stock Mínimo ({summary.totalAlerts})
                </h4>
                <button
                  type="button"
                  onClick={onDismiss}
                  aria-label="Cerrar notificación de stock mínimo"
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Descartar aviso"
                >
                  <X size={15} />
                </button>
              </div>

              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                {summary.criticalCount > 0 ? (
                  <>
                    <span className="text-rose-400 font-bold">{summary.criticalCount} agotado(s)</span>
                    {summary.lowStockCount > 0 && (
                      <> y <span className="text-amber-300 font-bold">{summary.lowStockCount} en límite mínimo</span></>
                    )}
                    .
                  </>
                ) : (
                  <>
                    <span className="text-amber-300 font-bold">{summary.lowStockCount} producto(s)</span> por debajo del mínimo configurado.
                  </>
                )}
              </p>

              {breachedPreview.length > 0 && (
                <ul className="mt-2.5 space-y-1.5 border border-slate-800/90 bg-slate-900/70 rounded-xl p-2">
                  {breachedPreview.map((item) => (
                    <li
                      key={item.productId}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="flex items-center gap-1.5 text-slate-200 truncate">
                        <Package size={12} className={item.status === 'out_of_stock' ? 'text-rose-400 shrink-0' : 'text-amber-400 shrink-0'} />
                        <span className="truncate font-semibold">{item.productName}</span>
                      </span>
                      <span
                        className={`font-mono font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded-md border ${
                          item.status === 'out_of_stock'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {item.currentStock}/{item.effectiveThreshold}
                      </span>
                    </li>
                  ))}
                  {remainingCount > 0 && (
                    <li className="text-[10px] text-slate-400 font-semibold pt-0.5 text-right">
                      +{remainingCount} producto(s) más en alerta
                    </li>
                  )}
                </ul>
              )}

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onOpenModal}
                  className="flex-1 min-h-[40px] px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 text-center"
                >
                  Ver Detalle ({summary.totalAlerts})
                </button>
                {onNavigateToThresholds && (
                  <button
                    type="button"
                    onClick={onNavigateToThresholds}
                    className="min-h-[40px] px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[11px] rounded-xl transition-colors flex items-center gap-1"
                    title="Configurar umbrales mínimos"
                  >
                    <Sliders size={13} />
                    <span>Umbrales</span>
                  </button>
                )}
                {onSnooze && (
                  <button
                    type="button"
                    onClick={onSnooze}
                    className="min-h-[40px] px-2.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 font-bold text-[11px] rounded-xl transition-colors flex items-center gap-1"
                    title="Posponer alertas 1 hora"
                  >
                    <BellOff size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
