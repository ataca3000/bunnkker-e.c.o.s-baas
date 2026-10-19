import { useState } from 'react';
import { useCampaignDashboard } from '../hooks/use-campaigns';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CAMPAIGN_STATUS_LABELS } from '../types/campaign';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/router/routes';

function fmt(n: number | null | undefined, prefix = '', decimals = 2): string {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString();
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${(n * 100).toFixed(2)}%`;
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
}

function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function CampaignExecutiveDashboardPage() {
  const navigate = useNavigate();
  const [days, setDays] = useState(30);

  const { data, isLoading } = useCampaignDashboard({ days });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(ROUTES.marketingCampaigns)}
          >
            <ArrowLeft className="size-4 mr-1" />
            Campaigns
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Campaign Executive Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Aggregated performance across all campaigns
            </p>
          </div>
        </div>
        <Select
          value={String(days)}
          onValueChange={(v) => setDays(Number(v))}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 180 days</SelectItem>
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
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard label="Total Spend"      value={fmt(data?.kpis.total_spend, '$')} />
            <KpiCard label="Impressions"      value={fmtInt(data?.kpis.total_impressions)} />
            <KpiCard label="Clicks"           value={fmtInt(data?.kpis.total_clicks)} />
            <KpiCard label="Reach"            value={fmtInt(data?.kpis.total_reach)} />
            <KpiCard label="Avg. CTR"         value={fmtPct(data?.kpis.avg_ctr)} />
            <KpiCard label="Avg. CPC"         value={fmt(data?.kpis.avg_cpc, '$')} />
            <KpiCard label="Avg. CPM"         value={fmt(data?.kpis.avg_cpm, '$')} />
            <KpiCard
              label="Purchases / Leads"
              value={`${fmtInt(data?.kpis.total_purchases)} / ${fmtInt(data?.kpis.total_leads)}`}
            />
          </div>

          {/* Campaign Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-medium mb-3">Campaign Overview</h2>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total campaigns</span>
                  <span className="font-medium">{fmtInt(data?.campaigns.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active</span>
                  <span className="font-medium text-green-600">{fmtInt(data?.campaigns.active)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campaigns with data</span>
                  <span className="font-medium">{fmtInt(data?.kpis.campaign_count)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h2 className="text-sm font-medium mb-3">Status Distribution</h2>
              <div className="space-y-1 text-sm">
                {Object.entries(data?.status_distribution ?? {}).map(([status, count]) => (
                  <div key={status} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {CAMPAIGN_STATUS_LABELS[status as keyof typeof CAMPAIGN_STATUS_LABELS] ?? status}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
                {Object.keys(data?.status_distribution ?? {}).length === 0 && (
                  <p className="text-muted-foreground text-xs">No data for this period.</p>
                )}
              </div>
            </div>
          </div>

          {/* Daily Trend Table */}
          {(data?.daily_trend?.length ?? 0) > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b">
                <h2 className="text-sm font-medium">Daily Trend</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wide">
                    <tr>
                      <th className="text-start px-3 py-2 font-medium">Date</th>
                      <th className="text-end px-3 py-2 font-medium">Spend</th>
                      <th className="text-end px-3 py-2 font-medium">Impressions</th>
                      <th className="text-end px-3 py-2 font-medium">CTR</th>
                      <th className="text-end px-3 py-2 font-medium">CPC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(data?.daily_trend ?? []).slice(-30).reverse().map((row) => (
                      <tr key={row.date_start} className="hover:bg-muted/30">
                        <td className="px-3 py-1.5 font-mono text-xs">{row.date_start}</td>
                        <td className="px-3 py-1.5 text-end">{fmt(row.spend, '$')}</td>
                        <td className="px-3 py-1.5 text-end">{fmtInt(row.impressions)}</td>
                        <td className="px-3 py-1.5 text-end">{fmtPct(row.ctr)}</td>
                        <td className="px-3 py-1.5 text-end">{fmt(row.cpc, '$')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Period: {data?.period.date_from} → {data?.period.date_to}
            {' · '}Data sourced from historical insight snapshots — never from live provider APIs.
          </p>
        </>
      )}
    </div>
  );
}
