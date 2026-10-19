import React from 'react';
import type { ClusterDashboard } from '../../types/engineering';

interface Props {
  dashboard: ClusterDashboard | null;
}

function KPI({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-card border rounded-lg px-4 py-3 flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function ClusterKPIRow({ dashboard }: Props) {
  const w  = dashboard?.workers;
  const q  = dashboard?.queue;
  const r  = dashboard?.resources;
  const tp = dashboard?.throughput;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KPI label="Active Workers"    value={w?.active ?? '—'}  sub={`/ ${w?.total ?? 0} total`} />
      <KPI label="Idle Workers"      value={w?.idle ?? '—'}    sub="available" />
      <KPI label="Queue Pending"     value={q?.pending ?? '—'} sub="waiting to run" />
      <KPI label="CPU"               value={r ? r.cpu_percent.toFixed(1) + '%' : '—'} sub="utilization" />
      <KPI label="Memory"            value={r ? r.memory_mb_used + ' MB' : '—'} sub="in use" />
      <KPI label="Throughput"        value={tp ? tp.tasks_per_hour.toFixed(1) : '—'} sub="tasks/hr today" />
    </div>
  );
}
