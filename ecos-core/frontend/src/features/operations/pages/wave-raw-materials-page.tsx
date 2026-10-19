import { useMemo, useState } from 'react';
import { AlertTriangle, FlaskConical, Loader2, Waves } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import { ColumnVisibilityMenu } from '@/components/data-grid/column-visibility-menu';
import { useColumnVisibility } from '@/components/data-grid/use-column-visibility';
import type { DataGridColumnDef } from '@/components/data-grid/types';
import { useWaveMaterialDemand } from '../hooks/use-preparation';
import { useSelectedWaveId } from '../components/wave-picker';
import type { WaveMaterialDemandItem } from '../types/preparation';

type ShortageFilter = 'all' | 'shortage' | 'ok';

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WaveRawMaterialsPage() {
  const { t } = useTranslation('operations');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const waveId = useSelectedWaveId();
  const { data: materials, isLoading, isFetching, refetch } = useWaveMaterialDemand(waveId);

  const [search, setSearch]                 = useState('');
  const [shortageFilter, setShortageFilter] = useState<ShortageFilter>('all');

  const SHORTAGE_TABS: Array<{ value: ShortageFilter; label: string }> = [
    { value: 'all',      label: t($ => $.wave.rawMaterials.filters.all) },
    { value: 'shortage', label: t($ => $.wave.rawMaterials.filters.shortage) },
    { value: 'ok',       label: t($ => $.wave.rawMaterials.filters.ok) },
  ];

  const columns: DataGridColumnDef<WaveMaterialDemandItem>[] = useMemo(() => [
    {
      key: 'material',
      label: t($ => $.wave.rawMaterials.columns.material),
      alwaysVisible: true,
      cell: (m) => (
        <div>
          <div className="text-sm font-medium">{m.material_name}</div>
          {m.material_sku && (
            <div className="text-[10px] text-muted-foreground font-mono">{m.material_sku}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: t($ => $.wave.rawMaterials.columns.status),
      alwaysVisible: true,
      cell: (m) => {
        if (m.missing_qty > 0) {
          return (
            <Badge className="text-xs bg-red-100 text-red-700 flex items-center gap-1 w-fit">
              <AlertTriangle className="h-3 w-3" />
              {t($ => $.wave.rawMaterials.statusShortage)}
            </Badge>
          );
        }
        return <Badge className="text-xs bg-green-100 text-green-700">{t($ => $.wave.rawMaterials.statusSufficient)}</Badge>;
      },
    },
    {
      key: 'required_qty',
      label: t($ => $.wave.rawMaterials.columns.required),
      defaultVisible: true,
      align: 'end',
      cell: (m) => <span className="text-sm tabular-nums">{fmt(m.required_qty)}</span>,
    },
    {
      key: 'available_qty',
      label: t($ => $.wave.rawMaterials.columns.available),
      defaultVisible: true,
      align: 'end',
      cell: (m) => (
        <span className={`text-sm tabular-nums ${m.missing_qty > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
          {fmt(m.available_qty)}
        </span>
      ),
    },
    {
      key: 'missing_qty',
      label: t($ => $.wave.rawMaterials.columns.missing),
      defaultVisible: true,
      align: 'end',
      cell: (m) => (
        m.missing_qty > 0 ? (
          <span className="text-sm tabular-nums text-red-700 font-medium">{fmt(m.missing_qty)}</span>
        ) : (
          <span className="text-sm tabular-nums text-muted-foreground">—</span>
        )
      ),
    },
    {
      key: 'expected_today',
      label: t($ => $.wave.rawMaterials.columns.expectedToday),
      defaultVisible: true,
      align: 'end',
      cell: (m) => (
        m.expected_today > 0 ? (
          <span className="text-sm tabular-nums text-blue-700">{fmt(m.expected_today)}</span>
        ) : (
          <span className="text-sm tabular-nums text-muted-foreground">—</span>
        )
      ),
    },
    {
      key: 'in_transit_qty',
      label: t($ => $.wave.rawMaterials.columns.inTransit),
      defaultVisible: true,
      align: 'end',
      cell: (m) => (
        m.in_transit_qty > 0 ? (
          <span className="text-sm tabular-nums text-indigo-700">{fmt(m.in_transit_qty)}</span>
        ) : (
          <span className="text-sm tabular-nums text-muted-foreground">—</span>
        )
      ),
    },
    {
      key: 'coverage_pct',
      label: t($ => $.wave.rawMaterials.columns.coverage),
      defaultVisible: false,
      align: 'end',
      cell: (m) => (
        <span className={`text-sm tabular-nums ${m.coverage_pct >= 100 ? 'text-emerald-700' : 'text-amber-700'}`}>
          {m.coverage_pct.toFixed(1)}%
        </span>
      ),
    },
    {
      key: 'reserved_qty',
      label: t($ => $.wave.rawMaterials.columns.reserved),
      defaultVisible: false,
      align: 'end',
      cell: (m) => (
        m.reserved_qty > 0 ? (
          <span className="text-sm tabular-nums text-muted-foreground">{fmt(m.reserved_qty)}</span>
        ) : (
          <span className="text-sm tabular-nums text-muted-foreground">—</span>
        )
      ),
    },
   
  ], [t]);

  const colMetas = useMemo(() => columns.map((c) => ({
    key: c.key,
    label: c.label,
    alwaysVisible: c.alwaysVisible,
    defaultVisible: c.defaultVisible,
  })), [columns]);

  const colVis = useColumnVisibility('wave-raw-materials-cols', colMetas);

  const allMaterials = materials ?? [];

  const countByFilter: Record<ShortageFilter, number> = {
    all:      allMaterials.length,
    shortage: allMaterials.filter((m) => m.missing_qty > 0).length,
    ok:       allMaterials.filter((m) => m.missing_qty === 0).length,
  };

  const filtered = allMaterials.filter((m) => {
    switch (shortageFilter) {
      case 'shortage': if (m.missing_qty === 0) return false; break;
      case 'ok':       if (m.missing_qty > 0) return false; break;
    }
    if (search) {
      return m.material_name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

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

      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-muted/30 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto">
          {SHORTAGE_TABS.map((tab) => {
            const active = shortageFilter === tab.value;
            const count  = countByFilter[tab.value];
            return (
              <button
                key={tab.value}
                onClick={() => setShortageFilter(tab.value)}
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
            placeholder={tAny('wave.rawMaterials.searchPlaceholder')}
            className="h-7 text-xs w-44"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {!waveId ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <Waves className="h-8 w-8 opacity-30" />
            <p className="text-sm">{t($ => $.wave.rawMaterials.noWave)}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t($ => $.wave.loading)}</span>
          </div>
        ) : (
          <UniversalDataGrid<WaveMaterialDemandItem>
            columns={columns}
            data={filtered}
            rowId={(m) => m.id}
            loading={false}
            columnVisibility={colVis.visibility}
            emptyState={
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <FlaskConical className="w-8 h-8" />
                <p className="text-sm">
                  {allMaterials.length === 0
                    ? t($ => $.wave.rawMaterials.emptyNoDemand)
                    : t($ => $.wave.rawMaterials.emptyNoMatch)}
                </p>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
