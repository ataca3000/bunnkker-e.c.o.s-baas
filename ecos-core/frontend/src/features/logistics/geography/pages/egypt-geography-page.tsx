import { useCallback, useRef, useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle,
  ChevronRight,
  Globe,
  GripVertical,
  Map,
  MapPin,
  Package,
  Truck,
  XCircle,
} from 'lucide-react';

import { EmptyState, Pagination } from '@/components/crud';
import { WorkspaceHeader }    from '@/components/workspace/header/workspace-header';
import { WorkspacePage }      from '@/components/page/layout/workspace-page';
import { SmartToolbar }       from '@/components/data-grid/smart-toolbar';
import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn }      from '@/lib/utils';
import type { Governorate } from '@/features/logistics/geography/types/geography';
import {
  useGeographyStats,
  useGovernorates,
  useReorderGovernorates,
} from '@/features/logistics/geography/hooks/use-geography';
import { GovernorateDrawer } from '../components/governorate-drawer';

// ── DnD Reorderable Governorates Table ───────────────────────────────────────

type DragState = {
  draggingId: number | null;
  overId: number | null;
};

function GovernoratesTable({
  rows,
  isLoading,
  onRowClick,
}: {
  rows: Governorate[];
  isLoading: boolean;
  onRowClick: (row: Governorate) => void;
}) {
  const { money } = useFormatter();
  const { t } = useTranslation('settings');
  const [order,     setOrder]     = useState<number[]>([]);
  const [dragState, setDragState] = useState<DragState>({ draggingId: null, overId: null });
  const [dirty,     setDirty]     = useState(false);
  const reorder = useReorderGovernorates();

  // Sync external rows into local order when not dragging and not dirty
  const prevRowIds = useRef<string>('');
  const rowIds = rows.map((r) => r.id).join(',');
  if (rowIds !== prevRowIds.current && !dirty) {
    prevRowIds.current = rowIds;
    setOrder(rows.map((r) => r.id));
  }

  const orderedRows = order
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is Governorate => Boolean(r));

  // ── HTML5 Drag handlers ──────────────────────────────────────────────────

  const onDragStart = useCallback((e: React.DragEvent, id: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(id));
    setDragState({ draggingId: id, overId: null });
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState((prev) => prev.overId === id ? prev : { ...prev, overId: id });
  }, []);

  const onDrop = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const sourceId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!sourceId || sourceId === targetId) {
      setDragState({ draggingId: null, overId: null });
      return;
    }

    setOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(sourceId);
      const toIdx   = next.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, sourceId);
      return next;
    });
    setDirty(true);
    setDragState({ draggingId: null, overId: null });
  }, []);

  const onDragEnd = useCallback(() => {
    setDragState({ draggingId: null, overId: null });
  }, []);

  const handleSaveOrder = async () => {
    const items = order.map((id, idx) => ({ id, display_order: idx + 1 }));
    await reorder.mutateAsync(items);
    setDirty(false);
  };

  const handleDiscardOrder = () => {
    setOrder(rows.map((r) => r.id));
    setDirty(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/60">
              <th className="h-10 w-8 px-3" />
              <th className="h-10 w-10 px-3 text-xs font-medium text-muted-foreground text-center">#</th>
              <th className="h-10 px-3 text-xs font-medium text-muted-foreground text-start">{t($ => $.geo.table.arabicName)}</th>
              <th className="h-10 px-3 text-xs font-medium text-muted-foreground text-start">{t($ => $.geo.table.englishName)}</th>
              <th className="h-10 px-3 text-xs font-medium text-muted-foreground text-end">{t($ => $.geo.table.defaultShipping)}</th>
              <th className="h-10 px-3 text-xs font-medium text-muted-foreground text-center">{t($ => $.geo.table.cities)}</th>
              <th className="h-10 px-3 text-xs font-medium text-muted-foreground text-center">{t($ => $.geo.table.status)}</th>
              <th className="h-10 w-10 px-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="px-3 py-2.5"><Skeleton className="h-4 w-4" /></td>
                <td className="px-3 py-2.5 text-center"><Skeleton className="h-4 w-5 mx-auto" /></td>
                <td className="px-3 py-2.5"><Skeleton className="h-4 w-24" /></td>
                <td className="px-3 py-2.5"><Skeleton className="h-4 w-20" /></td>
                <td className="px-3 py-2.5 text-end"><Skeleton className="h-4 w-16 ms-auto" /></td>
                <td className="px-3 py-2.5 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                <td className="px-3 py-2.5"><Skeleton className="h-5 w-14 mx-auto rounded-full" /></td>
                <td className="px-3 py-2.5" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (orderedRows.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <EmptyState icon={Map} title={t($ => $.geo.empty.title)} description={t($ => $.geo.empty.desc)} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {dirty && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <span className="flex-1">{t($ => $.geo.unsavedBanner.message)}</span>
          <Button
            size="sm"
            onClick={handleSaveOrder}
            disabled={reorder.isPending}
            className="h-7 text-xs"
          >
            {reorder.isPending ? t($ => $.geo.saving) : t($ => $.geo.unsavedBanner.save)}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDiscardOrder}
            className="h-7 text-xs"
          >
            {t($ => $.geo.unsavedBanner.discard)}
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/60">
                <th className="h-10 w-8 px-3" aria-label={t($ => $.geo.ariaLabels.dragHandle)} />
                <th className="h-10 w-10 px-3 text-xs font-medium text-muted-foreground text-center">#</th>
                <th className="h-10 px-3 text-xs font-medium text-muted-foreground text-start">{t($ => $.geo.table.arabicName)}</th>
                <th className="h-10 px-3 text-xs font-medium text-muted-foreground text-start">{t($ => $.geo.table.englishName)}</th>
                <th className="h-10 px-3 text-xs font-medium text-muted-foreground text-end">{t($ => $.geo.table.defaultShipping)}</th>
                <th className="h-10 w-16 px-3 text-xs font-medium text-muted-foreground text-center">{t($ => $.geo.table.cities)}</th>
                <th className="h-10 w-24 px-3 text-xs font-medium text-muted-foreground text-center">{t($ => $.geo.table.status)}</th>
                <th className="h-10 w-10 px-3" aria-label={t($ => $.geo.ariaLabels.open)} />
              </tr>
            </thead>
            <tbody className="divide-y">
              {orderedRows.map((row, idx) => {
                const isDragging = dragState.draggingId === row.id;
                const isOver     = dragState.overId === row.id;

                return (
                  <tr
                    key={row.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, row.id)}
                    onDragOver={(e) => onDragOver(e, row.id)}
                    onDrop={(e) => onDrop(e, row.id)}
                    onDragEnd={onDragEnd}
                    className={cn(
                      'group transition-colors hover:bg-accent/40',
                      isDragging && 'opacity-40',
                      isOver && 'border-t-2 border-t-primary',
                    )}
                  >
                    {/* Drag handle */}
                    <td className="w-8 px-3 py-2.5">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                    </td>

                    {/* Display order */}
                    <td className="w-10 px-3 py-2.5 text-center text-muted-foreground tabular-nums text-xs">
                      {idx + 1}
                    </td>

                    {/* Arabic name */}
                    <td className="px-3 py-2.5" dir="rtl">
                      <span className="font-medium">{row.name_ar}</span>
                    </td>

                    {/* English name */}
                    <td className="px-3 py-2.5">
                      <span>{row.name_en}</span>
                      {row.is_system && (
                        <span className="ms-2 text-xs text-muted-foreground">{t($ => $.geo.systemBadge)}</span>
                      )}
                    </td>

                    {/* Default shipping price */}
                    <td className="px-3 py-2.5 text-end tabular-nums">
                      {money(row.default_shipping_price)}
                    </td>

                    {/* Cities count */}
                    <td className="w-16 px-3 py-2.5 text-center tabular-nums">
                      {row.cities_count ?? 0}
                    </td>

                    {/* Status */}
                    <td className="w-24 px-3 py-2.5 text-center">
                      <Badge variant={row.is_active ? 'default' : 'secondary'} className="text-xs">
                        {row.is_active ? t($ => $.geo.status.active) : t($ => $.geo.status.inactive)}
                      </Badge>
                    </td>

                    {/* Open drawer */}
                    <td className="w-10 p-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-full w-full rounded-none py-2.5"
                        onClick={() => onRowClick(row)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function EgyptGeographyPage() {
  const { money } = useFormatter();
  const { t } = useTranslation('settings');
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page,         setPage]         = useState(1);
  const [selectedGov,  setSelectedGov]  = useState<Governorate | null>(null);

  const params = {
    search:   search || undefined,
    status:   statusFilter === 'all' ? undefined : statusFilter,
    page,
    per_page: 27, // Show all 27 govs by default (seed is fixed size)
  };

  const { data: stats }                = useGeographyStats();
  const { data, isFetching, refetch } = useGovernorates(params);

  const governorates = data?.data ?? [];
  const meta         = data?.meta;

  const metrics = [
    {
      id:        'total',
      icon:      Map,
      label:     t($ => $.geo.metrics.total),
      value:     stats?.total_governorates ?? 0,
      isLoading: !stats,
    },
    {
      id:        'active',
      icon:      CheckCircle,
      label:     t($ => $.geo.metrics.active),
      value:     stats?.active_governorates ?? 0,
      colorClass: 'text-emerald-600',
      isLoading:  !stats,
    },
    {
      id:        'cities',
      icon:      MapPin,
      label:     t($ => $.geo.metrics.totalCities),
      value:     stats?.total_cities ?? 0,
      isLoading: !stats,
    },
    {
      id:        'active_cities',
      icon:      Globe,
      label:     t($ => $.geo.metrics.activeCities),
      value:     stats?.active_cities ?? 0,
      colorClass: 'text-blue-600',
      isLoading:  !stats,
    },
    {
      id:        'avg_price',
      icon:      Package,
      label:     t($ => $.geo.metrics.avgShipping),
      value:     stats ? money(stats.avg_shipping_price ?? 0) : '—',
      isLoading: !stats,
    },
    {
      id:        'providers',
      icon:      Truck,
      label:     t($ => $.geo.metrics.providers),
      value:     stats?.shipping_providers ?? 0,
      isLoading: !stats,
    },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t($ => $.geo.breadcrumb.module) }, { label: t($ => $.geo.breadcrumb.page) }]}
        title={t($ => $.geo.pageTitle)}
        description={t($ => $.geo.pageDesc)}
        metrics={metrics}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar onRefresh={() => refetch()} isFetching={isFetching} />
          </div>
        }
        quickFilters={
          <div className="px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2">
            <Input
              placeholder={t($ => $.geo.searchPlaceholder)}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-8 text-sm max-w-xs"
            />
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? 'secondary' : 'ghost'}
                className="h-8 text-xs"
                onClick={() => { setStatusFilter(s); setPage(1); }}
              >
                {s === 'all' ? (
                  t($ => $.geo.filter.all)
                ) : s === 'active' ? (
                  <><CheckCircle className="h-3 w-3 me-1" />{t($ => $.geo.filter.active)}</>
                ) : (
                  <><XCircle className="h-3 w-3 me-1" />{t($ => $.geo.filter.inactive)}</>
                )}
              </Button>
            ))}
          </div>
        }
        pagination={
          meta && meta.last_page > 1 ? (
            <div className="px-4 sm:px-6 pb-4">
              <Pagination
                meta={{
                  page:     meta.current_page,
                  perPage:  meta.per_page,
                  total:    meta.total,
                  lastPage: meta.last_page,
                }}
                onPageChange={setPage}
              />
            </div>
          ) : undefined
        }
      >
        <div className="px-4 sm:px-6">
          <GovernoratesTable
            rows={governorates}
            isLoading={isFetching && governorates.length === 0}
            onRowClick={setSelectedGov}
          />
        </div>
      </WorkspacePage>

      <GovernorateDrawer
        governorate={selectedGov}
        onClose={() => setSelectedGov(null)}
      />
    </>
  );
}
