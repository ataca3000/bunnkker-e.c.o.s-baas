import { useMemo, useState } from 'react';
import { Factory, Loader2, Package, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import { ColumnVisibilityMenu } from '@/components/data-grid/column-visibility-menu';
import { useColumnVisibility } from '@/components/data-grid/use-column-visibility';
import type { DataGridColumnDef } from '@/components/data-grid/types';
import { useWaveProductDemand, useWaveKpis } from '../hooks/use-preparation';
import { useSelectedWaveId } from '../components/wave-picker';
import type { WaveProductDemandItem } from '../types/preparation';

type CompletionFilter = 'all' | 'not_started' | 'in_progress' | 'completed';

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WaveProductDemandPage() {
  const { t } = useTranslation('operations');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const waveId = useSelectedWaveId();
  const { data: items, isLoading, isFetching, refetch } = useWaveProductDemand(waveId);
  const { data: kpis } = useWaveKpis(waveId);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CompletionFilter>('all');

  const COMPLETION_TABS: Array<{ value: CompletionFilter; label: string }> = [
    { value: 'all',         label: t($ => $.wave.productDemand.filters.all) },
    { value: 'not_started', label: t($ => $.wave.productDemand.filters.notStarted) },
    { value: 'in_progress', label: t($ => $.wave.productDemand.filters.inProgress) },
    { value: 'completed',   label: t($ => $.wave.productDemand.filters.completed) },
  ];

  const columns: DataGridColumnDef<WaveProductDemandItem>[] = useMemo(() => [
    {
      key: 'product',
      label: t($ => $.wave.productDemand.columns.product),
      alwaysVisible: true,
      cell: (item) => (
        <div>
          <div className="text-sm font-medium">{item.product_name}</div>
          {item.product_sku && (
            <div className="text-[10px] text-muted-foreground font-mono">{item.product_sku}</div>
          )}
        </div>
      ),
    },
    {
      key: 'required_qty',
      label: t($ => $.wave.productDemand.columns.required),
      defaultVisible: true,
      align: 'end',
      cell: (item) => <span className="text-sm tabular-nums">{fmt(item.required_qty)}</span>,
    },
    {
      key: 'prepared_qty',
      label: t($ => $.wave.productDemand.columns.prepared),
      defaultVisible: true,
      align: 'end',
      cell: (item) => (
        <span className="text-sm tabular-nums text-emerald-700">{fmt(item.prepared_qty)}</span>
      ),
    },
    {
      key: 'remaining_qty',
      label: t($ => $.wave.productDemand.columns.remaining),
      defaultVisible: true,
      align: 'end',
      cell: (item) => (
        <span className={`text-sm tabular-nums ${item.remaining_qty > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
          {item.remaining_qty > 0 ? fmt(item.remaining_qty) : '—'}
        </span>
      ),
    },
    {
      key: 'orders_count',
      label: t($ => $.wave.productDemand.columns.orders),
      defaultVisible: true,
      align: 'end',
      cell: (item) => (
        <span className="text-sm tabular-nums text-muted-foreground">{item.orders_count}</span>
      ),
    },
    {
      key: 'completion_pct',
      label: t($ => $.wave.productDemand.columns.progress),
      defaultVisible: true,
      width: 140,
      cell: (item) => (
        <div className="space-y-0.5 min-w-[100px]">
          <Progress value={item.completion_pct} className="h-1.5" />
          <p className="text-xs text-muted-foreground">{item.completion_pct.toFixed(1)}%</p>
        </div>
      ),
    },
    {
      key: 'manufacture',
      label: t($ => $.wave.productDemand.columns.action),
      alwaysVisible: true,
      align: 'end',
      cell: () => (
        <span
          className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded px-2 py-1 opacity-50 cursor-not-allowed select-none"
          title={t($ => $.wave.productDemand.manufactureNow)}
        >
          <Factory className="h-3 w-3" />
          {t($ => $.wave.productDemand.manufactureNow)}
        </span>
      ),
    },
   
  ], [t]);

  const colMetas = useMemo(() => columns.map((c) => ({
    key: c.key,
    label: c.label,
    alwaysVisible: c.alwaysVisible,
    defaultVisible: c.defaultVisible,
  })), [columns]);

  const colVis = useColumnVisibility('wave-product-demand-cols', colMetas);

  const allItems = items ?? [];

  function matchesFilter(item: WaveProductDemandItem): boolean {
    switch (filter) {
      case 'not_started': return item.prepared_qty === 0;
      case 'in_progress': return item.prepared_qty > 0 && item.remaining_qty > 0;
      case 'completed':   return item.remaining_qty === 0;
      default:            return true;
    }
  }

  const filtered = allItems.filter((item) => {
    if (!matchesFilter(item)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.product_name.toLowerCase().includes(q) ||
        (item.product_sku ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const countByFilter: Record<CompletionFilter, number> = {
    all:         allItems.length,
    not_started: allItems.filter((i) => i.prepared_qty === 0).length,
    in_progress: allItems.filter((i) => i.prepared_qty > 0 && i.remaining_qty > 0).length,
    completed:   allItems.filter((i) => i.remaining_qty === 0).length,
  };

  const completionPct = kpis?.completion_pct ?? 0;

  return (
    <div className="flex flex-col h-full">
      <SmartToolbar
        onRefresh={() => void refetch()}
        isFetching={isFetching}
        viewControls={
          <ColumnVisibilityMenu
            columns={colMetas}
            visibility={colVis.visibility}
            onToggle={colVis.toggle}
            onReset={colVis.reset}
          />
        }
      />

      {/* KPI row */}
      {allItems.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-background overflow-x-auto shrink-0">
          {[
            { label: t($ => $.wave.productDemand.kpis.products),   value: allItems.length,                                                            cls: '' },
            { label: t($ => $.wave.productDemand.kpis.required),   value: fmt(allItems.reduce((s, i) => s + i.required_qty, 0)),                       cls: 'tabular-nums' },
            { label: t($ => $.wave.productDemand.kpis.prepared),   value: fmt(allItems.reduce((s, i) => s + i.prepared_qty, 0)),                       cls: 'tabular-nums text-emerald-700' },
            { label: t($ => $.wave.productDemand.kpis.remaining),  value: fmt(allItems.reduce((s, i) => s + i.remaining_qty, 0)),                      cls: `tabular-nums ${allItems.some((i) => i.remaining_qty > 0) ? 'text-amber-700' : 'text-muted-foreground'}` },
            { label: t($ => $.wave.productDemand.kpis.completion), value: `${completionPct.toFixed(1)}%`,                                              cls: `tabular-nums ${completionPct >= 100 ? 'text-emerald-700' : ''}` },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="flex items-center gap-1.5 rounded-md bg-muted/50 border border-border/50 px-2.5 py-1.5 text-xs shrink-0"
            >
              <span className={`font-semibold ${kpi.cls}`}>{kpi.value}</span>
              <span className="text-muted-foreground">{kpi.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-muted/30 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto">
          {COMPLETION_TABS.map((tab) => {
            const active = filter === tab.value;
            const count  = countByFilter[tab.value];
            return (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-background text-foreground shadow-sm border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                }`}
              >
                {tab.label}
                <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums ${
                  active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tAny('wave.productDemand.searchPlaceholder')}
            className="h-7 text-xs w-48"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden">
        {!waveId ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <Waves className="h-8 w-8 opacity-30" />
            <p className="text-sm">{t($ => $.wave.productDemand.noWave)}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t($ => $.wave.loading)}</span>
          </div>
        ) : (
          <UniversalDataGrid<WaveProductDemandItem>
            columns={columns}
            data={filtered}
            rowId={(item) => item.id}
            loading={false}
            columnVisibility={colVis.visibility}
            emptyState={
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Package className="w-8 h-8" />
                <p className="text-sm">
                  {allItems.length === 0
                    ? t($ => $.wave.productDemand.emptyNoDemand)
                    : t($ => $.wave.productDemand.emptyNoMatch)}
                </p>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
