import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Gauge,
  Truck,
  Wrench,
  XCircle,
} from 'lucide-react';

import { Pagination } from '@/components/crud';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useFleetStats, useFleetUnits } from '../hooks/use-fleet';
import type { FleetUnit, FleetUnitLifecycle } from '../types/fleet';
import { FleetUnitDrawer } from '../components/fleet-unit-drawer';
import { BlockerList } from '../components/blocker-list';
import { FitnessBadge, LifecycleBadge } from '../components/fitness-badge';
import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

// ── Skeleton and empty state ─────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/60">
            {['w-32', 'w-28', 'w-24', 'w-64', 'w-28', 'w-10'].map((w, i) => (
              <th key={i} className={`h-10 px-3 ${w}`} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i}>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-5 w-16 rounded-full" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-48" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-20" /></td>
              <td className="px-3 py-2.5" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyUnits({ hasFilter }: { hasFilter: boolean }) {
  const { t } = useTranslation('logistics');

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
      <Truck className="mb-3 size-12 text-muted-foreground/20" />
      <p className="text-sm font-medium">
        {hasFilter ? t($ => $.fleet.empty.filteredTitle) : t($ => $.fleet.empty.title)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasFilter ? t($ => $.fleet.empty.filteredHint) : t($ => $.fleet.empty.hint)}
      </p>
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

function UnitsTable({
  rows,
  isLoading,
  hasFilter,
  onRowClick,
}: {
  rows: FleetUnit[];
  isLoading: boolean;
  hasFilter: boolean;
  onRowClick: (unit: FleetUnit) => void;
}) {
  const { t } = useTranslation('logistics');

  if (isLoading) return <TableSkeleton />;
  if (rows.length === 0) return <EmptyUnits hasFilter={hasFilter} />;

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/60 text-start text-xs uppercase tracking-wide text-muted-foreground">
            <th className="h-10 px-3 font-medium">{t($ => $.common.vehicle)}</th>
            <th className="h-10 px-3 font-medium">{t($ => $.fleet.table.fitness)}</th>
            <th className="h-10 px-3 font-medium">{t($ => $.fleet.table.lifecycle)}</th>
            <th className="h-10 px-3 font-medium">{t($ => $.fleet.table.why)}</th>
            <th className="h-10 px-3 text-end font-medium">{t($ => $.fleet.table.odometer)}</th>
            <th className="h-10 w-10 px-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((unit) => (
            <tr
              key={unit.id}
              className="cursor-pointer align-top hover:bg-muted/40"
              onClick={() => onRowClick(unit)}
            >
              <td className="px-3 py-2.5">
                <div className="font-medium">{unit.vehicle?.plate_number ?? '—'}</div>
                <div className="text-xs text-muted-foreground">
                  {unit.vehicle?.vehicle_code ?? ''}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <FitnessBadge level={unit.fitness.level} />
              </td>
              <td className="px-3 py-2.5">
                <LifecycleBadge state={unit.lifecycle_state} />
              </td>
              <td className="max-w-md px-3 py-2.5">
                {/* Every refusal explains itself in place — no second call. */}
                <BlockerList verdict={unit.fitness} compact />
              </td>
              <td className="px-3 py-2.5 text-end tabular-nums">
                {unit.current_odometer_km !== null
                  ? t($ => $.fleet.kmValue, { value: unit.current_odometer_km.toLocaleString() })
                  : '—'}
              </td>
              <td className="px-3 py-2.5 text-end">
                <ChevronRight className="size-4 text-muted-foreground" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const STATE_FILTERS: {
  key: 'open' | 'all' | 'active' | 'commissioning' | 'suspended' | 'retired';
  labelKey: LogisticsLabel;
}[] = [
  { key: 'open', labelKey: ($) => $.fleet.filters.inService },
  { key: 'all', labelKey: ($) => $.common.all },
  { key: 'active', labelKey: ($) => $.common.active },
  { key: 'commissioning', labelKey: ($) => $.fleet.lifecycle.commissioning },
  { key: 'suspended', labelKey: ($) => $.fleet.lifecycle.suspended },
  { key: 'retired', labelKey: ($) => $.fleet.lifecycle.retired },
];

type StateFilterKey = (typeof STATE_FILTERS)[number]['key'];

/**
 * Fleet Dashboard.
 *
 * Exception-first, like LOG-005's Delivery Command Center: the default view
 * hides retired units and leads with what is blocking a vehicle from going out.
 */
export function FleetDashboardPage() {
  const { t } = useTranslation('logistics');
  const [stateFilter, setStateFilter] = useState<StateFilterKey>('open');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = {
    // 'open' is the API default (retired excluded), so it sends no state.
    lifecycle_state:
      stateFilter === 'open'
        ? undefined
        : stateFilter === 'all'
          ? ('all' as const)
          : (stateFilter as FleetUnitLifecycle),
    has_critical_defect: criticalOnly || undefined,
    page,
    per_page: 20,
  };

  const { data: stats } = useFleetStats();
  const { data, isFetching, refetch } = useFleetUnits(params);

  const units = data?.data ?? [];
  const meta = data?.meta;
  const hasFilter = stateFilter !== 'open' || criticalOnly;

  const metrics = [
    { id: 'active', icon: CheckCircle, label: t($ => $.common.active), value: stats?.active ?? 0, isLoading: !stats, colorClass: 'text-emerald-600' },
    { id: 'critical', icon: XCircle, label: t($ => $.fleet.metrics.criticalDefects), value: stats?.open_critical_defects ?? 0, isLoading: !stats, colorClass: 'text-destructive' },
    { id: 'overdue', icon: AlertTriangle, label: t($ => $.fleet.metrics.overdueMaintenance), value: stats?.overdue_maintenance ?? 0, isLoading: !stats, colorClass: 'text-amber-600' },
    { id: 'work', icon: Wrench, label: t($ => $.fleet.metrics.openWorkOrders), value: stats?.open_work_orders ?? 0, isLoading: !stats },
    { id: 'suspended', icon: Truck, label: t($ => $.fleet.lifecycle.suspended), value: stats?.suspended ?? 0, isLoading: !stats },
    // Distance is the denominator of most cost metrics — silence is a signal.
    { id: 'stale', icon: Gauge, label: t($ => $.fleet.metrics.staleOdometer), value: stats?.stale_odometer ?? 0, isLoading: !stats, colorClass: 'text-amber-600' },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t($ => $.fleet.breadcrumbRoot) }, { label: t($ => $.fleet.breadcrumbFleet) }]}
        title={t($ => $.fleet.title)}
        description={t($ => $.fleet.description)}
        metrics={metrics}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar onRefresh={() => refetch()} isFetching={isFetching} />
          </div>
        }
        quickFilters={
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
            {STATE_FILTERS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={stateFilter === s.key ? 'secondary' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => {
                  setStateFilter(s.key);
                  setPage(1);
                }}
              >
                {t(s.labelKey)}
              </Button>
            ))}

            <span className="mx-1 h-4 w-px bg-border" />

            <Button
              size="sm"
              variant={criticalOnly ? 'secondary' : 'ghost'}
              className="h-8 gap-1 text-xs"
              onClick={() => {
                setCriticalOnly(!criticalOnly);
                setPage(1);
              }}
            >
              <XCircle className="size-3" />
              {t($ => $.fleet.filters.criticalDefects)}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 px-4 pb-6 sm:px-6">
          <UnitsTable
            rows={units}
            isLoading={isFetching && !data}
            hasFilter={hasFilter}
            onRowClick={(unit) => {
              setSelectedId(unit.id);
              setDrawerOpen(true);
            }}
          />

          {meta && meta.total > 0 && (
            <Pagination
              meta={{
                page: meta.current_page,
                perPage: meta.per_page,
                total: meta.total,
                lastPage: meta.last_page,
              }}
              onPageChange={setPage}
            />
          )}
        </div>
      </WorkspacePage>

      <FleetUnitDrawer unitId={selectedId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
