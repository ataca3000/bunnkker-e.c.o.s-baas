"use client";

import React, { useState, useEffect } from 'react';
import { Scale, TrendingUp, TrendingDown, DollarSign, Sparkles, CheckCircle2, Loader2, ArrowUpRight, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export function BalanceEffectWidget() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ai/balance-effect');
      if (!res.ok) return;
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      }
    } catch { } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleApply = async () => {
    if (!data) return;
    setApplying(true);
    try {
      const res = await fetch('/api/ai/balance-effect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagnantId: data.stagnantProduct?.id,
          stagnantNewPrice: data.stagnantProduct?.suggestedPrice,
          highDemandId: data.highDemandProduct?.id,
          highDemandNewPrice: data.highDemandProduct?.suggestedPrice
        })
      });
      const resData = await res.json();
      if (res.ok && resData.success) {
        setApplied(true);
        setTimeout(() => {
          fetchSuggestions();
          setApplied(false);
        }, 5000);
      }
    } catch { } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 flex items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        <span className="text-xs font-mono">Calculando Efecto Balanza (Rotación vs. Margen Puro)...</span>
      </div>
    );
  }

  if (!data || (!data.stagnantProduct && !data.highDemandProduct)) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden my-6"
    >
      {/* Glow de fondo */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none" />

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Efecto Balanza: Rotación vs. Margen</h3>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
          <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-mono font-black">+${data.summary.estimatedLiquidityRecovered.toLocaleString()} MXN</span>
          <span className="text-slate-500">|</span>
          <span className="text-amber-400 font-mono font-black">+{data.summary.estimatedNetMarginIncreasePercent}% margen</span>
        </div>
      </div>

      {/* Tarjetas Comparativas de Productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* Producto A (Estancado - Liquidez Atrapada) */}
        {data.stagnantProduct && (
          <div className="bg-slate-950/80 border border-red-500/30 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Producto A — Dinero Muerto
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">{data.stagnantProduct.stock} unidades</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-2">{data.stagnantProduct.name}</h4>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono">
              <span className="text-slate-500 line-through">${data.stagnantProduct.currentPrice} MXN</span>
              <span className="text-emerald-400 font-bold text-xs bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Sugerencia: ${data.stagnantProduct.suggestedPrice} MXN (-{data.stagnantProduct.discountPercent}%)
              </span>
            </div>
          </div>
        )}

        {/* Producto B (Alta Rotación - Demanda Alta) */}
        {data.highDemandProduct && (
          <div className="bg-slate-950/80 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Producto B — Alta Demanda
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">{data.highDemandProduct.stock} unidades</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-2">{data.highDemandProduct.name}</h4>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono">
              <span className="text-slate-500 line-through">${data.highDemandProduct.currentPrice} MXN</span>
              <span className="text-amber-400 font-bold text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Sugerencia: ${data.highDemandProduct.suggestedPrice} MXN (+${data.highDemandProduct.priceIncrease} MXN)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Botón de Ejecución 1-Click */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="text-xs text-slate-400">
          {applied && (
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> ¡Precios actualizados en cajas al instante!
            </span>
          )}
        </div>

        <button
          onClick={handleApply}
          disabled={applying || applied}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
        >
          {applying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : applied ? (
            <>
              <span>¡Sincronizado!</span>
              <CheckCircle2 className="w-4 h-4" />
            </>
          ) : (
            <>
              <span>Aplicar Cambios</span>
              <Sparkles className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
