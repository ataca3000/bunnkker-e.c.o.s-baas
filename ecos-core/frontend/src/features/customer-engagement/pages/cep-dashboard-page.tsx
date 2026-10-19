import { useCepKpis, useCepProviderDistribution, useCepStatusDistribution } from '../hooks/use-cep';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
  PROVIDER_LABELS, CONVERSATION_STATUS_LABELS, PROVIDER_COLORS, STATUS_COLORS,
  type CommunicationProvider, type ConversationStatus,
} from '../types/cep';

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function fmtSeconds(s: number | null): string {
  if (s == null) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

export function CepDashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useCepKpis();
  const { data: providers } = useCepProviderDistribution();
  const { data: statuses  } = useCepStatusDistribution();

  if (kpisLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const conv  = kpis?.conversations;
  const sla   = kpis?.sla;
  const leads = kpis?.leads;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Engagement Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Unified view across all communication channels
        </p>
      </div>

      {/* Conversations KPIs */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">Conversations</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total"          value={conv?.total ?? 0} />
          <KpiCard label="Open"           value={conv?.open ?? 0} />
          <KpiCard label="Pending"        value={conv?.pending ?? 0} />
          <KpiCard label="Unread"         value={conv?.unread ?? 0} />
          <KpiCard label="Resolved Today" value={conv?.resolvedToday ?? 0} />
          <KpiCard label="Avg First Response" value={fmtSeconds(conv?.avgFirstResponse ?? null)} />
        </div>
      </section>

      {/* SLA + Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SLA */}
        <section className="rounded-md border p-4">
          <h2 className="text-sm font-medium mb-3">SLA Compliance</h2>
          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div>
              <p className="text-muted-foreground text-xs">Compliance Rate</p>
              <p className="text-2xl font-semibold tabular-nums">{sla?.rate ?? 100}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Breached</p>
              <p className={`text-2xl font-semibold tabular-nums ${(sla?.breached ?? 0) > 0 ? 'text-red-600' : ''}`}>
                {sla?.breached ?? 0}
              </p>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>Total: {sla?.total ?? 0}</span>
            <span>Pending: {sla?.pending ?? 0}</span>
            <span>Resolved: {sla?.resolved ?? 0}</span>
          </div>
        </section>

        {/* Leads */}
        <section className="rounded-md border p-4">
          <h2 className="text-sm font-medium mb-3">Leads</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <KpiCard label="Total Leads"     value={leads?.total ?? 0} />
            <KpiCard label="New"             value={leads?.new ?? 0} />
            <KpiCard label="Qualified"       value={leads?.qualified ?? 0} />
            <KpiCard label="Converted"       value={leads?.converted ?? 0} />
          </div>
        </section>
      </div>

      {/* Provider + Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Distribution */}
        <section className="rounded-md border p-4">
          <h2 className="text-sm font-medium mb-3">Channel Distribution</h2>
          {!providers || providers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No data yet</p>
          ) : (
            <div className="space-y-2">
              {providers.map((p) => {
                const total = providers.reduce((sum, x) => sum + x.count, 0);
                const pct   = total > 0 ? Math.round((p.count / total) * 100) : 0;
                return (
                  <div key={p.provider} className="flex items-center gap-2">
                    <Badge variant="secondary" className={`text-xs w-28 justify-center shrink-0 ${PROVIDER_COLORS[p.provider as CommunicationProvider] ?? ''}`}>
                      {PROVIDER_LABELS[p.provider as CommunicationProvider] ?? p.provider}
                    </Badge>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground w-10 text-end">{p.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Status Distribution */}
        <section className="rounded-md border p-4">
          <h2 className="text-sm font-medium mb-3">Status Breakdown</h2>
          {!statuses || statuses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No data yet</p>
          ) : (
            <div className="space-y-2">
              {statuses.map((s) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[s.status as ConversationStatus] ?? ''}`}>
                    {CONVERSATION_STATUS_LABELS[s.status as ConversationStatus] ?? s.status}
                  </Badge>
                  <span className="tabular-nums font-medium">{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
