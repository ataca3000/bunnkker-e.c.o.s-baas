import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Layers, MapPin, Network as NetworkIcon, PauseCircle } from 'lucide-react';

import { Pagination } from '@/components/crud';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { WorkspacePage } from '@/components/page/layout/workspace-page';

import { CapacityCommitmentsPanel } from '../components/capacity-commitments-panel';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useDispatchRegions, useServiceAreas } from '../hooks/use-network';
import type { ServiceArea, ServiceAreaStatus } from '../types/network';
import { ServiceAreaDrawer } from '../components/service-area-drawer';
import { AreaStatusBadge } from '../components/area-status-badge';
import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/60">
            {['w-40', 'w-24', 'w-28', 'w-32', 'w-24', 'w-10'].map((w, i) => (
              <th key={i} className={`h-10 px-3 ${w}`} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-32" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-5 w-20 rounded-full" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-16" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
              <td className="px-3 py-2.5"><Skeleton className="h-4 w-12" /></td>
              <td className="px-3 py-2.5" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyAreas({ hasFilter }: { hasFilter: boolean }) {
  const { t } = useTranslation('logistics');

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-center">
      <NetworkIcon className="mb-3 size-12 text-muted-foreground/20" />
      <p className="text-sm font-medium">
        {hasFilter ? t($ => $.network.empty.filteredTitle) : t($ => $.network.empty.title)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {hasFilter ? t($ => $.network.empty.filteredHint) : t($ => $.network.empty.hint)}
      </p>
    </div>
  );
}

const STATUS_FILTERS: { key: string; labelKey: LogisticsLabel }[] = [
  { key: 'all', labelKey: ($) => $.common.all },
  { key: 'active', labelKey: ($) => $.common.active },
  { key: 'draft', labelKey: ($) => $.network.areaStatus.draft },
  { key: 'paused', labelKey: ($) => $.network.areaStatus.paused },
  { key: 'closed', labelKey: ($) => $.network.areaStatus.closed },
] as const;

type StatusFilterKey = (typeof STATUS_FILTERS)[number]['key'];

/**
 * Service Areas — the coverage map.
 *
 * The list leads with whether an area actually covers anything: an area with no
 * members silently never matches an address, which is the failure mode worth
 * surfacing rather than discovering at dispatch time.
 */
export function ServiceAreasPage() {
  const { t } = useTranslation('logistics');
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = {
    status: statusFilter === 'all' ? undefined : (statusFilter as ServiceAreaStatus),
    page,
    per_page: 20,
  };

  const { data, isFetching, refetch } = useServiceAreas(params);
  const { data: regions } = useDispatchRegions();

  const areas = data?.data ?? [];
  const meta = data?.meta;
  const hasFilter = statusFilter !== 'all';

  const activeCount = areas.filter((a) => a.status === 'active').length;
  const uncovered = areas.filter((a) => a.member_count === 0).length;

  const metrics = [
    { id: 'areas', icon: NetworkIcon, label: t($ => $.network.metrics.serviceAreas), value: meta?.total ?? 0, isLoading: !data },
    { id: 'active', icon: MapPin, label: t($ => $.common.active), value: activeCount, isLoading: !data, colorClass: 'text-emerald-600' },
    { id: 'regions', icon: Layers, label: t($ => $.network.metrics.dispatchRegions), value: regions?.length ?? 0, isLoading: !regions },
    // An area with no members never matches an address — worth surfacing.
    { id: 'uncovered', icon: PauseCircle, label: t($ => $.network.metrics.withoutCoverage), value: uncovered, isLoading: !data, colorClass: 'text-amber-600' },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t($ => $.network.breadcrumbRoot) }, { label: t($ => $.network.breadcrumbNetwork) }]}
        title={t($ => $.network.title)}
        description={t($ => $.network.description)}
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
            {STATUS_FILTERS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={statusFilter === s.key ? 'secondary' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => {
                  setStatusFilter(s.key);
                  setPage(1);
                }}
              >
                {t(s.labelKey)}
              </Button>
            ))}
          </div>
        }
      >
        <div className="space-y-3 px-4 pb-6 sm:px-6">
          {isFetching && !data ? (
            <TableSkeleton />
          ) : areas.length === 0 ? (
            <EmptyAreas hasFilter={hasFilter} />
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/60 text-start text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="h-10 px-3 font-medium">{t($ => $.network.table.area)}</th>
                    <th className="h-10 px-3 font-medium">{t($ => $.common.status)}</th>
                    <th className="h-10 px-3 text-center font-medium">{t($ => $.network.table.members)}</th>
                    <th className="h-10 px-3 font-medium">{t($ => $.network.area.dispatchRegion)}</th>
                    <th className="h-10 px-3 text-end font-medium">{t($ => $.network.area.leadTime)}</th>
                    <th className="h-10 w-10 px-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {areas.map((area: ServiceArea) => (
                    <tr
                      key={area.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => {
                        setSelectedId(area.id);
                        setDrawerOpen(true);
                      }}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{area.name}</div>
                        <div className="text-xs text-muted-foreground">{area.code}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <AreaStatusBadge status={area.status} />
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        {area.member_count === 0 ? (
                          <span className="text-amber-600" title={t($ => $.network.table.noCoverageTooltip)}>
                            0
                          </span>
                        ) : (
                          area.member_count
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {area.dispatch_region?.name ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums">
                        {t($ => $.network.hoursShort, { hours: area.default_lead_time_hours })}
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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

          <CapacityCommitmentsPanel />
        </div>
      </WorkspacePage>

      <ServiceAreaDrawer areaId={selectedId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
