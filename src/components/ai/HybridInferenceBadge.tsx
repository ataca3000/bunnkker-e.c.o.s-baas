'use client';

import { Cloud, Cpu, HardDrive, Server } from 'lucide-react';
import type { FirebaseAiEngineSource } from '@/lib/firebaseAiLogic';

interface HybridInferenceBadgeProps {
  source: FirebaseAiEngineSource;
  model?: string;
  latencyMs?: number;
  compact?: boolean;
}

const SOURCE_META: Record<
  FirebaseAiEngineSource,
  {
    label: string;
    tier: string;
    colorClass: string;
    Icon: typeof Cpu;
  }
> = {
  on_device: {
    label: 'On-Device · Gemini Nano',
    tier: 'Local privado sin costo',
    colorClass: 'border-emerald-500/40 bg-emerald-950/35 text-emerald-300',
    Icon: Cpu,
  },
  in_cloud: {
    label: 'Cloud · Firebase AI Logic',
    tier: 'Respaldo en nube Firebase',
    colorClass: 'border-sky-500/40 bg-sky-950/35 text-sky-300',
    Icon: Cloud,
  },
  server_gemini: {
    label: 'Cloud · Gemini Server',
    tier: 'Respaldo servidor seguro',
    colorClass: 'border-indigo-500/40 bg-indigo-950/35 text-indigo-300',
    Icon: Server,
  },
  local_rule_engine: {
    label: 'Local Offline · BUNKKER',
    tier: 'Motor determinístico sin red',
    colorClass: 'border-amber-500/40 bg-amber-950/35 text-amber-300',
    Icon: HardDrive,
  },
};

export default function HybridInferenceBadge({
  source,
  model,
  latencyMs,
  compact = false,
}: HybridInferenceBadgeProps) {
  const meta = SOURCE_META[source] || SOURCE_META.local_rule_engine;
  const Icon = meta.Icon;

  return (
    <div
      data-testid="hybrid-inference-badge"
      data-source={source}
      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium ${meta.colorClass}`}
      title={model ? `${meta.tier} (${model})` : meta.tier}
    >
      <Icon size={13} className="shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap font-semibold">{meta.label}</span>
      {!compact && model && (
        <>
          <span aria-hidden="true" className="opacity-50">
            ·
          </span>
          <span className="font-mono text-[11px] opacity-85">{model}</span>
        </>
      )}
      {typeof latencyMs === 'number' && (
        <>
          <span aria-hidden="true" className="opacity-50">
            ·
          </span>
          <span className="font-mono text-[11px] tabular-nums">{latencyMs} ms</span>
        </>
      )}
    </div>
  );
}
