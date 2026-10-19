import { useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, PackageX, Waves } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { UniversalDataGrid } from '@/components/data-grid/universal-data-grid';
import type { DataGridColumnDef } from '@/components/data-grid/types';
import { ROUTES } from '@/router/routes';
import { useWaveMissingMaterials } from '../hooks/use-preparation';
import { useSelectedWaveId } from '../components/wave-picker';
import type { WaveMissingMaterialItem } from '../types/preparation';

type PriorityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

const PRIORITY_COLORS: Record<WaveMissingMaterialItem['priority'], string> = {
  critical: 'bg-red-100 text-red-800',
  high:     'bg-amber-100 text-amber-700',
  medium:   'bg-yellow-100 text-yellow-700',
  low:      'bg-gray-100 text-gray-600',
};

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function WaveMissingMaterialsPage() {
  const { t } = useTranslation('operations');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const waveId   = useSelectedWaveId();
  const navigate = useNavigate();
  const { data: missing, isLoading, isFetching, refetch } = useWaveMissingMaterials(waveId);

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  const PRIORITY_TABS: Array<{ value: PriorityFilter; label: string }> = [
    { value: 'all',      label: t($ => $.wave.missingMaterials.filters.all) },
    { value: 'critical', label: t($ => $.wave.missingMaterials.filters.critical) },
    { value: 'high',     label: t($ => $.wave.missingMaterials.filters.high) },
    { value: 'medium',   label: t($ => $.wave.missingMaterials.filters.medium) },
    { value: 'low',      label: t($ => $.wave.missingMaterials.filters.low) },
  ];

  const columns: DataGridColumnDef<WaveMissingMaterialItem>[] = useMemo(() => [
    {
      key: 'material',
      label: t($ => $.wave.missingMaterials.columns.material),
      alwaysVisible: true,
      cell: (m) => (
        <div className="text-sm font-medium text-red-900">{m.material_name}</div>
      ),
    },
    {
      key: 'priority',
      label: t($ => $.wave.missingMaterials.columns.priority),
      alwaysVisible: true,
      cell: (m) => (
        <Badge className={`text-xs ${PRIORITY_COLORS[m.priority]}`}>
          {tAny(`wave.missingMaterials.priority.${m.priority}`)}
        </Badge>
      ),
    },
    {
      key: 'missing_qty',
      label: t($ => $.wave.missingMaterials.columns.missingQty),
      defaultVisible: true,
      align: 'end',
      cell: (m) => (
        <span className="text-sm tabular-nums font-semibold text-red-700">{fmt(m.missing_qty)}</span>
      ),
    },
    {
      key: 'affected_orders_count',
      label: t($ => $.wave.missingMaterials.columns.affectedOrders),
      defaultVisible: true,
      align: 'end',
      cell: (m) => (
        <span className="text-sm tabular-nums text-muted-foreground">{m.affected_orders_count}</span>
      ),
    },
    {
      key: 'procurement_status',
      label: t($ => $.wave.missingMaterials.columns.procurement),
      defaultVisible: true,
      cell: (m) => (
        m.procurement_status ? (
          <span className="text-xs text-muted-foreground">{m.procurement_status}</span>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )
      ),
    },
    {
      key: 'action',
      label: t($ => $.wave.missingMaterials.columns.action),
      alwaysVisible: true,
      align: 'end',
      cell: () => (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
          onClick={(e) => { e.stopPropagation(); void navigate(ROUTES.procurementHub); }}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          {t($ => $.wave.missingMaterials.openProcurementQueue)}
        </Button>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t, navigate]);

  const allMissing = missing ?? [];

  const countByPriority: Record<PriorityFilter, number> = {
    all:      allMissing.length,
    critical: allMissing.filter((m) => m.priority === 'critical').length,
    high:     allMissing.filter((m) => m.priority === 'high').length,
    medium:   allMissing.filter((m) => m.priority === 'medium').length,
    low:      allMissing.filter((m) => m.priority === 'low').length,
  };

  const filtered = priorityFilter === 'all'
    ? allMissing
    : allMissing.filter((m) => m.priority === priorityFilter);

  return (
    <div className="flex flex-col h-full">
      <SmartToolbar
        onRefresh={() => void refetch()}
        isFetching={isFetching}
      />

      <div className="flex items-center gap-3 px-4 py-2 border-b bg-red-50/40 flex-wrap overflow-x-auto">
        {PRIORITY_TABS.map((tab) => {
          const active = priorityFilter === tab.value;
          const count  = countByPriority[tab.value];
          return (
            <button
              key={tab.value}
              onClick={() => setPriorityFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-background text-foreground shadow-sm border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
              }`}
            >
              {tab.label}
              <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] tabular-nums ${
                active ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {!waveId ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <Waves className="h-8 w-8 opacity-30" />
            <p className="text-sm">{t($ => $.wave.missingMaterials.noWave)}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">{t($ => $.wave.loading)}</span>
          </div>
        ) : (
          <UniversalDataGrid<WaveMissingMaterialItem>
            columns={columns}
            data={filtered}
            rowId={(m) => m.id}
            loading={false}
            emptyState={
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                <PackageX className="w-8 h-8" />
                <p className="text-sm font-medium">
                  {allMissing.length === 0
                    ? t($ => $.wave.missingMaterials.emptyAllMet)
                    : t($ => $.wave.missingMaterials.emptyPriorityFilter)}
                </p>
                {allMissing.length === 0 && (
                  <p className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    {t($ => $.wave.missingMaterials.shortagesNote)}
                  </p>
                )}
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
