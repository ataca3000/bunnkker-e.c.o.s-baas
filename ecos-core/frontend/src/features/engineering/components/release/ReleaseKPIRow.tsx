import React from 'react';
import type { ReleaseDashboard } from '../../types/engineering';
interface Props { dashboard: ReleaseDashboard | null; }
function KPI({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-card border rounded-lg px-4 py-3 flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
export default function ReleaseKPIRow({ dashboard }: Props) {
  const s = dashboard?.summary;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KPI label="Total Releases"     value={s?.total ?? '—'} />
      <KPI label="Draft"              value={s?.draft ?? '—'} />
      <KPI label="Active"             value={s?.active ?? '—'} sub="in progress" />
      <KPI label="Pending Approval"   value={s?.pending_approval ?? '—'} />
      <KPI label="Released (Month)"   value={s?.released_this_month ?? '—'} />
      <KPI label="Failed"             value={s?.failed ?? '—'} sub="pipeline/rejected" />
    </div>
  );
}
