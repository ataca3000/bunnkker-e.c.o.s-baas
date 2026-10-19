import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Clock, Package, Plus, Route, Truck } from 'lucide-react';

import { Pagination } from '@/components/crud';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePermission } from '@/features/authorization';
import { useOrganizationContext } from '@/features/organization/context/organization-context';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import { TripDrawer } from '../components/trip-drawer';
import { TripFormDrawer } from '../components/trip-form-drawer';
import { TripsTable } from '../components/trips-table';
import { useTripStats, useTrips } from '../hooks/use-trips';
import type { Trip, TripStatus, TripType } from '../types/trip';

type LogisticsLabel = ($: typeof enLogistics) => string;

/**
 * Trip Management — the back-office view of the distribution lifecycle.
 *
 * The status filter has three readings and they are not interchangeable:
 * omitting it hides closed and cancelled trips (the operational default),
 * 'all' includes them, and a concrete status narrows to that one. The default
 * chip is therefore labelled "open trips", not "all".
 */

type StatusFilter = TripStatus | 'all' | 'open';

const QUICK_STATUSES: { key: StatusFilter; label: LogisticsLabel }[] = [
  { key: 'open', label: ($) => $.trips.filters.openOnly },
  { key: 'planning', label: ($) => $.trips.status.planning },
  { key: 'ready_for_dispatch', label: ($) => $.trips.status.ready_for_dispatch },
  { key: 'dispatch_blocked', label: ($) => $.trips.status.dispatch_blocked },
  { key: 'settlement_pending', label: ($) => $.trips.status.settlement_pending },
  { key: 'all', label: ($) => $.trips.filters.all },
];

const TYPE_LABEL: Record<TripType, LogisticsLabel> = {
  company_vehicle: ($) => $.trips.type.company_vehicle,
  personal_vehicle: ($) => $.trips.type.personal_vehicle,
  external_carrier: ($) => $.trips.type.external_carrier,
};

const PER_PAGE = 20;

export function TripsWorkspacePage() {
  const { t } = useTranslation('logistics');
  const { can } = usePermission();
  const { activeCompanyId } = useOrganizationContext();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [type, setType] = useState<TripType | ''>('');
  const [page, setPage] = useState(1);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);

  const stats = useTripStats(activeCompanyId ?? undefined);
  const { data, isFetching, isError, refetch } = useTrips({
    search: search.trim() || undefined,
    // 'open' is the absence of the parameter, not a value the backend knows.
    status: status === 'open' ? undefined : status,
    type: type || undefined,
    per_page: PER_PAGE,
    page,
  });

  const trips = data?.data ?? [];
  const meta = data?.meta;
  const hasFilter = search.trim() !== '' || status !== 'open' || type !== '';

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function openDetail(trip: Trip) {
    setDetailId(trip.id);
    setDetailOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(trip: Trip) {
    setDetailOpen(false);
    setEditing(trip);
    setFormOpen(true);
  }

  const metrics = [
    {
      id: 'total',
      icon: Route,
      label: t(($) => $.trips.stats.total),
      value: stats.data?.total_trips ?? 0,
      isLoading: !stats.data,
    },
    {
      id: 'planning',
      icon: Clock,
      label: t(($) => $.trips.stats.planning),
      value: stats.data?.planning ?? 0,
      isLoading: !stats.data,
    },
    {
      id: 'ready',
      icon: CheckCircle2,
      label: t(($) => $.trips.stats.readyForDispatch),
      value: stats.data?.ready_for_dispatch ?? 0,
      isLoading: !stats.data,
      colorClass: 'text-emerald-600',
    },
    {
      id: 'blocked',
      icon: AlertTriangle,
      label: t(($) => $.trips.stats.dispatchBlocked),
      value: stats.data?.dispatch_blocked ?? 0,
      isLoading: !stats.data,
      colorClass: 'text-destructive',
    },
    {
      id: 'road',
      icon: Truck,
      label: t(($) => $.trips.stats.onTheRoad),
      value: stats.data?.on_the_road ?? 0,
      isLoading: !stats.data,
    },
    {
      id: 'settlement',
      icon: Package,
      label: t(($) => $.trips.stats.settlementPending),
      value: stats.data?.settlement_pending ?? 0,
      isLoading: !stats.data,
      colorClass: 'text-amber-600',
    },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.title) }, { label: t(($) => $.trips.title) }]}
        title={t(($) => $.trips.title)}
        description={t(($) => $.trips.subtitle)}
        metrics={metrics}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar
              primaryAction={
                can('logistics.distribution.create')
                  ? { label: t(($) => $.trips.toolbar.newTrip), icon: Plus, onClick: openCreate }
                  : undefined
              }
              onRefresh={() => void refetch()}
              isFetching={isFetching}
              refreshLabel={t(($) => $.trips.toolbar.refresh)}
            />
          </div>
        }
        quickFilters={
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
            <Input
              placeholder={t(($) => $.trips.toolbar.searchPlaceholder)}
              value={search}
              onChange={(e) => resetPage(setSearch)(e.target.value)}
              className="h-8 max-w-sm text-sm"
            />

            {QUICK_STATUSES.map((option) => (
              <Button
                key={option.key}
                size="sm"
                variant={status === option.key ? 'secondary' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => resetPage(setStatus)(option.key)}
              >
                {t(option.label)}
              </Button>
            ))}

            <span className="mx-1 h-4 w-px bg-border" />

            <select
              value={type}
              onChange={(e) => resetPage(setType)(e.target.value as TripType | '')}
              aria-label={t(($) => $.trips.filters.type)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">{t(($) => $.trips.filters.allTypes)}</option>
              {(Object.keys(TYPE_LABEL) as TripType[]).map((value) => (
                <option key={value} value={value}>
                  {t(TYPE_LABEL[value])}
                </option>
              ))}
            </select>

            {status === 'open' && (
              <span className="text-[11px] text-muted-foreground">
                {t(($) => $.trips.filters.openOnlyNote)}
              </span>
            )}
          </div>
        }
        pagination={
          meta && meta.last_page > 1 ? (
            <div className="px-4 pb-4 sm:px-6">
              <Pagination
                meta={{
                  page: meta.current_page,
                  perPage: meta.per_page,
                  total: meta.total,
                  lastPage: meta.last_page,
                }}
                onPageChange={setPage}
              />
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3 px-4 sm:px-6">
          {isError && (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{t(($) => $.trips.error.title)}</span>
                <Button size="sm" variant="outline" onClick={() => void refetch()}>
                  {t(($) => $.trips.error.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <TripsTable
            rows={trips}
            isLoading={isFetching && trips.length === 0}
            hasFilter={hasFilter}
            onRowClick={openDetail}
            onCreateFirst={can('logistics.distribution.create') ? openCreate : undefined}
          />
        </div>
      </WorkspacePage>

      <TripDrawer
        key={`${detailId ?? 'none'}-${String(detailOpen)}`}
        tripId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={openEdit}
      />

      {/* Remounted per target and per open/close so the form always starts from
          the record it is editing, with no state left over from the last one. */}
      <TripFormDrawer
        key={`${editing?.id ?? 'new'}-${String(formOpen)}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        trip={editing}
      />
    </>
  );
}

export default TripsWorkspacePage;
