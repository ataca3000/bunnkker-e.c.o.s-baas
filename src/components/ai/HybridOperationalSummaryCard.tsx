'use client';

import { useState } from 'react';
import { InferenceMode } from 'firebase/ai';
import { BrainCircuit, Loader2, Play, Sparkles } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import {
  runHybridOperationalSummary,
  type HybridInferenceResponse,
  type HybridOperationalSummaryInput,
} from '@/lib/firebaseAiLogic';
import HybridInferenceBadge from './HybridInferenceBadge';

export default function HybridOperationalSummaryCard({
  auditCount,
  defaultScope = 'inventory_brief',
}: {
  auditCount?: number;
  defaultScope?: HybridOperationalSummaryInput['scope'];
}) {
  const { siteConfig, products, orders } = useCart();
  const [scope, setScope] = useState<HybridOperationalSummaryInput['scope']>(defaultScope);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<HybridInferenceResponse | null>(null);

  const handleRun = async () => {
    setRunning(true);
    try {
      const response = await runHybridOperationalSummary({
        scope,
        businessName: siteConfig?.businessName || 'BUNKKER E.C.O.S.',
        products,
        orders,
        auditCount,
      });
      setResult(response);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/85 p-5 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sky-400">
            <BrainCircuit size={18} aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-50">
              Resumen Operativo Híbrido (On-Device / Cloud)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Resúmenes rápidos de almacén y corte de caja priorizan{' '}
            <span className="font-mono text-emerald-300">PREFER_ON_DEVICE</span> (Gemini Nano);
            auditorías extensas priorizan{' '}
            <span className="font-mono text-sky-300">PREFER_IN_CLOUD</span> con respaldo offline.
          </p>
        </div>

        {result && (
          <HybridInferenceBadge
            source={result.source}
            model={result.model}
            latencyMs={result.latencyMs}
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-800 bg-slate-950 p-1">
          {[
            { id: 'inventory_brief' as const, label: 'Almacén Crítico (On-Device)' },
            { id: 'sales_cut' as const, label: 'Corte de Caja (On-Device)' },
            { id: 'audit_deep' as const, label: 'Auditoría Extensa (Cloud)' },
          ].map((opt) => {
            const active = scope === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScope(opt.id)}
                className={`min-h-[34px] cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={running}
          className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
        >
          {running ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Play size={14} aria-hidden="true" />
          )}
          {running ? 'Procesando inferencia...' : 'Generar Resumen Híbrido'}
        </button>
      </div>

      {result ? (
        <div className="mt-4 space-y-2 rounded-lg border border-slate-800 bg-slate-950/75 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              Modo SDK:{' '}
              <strong className="font-mono text-slate-200">
                {result.requestedMode === InferenceMode.PREFER_IN_CLOUD
                  ? 'PREFER_IN_CLOUD'
                  : 'PREFER_ON_DEVICE'}
              </strong>{' '}
              · {result.routingReason}
            </span>
            {result.fallbackReason && (
              <span className="font-mono text-amber-300/90">
                Fallback: {result.fallbackReason.slice(0, 72)}
              </span>
            )}
          </div>
          <p className="whitespace-pre-line text-xs leading-relaxed text-slate-200">
            {result.text}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-slate-800 px-4 py-3 text-xs text-slate-400">
          <Sparkles size={14} className="shrink-0 text-sky-400" aria-hidden="true" />
          <span>
            Presiona &quot;Generar Resumen Híbrido&quot; para ejecutar Firebase AI Logic sobre tus{' '}
            {products.length} productos y {orders.length} pedidos actuales.
          </span>
        </div>
      )}
    </section>
  );
}
