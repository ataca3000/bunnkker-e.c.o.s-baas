import { useState } from 'react';
import { useInitiativeDashboard } from '../hooks/use-initiatives';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { INITIATIVE_STATUS_LABELS, INITIATIVE_STATUS_COLORS } from '../types/initiative';
import { BUSINESS_GOAL_LABELS } from '../types/campaign';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/router/routes';

function fmt(n: number | null | undefined, prefix = '', dec = 2): string {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${((n ?? 0) * 100).toFixed(2)}%`;
}

interface KpiCardProps { label: string; value: string; sub?: string }
function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function InitiativeExecutiveViewPage() {
  const navigate  = useNavigate();
  const [preset, setPreset] = useState('last_30d');

  const { data, isLoading } = useInitiativeDashboard({ date_preset: preset });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.marketingInitiatives)}>
            <ArrowLeft className="size-4 mr-1" />
            Initiatives
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Initiative Executive View</h1>
            <p className="text-sm text-muted-foreground">
              CEO-level view — Initiatives, not individual Campaigns
            </p>
          </div>
        </div>
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_7d">Last 7 days</SelectItem>
            <SelectItem value="last_30d">Last 30 days</SelectItem>
            <SelectItem value="last_90d">Last 90 days</SelectItem>
            <SelectItem value="last_180d">Last 180 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <>
          {/* Top KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard label="Total Initiatives"  value={fmtInt(data?.aggregate.total_initiatives)} />
            <KpiCard label="Active Initiatives" value={fmtInt(data?.aggregate.active_initiatives)} />
            <KpiCard label="Total Spend"        value={fmt(data?.aggregate.total_spend, '$')} />
            <KpiCard label="Total Reach"        value={fmtInt(data?.aggregate.total_reach)} />
            <KpiCard label="Impressions"        value={fmtInt(data?.aggregate.total_impressions)} />
            <KpiCard label="Avg. CTR"           value={fmtPct(data?.aggregate.avg_ctr)} />
            <KpiCard label="Purchases"          value={fmtInt(data?.aggregate.total_purchases)} />
            <KpiCard label="Leads"              value={fmtInt(data?.aggregate.total_leads)} />
          </div>

          {/* Future placeholders */}
          <div className="rounded-lg border bg-muted/20 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Revenue · Profit · ROAS — <span className="italic">Marketing Finance module (coming soon)</span>
            </p>
          </div>

          {/* Two-column: Status + Business Goal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-medium mb-3">Initiative Status</h2>
              <div className="space-y-1.5">
                {Object.entries(data?.status_distribution ?? {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${INITIATIVE_STATUS_COLORS[status as keyof typeof INITIATIVE_STATUS_COLORS] ?? ''}`}
                    >
                      {INITIATIVE_STATUS_LABELS[status as keyof typeof INITIATIVE_STATUS_LABELS] ?? status}
                    </Badge>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(data?.status_distribution ?? {}).length === 0 && (
                  <p className="text-xs text-muted-foreground">No initiatives yet.</p>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-medium mb-3">Business Goals</h2>
              <div className="space-y-1.5">
                {Object.entries(data?.goal_distribution ?? {}).map(([goal, count]) => (
                  <div key={goal} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {BUSINESS_GOAL_LABELS[goal as keyof typeof BUSINESS_GOAL_LABELS] ?? goal}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(data?.goal_distribution ?? {}).length === 0 && (
                  <p className="text-xs text-muted-foreground">No data yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming deadlines */}
          {(data?.upcoming_deadlines?.length ?? 0) > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-medium">Upcoming Deadlines (next 30 days)</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="text-start px-3 py-2 font-medium">Initiative</th>
                    <th className="text-start px-3 py-2 font-medium">Status</th>
                    <th className="text-end px-3 py-2 font-medium">End Date</th>
                    <th className="text-end px-3 py-2 font-medium">Days Left</th>
                    <th className="text-end px-3 py-2 font-medium">Campaigns</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(data?.upcoming_deadlines ?? []).map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{item.name}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${INITIATIVE_STATUS_COLORS[item.status as keyof typeof INITIATIVE_STATUS_COLORS] ?? ''}`}
                        >
                          {INITIATIVE_STATUS_LABELS[item.status as keyof typeof INITIATIVE_STATUS_LABELS] ?? item.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-end font-mono text-xs">{item.end_date}</td>
                      <td className="px-3 py-2 text-end">
                        <span className={item.days_remaining <= 7 ? 'text-red-600 font-medium' : ''}>
                          {item.days_remaining}d
                        </span>
                      </td>
                      <td className="px-3 py-2 text-end">{item.campaigns_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
