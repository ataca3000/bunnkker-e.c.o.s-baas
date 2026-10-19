import { useState } from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { useIntelligenceCampaigns, useIntelligenceCampaignTrend, buildExportUrl } from '../../hooks/use-intelligence';
import { IntelligenceFilterBar } from '../components/intelligence-filter-bar';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LineChart } from '../components/line-chart';
import type { DataGridColumnDef } from '@/components/data-grid/types';
import type { IntelligenceFilters, CampaignAnalyticsRow } from '../../types/intelligence';

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const SORT_OPTIONS = [
  { value: 'total_spend',       label: 'Spend' },
  { value: 'total_revenue',     label: 'Revenue' },
  { value: 'total_purchases',   label: 'Purchases' },
  { value: 'total_leads',       label: 'Leads' },
  { value: 'total_clicks',      label: 'Clicks' },
  { value: 'total_impressions', label: 'Impressions' },
  { value: 'total_reach',       label: 'Reach' },
];

const COLUMNS: DataGridColumnDef<CampaignAnalyticsRow>[] = [
  {
    key:  'name',
    label: 'Campaign',
    alwaysVisible: true,
    pin: 'left',
    width: 240,
    cell: (row) => (
      <span className="font-medium text-sm truncate block max-w-[220px]" title={row.name ?? ''}>
        {row.name ?? '—'}
      </span>
    ),
  },
  {
    key:   'total_spend',
    label: 'Spend',
    align: 'end',
    sortable: true,
    cell: (row) => <span className="tabular-nums">{fmt(row.total_spend, '$')}</span>,
  },
  {
    key:   'total_revenue',
    label: 'Revenue',
    align: 'end',
    sortable: true,
    cell: (row) => <span className="tabular-nums text-green-600">{fmt(row.total_revenue, '$')}</span>,
  },
  {
    key:   'roas',
    label: 'ROAS',
    align: 'end',
    cell: (row) => {
      const roas = row.total_spend > 0 ? row.total_revenue / row.total_spend : null;
      return <span className="tabular-nums">{roas != null ? `${roas.toFixed(2)}x` : '—'}</span>;
    },
  },
  {
    key:   'total_purchases',
    label: 'Purchases',
    align: 'end',
    sortable: true,
    cell: (row) => <span className="tabular-nums">{fmt(row.total_purchases)}</span>,
  },
  {
    key:   'cpa',
    label: 'CPA',
    align: 'end',
    defaultVisible: false,
    cell: (row) => {
      const cpa = row.total_purchases > 0 ? row.total_spend / row.total_purchases : null;
      return <span className="tabular-nums">{cpa != null ? fmt(cpa, '$') : '—'}</span>;
    },
  },
  {
    key:   'total_leads',
    label: 'Leads',
    align: 'end',
    sortable: true,
    cell: (row) => <span className="tabular-nums">{fmt(row.total_leads)}</span>,
  },
  {
    key:   'total_clicks',
    label: 'Clicks',
    align: 'end',
    sortable: true,
    cell: (row) => <span className="tabular-nums">{fmt(row.total_clicks)}</span>,
  },
  {
    key:   'total_impressions',
    label: 'Impressions',
    align: 'end',
    sortable: true,
    defaultVisible: false,
    cell: (row) => <span className="tabular-nums">{fmt(row.total_impressions)}</span>,
  },
  {
    key:   'total_reach',
    label: 'Reach',
    align: 'end',
    sortable: true,
    defaultVisible: false,
    cell: (row) => <span className="tabular-nums">{fmt(row.total_reach)}</span>,
  },
  {
    key:   'trend',
    label: 'Trend',
    pin: 'right',
    width: 60,
    alwaysVisible: true,
    cell: (row) => (
      <TrendButton campaignId={row.entity_id} />
    ),
  },
];

function TrendButton({ campaignId }: { campaignId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useIntelligenceCampaignTrend(open ? campaignId : undefined);

  const trendData = (data?.data ?? []) as Array<{ period: string; spend: number }>;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 p-0"
        onClick={() => setOpen(true)}
        aria-label="View trend"
      >
        <TrendingUp className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Campaign Spend Trend</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-sm text-muted-foreground animate-pulse">
              Loading…
            </div>
          ) : (
            <LineChart
              data={trendData.map((d) => ({ label: d.period, value: d.spend }))}
              height={160}
              color="#3B82F6"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CampaignAnalyticsPage() {
  const [filters, setFilters] = useState<IntelligenceFilters>({
    date_preset:    'last_30d',
    sort_by:        'total_spend',
    sort_direction: 'desc',
    per_page:       25,
    page:           1,
  });

  const { data, isLoading, isError, isFetching, refetch } = useIntelligenceCampaigns(filters);

  const rows = data?.data ?? [];
  const meta = data?.meta;

  function handleSort(field: string) {
    setFilters((f) => ({
      ...f,
      sort_by: field,
      sort_direction: f.sort_by === field && f.sort_direction === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  }

  function triggerExport(format: 'csv' | 'excel' | 'html') {
    window.open(buildExportUrl('campaigns', filters, format), '_blank');
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Campaign Analytics</h1>
          {meta && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {meta.total.toLocaleString()} campaigns · {meta.date_from} – {meta.date_to}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <IntelligenceFilterBar
            filters={filters}
            onFilterChange={(p) => setFilters((f) => ({ ...f, ...p, page: 1 }))}
            onRefresh={() => refetch()}
            isFetching={isFetching}
          >
            <Select
              value={filters.sort_by ?? 'total_spend'}
              onValueChange={(v) => setFilters((f) => ({ ...f, sort_by: v, page: 1 }))}
            >
              <SelectTrigger className="w-32 h-8 text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </IntelligenceFilterBar>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => triggerExport('csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerExport('excel')}>Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => triggerExport('html')}>HTML</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <UniversalDataGrid
          data={rows}
          columns={COLUMNS}
          rowId={(r) => r.entity_id}
          loading={isLoading}
          error={isError}
          sort={{ field: filters.sort_by ?? 'total_spend', direction: filters.sort_direction ?? 'desc' }}
          onSortChange={handleSort}
          pagination={meta ? {
            meta: {
              page:     meta.current_page,
              perPage:  meta.per_page,
              total:    meta.total,
              lastPage: meta.last_page,
            },
            onPageChange: (p) => setFilters((f) => ({ ...f, page: p })),
          } : undefined}
        />
      </div>
    </div>
  );
}
