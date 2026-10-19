import { useState } from 'react';
import { Download, ImageIcon, Video, LayoutGrid, List } from 'lucide-react';
import { useIntelligenceCreatives, buildExportUrl } from '../../hooks/use-intelligence';
import { IntelligenceFilterBar } from '../components/intelligence-filter-bar';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import type { DataGridColumnDef } from '@/components/data-grid/types';
import type { IntelligenceFilters, CreativeAnalyticsRow } from '../../types/intelligence';

function fmt(n: number | null | undefined, prefix = ''): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const SORT_OPTIONS = [
  { value: 'total_revenue',     label: 'Revenue' },
  { value: 'total_spend',       label: 'Spend' },
  { value: 'total_purchases',   label: 'Purchases' },
  { value: 'total_clicks',      label: 'Clicks' },
  { value: 'total_impressions', label: 'Impressions' },
  { value: 'total_leads',       label: 'Leads' },
];

const CREATIVE_TYPE_LABELS: Record<string, string> = {
  image:      'Image',
  video:      'Video',
  carousel:   'Carousel',
  collection: 'Collection',
  story:      'Story',
  reel:       'Reel',
  other:      'Other',
};

const GRID_COLUMNS: DataGridColumnDef<CreativeAnalyticsRow>[] = [
  {
    key:   'preview',
    label: 'Preview',
    alwaysVisible: true,
    pin:   'left',
    width: 56,
    cell:  (row) => (
      <CreativePreview row={row} />
    ),
  },
  {
    key:   'name',
    label: 'Creative',
    alwaysVisible: true,
    width: 200,
    cell:  (row) => (
      <div className="py-0.5">
        <p className="text-sm font-medium truncate max-w-[180px]" title={row.name ?? ''}>
          {row.name ?? '—'}
        </p>
        {row.headline && (
          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{row.headline}</p>
        )}
        <div className="flex gap-1 mt-1">
          {row.creative_type && (
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
              {CREATIVE_TYPE_LABELS[row.creative_type] ?? row.creative_type}
            </Badge>
          )}
          {row.call_to_action && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              {row.call_to_action}
            </Badge>
          )}
        </div>
      </div>
    ),
  },
  {
    key:   'total_revenue',
    label: 'Revenue',
    align: 'end',
    sortable: true,
    cell:  (row) => <span className="tabular-nums text-green-600">{fmt(row.total_revenue, '$')}</span>,
  },
  {
    key:   'total_spend',
    label: 'Spend',
    align: 'end',
    sortable: true,
    cell:  (row) => <span className="tabular-nums">{fmt(row.total_spend, '$')}</span>,
  },
  {
    key:   'roas',
    label: 'ROAS',
    align: 'end',
    cell:  (row) => {
      const roas = row.total_spend > 0 ? row.total_revenue / row.total_spend : null;
      return <span className="tabular-nums">{roas != null ? `${roas.toFixed(2)}x` : '—'}</span>;
    },
  },
  {
    key:   'total_purchases',
    label: 'Purchases',
    align: 'end',
    sortable: true,
    cell:  (row) => <span className="tabular-nums">{fmt(row.total_purchases)}</span>,
  },
  {
    key:   'cpa',
    label: 'CPA',
    align: 'end',
    cell:  (row) => {
      const cpa = row.total_purchases > 0 ? row.total_spend / row.total_purchases : null;
      return <span className="tabular-nums">{cpa != null ? fmt(cpa, '$') : '—'}</span>;
    },
  },
  {
    key:   'ctr',
    label: 'CTR',
    align: 'end',
    cell:  (row) => {
      const ctr = row.total_impressions > 0 ? (row.total_clicks / row.total_impressions) * 100 : null;
      return <span className="tabular-nums">{ctr != null ? `${ctr.toFixed(2)}%` : '—'}</span>;
    },
  },
  {
    key:   'total_clicks',
    label: 'Clicks',
    align: 'end',
    sortable: true,
    defaultVisible: false,
    cell:  (row) => <span className="tabular-nums">{fmt(row.total_clicks)}</span>,
  },
  {
    key:   'total_impressions',
    label: 'Impressions',
    align: 'end',
    sortable: true,
    defaultVisible: false,
    cell:  (row) => <span className="tabular-nums">{fmt(row.total_impressions)}</span>,
  },
];

function CreativePreview({ row }: { row: CreativeAnalyticsRow }) {
  const thumb = row.thumbnail_url ?? row.image_url;
  if (thumb) {
    return (
      <img
        src={thumb}
        alt={row.name ?? ''}
        className="w-10 h-10 rounded object-cover bg-muted"
        loading="lazy"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
      {row.creative_type === 'video' || row.video_url ? (
        <Video className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

function CardView({ rows }: { rows: CreativeAnalyticsRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No creatives found.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {rows.map((row, i) => {
        const roas = row.total_spend > 0 ? row.total_revenue / row.total_spend : null;
        return (
          <div key={row.creative_id} className="rounded-lg border bg-card overflow-hidden">
            {/* Media */}
            <div className="aspect-square bg-muted relative">
              {row.thumbnail_url || row.image_url ? (
                <img
                  src={row.thumbnail_url ?? row.image_url ?? ''}
                  alt={row.name ?? ''}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {row.creative_type === 'video' ? (
                    <Video className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              )}
              {/* Rank badge */}
              <span className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                #{i + 1}
              </span>
              {row.creative_type && (
                <span className="absolute top-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  {CREATIVE_TYPE_LABELS[row.creative_type] ?? row.creative_type}
                </span>
              )}
            </div>
            {/* Info */}
            <div className="p-2.5">
              <p className="text-xs font-medium truncate" title={row.name ?? ''}>{row.name ?? '—'}</p>
              {row.headline && (
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{row.headline}</p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                <span className="text-muted-foreground">Revenue</span>
                <span className="tabular-nums text-green-600 font-medium">{fmt(row.total_revenue, '$')}</span>
                <span className="text-muted-foreground">ROAS</span>
                <span className="tabular-nums">{roas != null ? `${roas.toFixed(1)}x` : '—'}</span>
                <span className="text-muted-foreground">Purchases</span>
                <span className="tabular-nums">{fmt(row.total_purchases)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CreativeAnalyticsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filters, setFilters] = useState<IntelligenceFilters>({
    date_preset:    'last_30d',
    sort_by:        'total_revenue',
    sort_direction: 'desc',
    per_page:       20,
    page:           1,
  });

  const { data, isLoading, isError, isFetching, refetch } = useIntelligenceCreatives(filters);

  const rows = data?.data ?? [];
  const meta = data?.meta;

  function handleSort(field: string) {
    setFilters((f) => ({
      ...f,
      sort_by:        field,
      sort_direction: f.sort_by === field && f.sort_direction === 'desc' ? 'asc' : 'desc',
      page:           1,
    }));
  }

  function triggerExport(format: 'csv' | 'excel' | 'html') {
    window.open(buildExportUrl('creatives', filters, format), '_blank');
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Creative Analytics</h1>
          {meta && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {meta.total.toLocaleString()} creatives · {meta.date_from} – {meta.date_to}
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
              value={filters.sort_by ?? 'total_revenue'}
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

          {/* View toggle */}
          <div className="flex rounded-md border overflow-hidden">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              className="h-8 rounded-none px-2.5"
              onClick={() => setViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className="h-8 rounded-none px-2.5"
              onClick={() => setViewMode('list')}
              aria-pressed={viewMode === 'list'}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>

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
        {viewMode === 'list' ? (
          <UniversalDataGrid
            data={rows}
            columns={GRID_COLUMNS}
            rowId={(r) => r.creative_id}
            loading={isLoading}
            error={isError}
            sort={{ field: filters.sort_by ?? 'total_revenue', direction: filters.sort_direction ?? 'desc' }}
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
        ) : (
          isLoading ? (
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-lg border bg-card animate-pulse">
                  <div className="aspect-square bg-muted" />
                  <div className="p-2.5 space-y-1.5">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2.5 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <CardView rows={rows} />
          )
        )}
      </div>
    </div>
  );
}
