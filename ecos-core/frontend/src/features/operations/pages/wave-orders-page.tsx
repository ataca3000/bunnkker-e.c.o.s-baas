import { useMemo, useState } from 'react';
import { Loader2, ShoppingCart, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import { ColumnVisibilityMenu } from '@/components/data-grid/column-visibility-menu';
import { useColumnVisibility } from '@/components/data-grid/use-column-visibility';
import type { DataGridColumnDef } from '@/components/data-grid/types';
import { useWaveOrders, useWaveKpis } from '../hooks/use-preparation';
import { useSelectedWaveId } from '../components/wave-picker';
import type { WaveOrderEntry } from '../types/preparation';

// ── Zone filter tabs ───────────────────────────────────────────────────────────

function ZoneTabs({
  orders,
  zone,
  onZone,
  allZonesLabel,
  unzonedLabel,
}: {
  orders: WaveOrderEntry[];
  zone: string | null;
  onZone: (z: string | null) => void;
  allZonesLabel: string;
  unzonedLabel: string;
}) {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const o of orders) {
    const z = o.delivery_zone_snapshot ?? unzonedLabel;
    counts[z] = (counts[z] ?? 0) + 1;
    total += 1;
  }
  const zones = Object.keys(counts).sort();

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      <button
        onClick={() => onZone(null)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
          zone === null
            ? 'bg-background text-foreground shadow-sm border'
            : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
        }`}
      >
        {allZonesLabel}
        <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums ${
          zone === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}>
          {total}
        </span>
      </button>
      {zones.slice(0, 8).map((z) => (
        <button
          key={z}
          onClick={() => onZone(z)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            zone === z
              ? 'bg-background text-foreground shadow-sm border'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
          }`}
        >
          {z}
          <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums ${
            zone === z ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>
            {counts[z]}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WaveOrdersPage() {
  const { t } = useTranslation('operations');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const waveId = useSelectedWaveId();
  const { data: orders, isLoading, isFetching, refetch } = useWaveOrders(waveId);
  const { data: kpis } = useWaveKpis(waveId);

  const [search, setSearch]         = useState('');
  const [zoneFilter, setZoneFilter] = useState<string | null>(null);

  const columns: DataGridColumnDef<WaveOrderEntry>[] = useMemo(() => [
    {
      key: 'order_number',
      label: t($ => $.wave.orders.columns.orderNo),
      alwaysVisible: true,
      cell: (o) => (
        <span className="font-mono text-sm font-medium">{o.order_number}</span>
      ),
    },
    {
      key: 'customer',
      label: t($ => $.wave.orders.columns.customer),
      defaultVisible: true,
      cell: (o) => (
        <span className="text-sm">
          {o.customer_name_snapshot ?? <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      key: 'delivery_zone',
      label: t($ => $.wave.orders.columns.deliveryZone),
      defaultVisible: true,
      cell: (o) => (
        <span className="text-sm text-muted-foreground">{o.delivery_zone_snapshot ?? '—'}</span>
      ),
    },
    {
      key: 'governorate',
      label: t($ => $.wave.orders.columns.governorate),
      defaultVisible: true,
      cell: (o) => (
        <span className="text-sm text-muted-foreground">{o.governorate_snapshot ?? '—'}</span>
      ),
    },
    {
      key: 'is_paid',
      label: t($ => $.wave.orders.columns.payment),
      defaultVisible: true,
      cell: (o) => (
        o.is_paid
          ? <Badge className="text-xs bg-emerald-100 text-emerald-700">{t($ => $.wave.orders.payment.paid)}</Badge>
          : <Badge className="text-xs bg-gray-100 text-gray-600">{t($ => $.wave.orders.payment.unpaid)}</Badge>
      ),
    },
    {
      key: 'priority',
      label: t($ => $.wave.orders.columns.priority),
      defaultVisible: false,
      align: 'end',
      cell: (o) => (
        <span className="text-xs tabular-nums text-muted-foreground">{o.preparation_priority}</span>
      ),
    },
    {
      key: 'added_at',
      label: t($ => $.wave.orders.columns.addedAt),
      defaultVisible: true,
      cell: (o) => (
        <span className="text-xs text-muted-foreground">
          {new Date(o.added_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
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

  const colVis = useColumnVisibility('wave-orders-cols', colMetas);

  const allOrders = orders ?? [];

  const unzonedLabel = t($ => $.wave.unzoned);

  const filtered = allOrders.filter((o) => {
    if (zoneFilter !== null) {
      const oZone = o.delivery_zone_snapshot ?? unzonedLabel;
      if (oZone !== zoneFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return (
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name_snapshot ?? '').toLowerCase().includes(q) ||
        (o.delivery_zone_snapshot ?? '').toLowerCase().includes(q) ||
        (o.governorate_snapshot ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const ordersCount  = kpis?.orders_count ?? allOrders.length;
  const preparedPct  = kpis?.completion_pct ?? 0;
  const missingCount = kpis?.missing_materials_count ?? 0;
  const uniqueZones  = new Set(allOrders.map((o) => o.delivery_zone_snapshot ?? unzonedLabel)).size;
  const paidCount    = allOrders.filter((o) => o.is_paid).length;

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
      {allOrders.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-background overflow-x-auto shrink-0">
          {[
            { label: t($ => $.wave.orders.kpis.totalOrders),      value: ordersCount,                  cls: '' },
            { label: t($ => $.wave.orders.kpis.deliveryZones),    value: uniqueZones,                  cls: '' },
            { label: t($ => $.wave.orders.kpis.paid),             value: paidCount,                    cls: paidCount > 0 ? 'text-emerald-700' : '' },
            { label: t($ => $.wave.orders.kpis.completion),       value: `${preparedPct.toFixed(1)}%`, cls: preparedPct >= 100 ? 'text-emerald-700' : '' },
            { label: t($ => $.wave.orders.kpis.missingMaterials), value: missingCount,                 cls: missingCount > 0 ? 'text-red-700' : '' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="flex items-center gap-1.5 rounded-md bg-muted/50 border border-border/50 px-2.5 py-1.5 text-xs shrink-0"
            >
              <span className={`font-semibold tabular-nums ${kpi.cls}`}>{kpi.value}</span>
              <span className="text-muted-foreground">{kpi.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-muted/30 flex-wrap">
        <ZoneTabs
          orders={allOrders}
          zone={zoneFilter}
          onZone={setZoneFilter}
          allZonesLabel={t($ => $.wave.orders.allZones)}
          unzonedLabel={unzonedLabel}
        />
        <div className="flex items-center gap-2 shrink-0">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tAny('wave.orders.searchPlaceholder')}
            className="h-7 text-xs w-48"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {!waveId ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <Waves className="h-8 w-8 opacity-30" />
            <p className="text-sm">{t($ => $.wave.orders.noWave)}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t($ => $.wave.loading)}</span>
          </div>
        ) : (
          <UniversalDataGrid<WaveOrderEntry>
            columns={columns}
            data={filtered}
            rowId={(o) => o.id}
            loading={false}
            columnVisibility={colVis.visibility}
            emptyState={
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <ShoppingCart className="w-8 h-8" />
                <p className="text-sm">
                  {allOrders.length === 0
                    ? t($ => $.wave.orders.emptyNoOrders)
                    : t($ => $.wave.orders.emptyNoMatch)}
                </p>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
