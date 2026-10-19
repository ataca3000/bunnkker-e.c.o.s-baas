import { useFormatter } from '@/hooks/use-formatter';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  LayoutGrid,
  List,
  ListOrdered,
  Map,
  Package,
  Phone,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { SmartToolbar }   from '@/components/data-grid/smart-toolbar';
import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useToast } from '@/components/ds/use-toast';

import {
  useMarkPlanned,
  usePlanningStats,
  usePlanningUnassigned,
  usePlanningZones,
  useStartPlanning,
} from '../hooks/use-distribution-planning';
import { ZonePlanningCard, ZonePlanningCardSkeleton } from '../components/zone-planning-card';
import { ZoneDetailDrawer }  from '../components/zone-detail-drawer';
import type {
  PlanningFilters,
  UnassignedOrder,
  ZoneDetailTab,
  ZonePlanCard,
  ZonePlanningStatus,
} from '../types/distribution-planning';
import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. Indexing this table by a runtime value is
 * still fine — the lookup yields a selector, which is what t() expects.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayString() {
  return new Date().toISOString().split('T')[0];
}

function fmt(n: number) {
  return n.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type ViewMode = 'card' | 'table';
type SortKey =
  | 'name_ar'
  | 'orders_count'
  | 'customers_count'
  | 'distinct_products'
  | 'estimated_stops'
  | 'total_collection'
  | 'planning_status';

const STATUS_SORT_ORDER: Record<ZonePlanningStatus, number> = {
  ready:       0,
  in_planning: 1,
  planned:     2,
};

function enterpriseSorted(zones: ZonePlanCard[]): ZonePlanCard[] {
  return [...zones].sort((a, b) => {
    const statusDiff = STATUS_SORT_ORDER[a.planning_status] - STATUS_SORT_ORDER[b.planning_status];
    if (statusDiff !== 0) return statusDiff;
    return b.orders_count - a.orders_count;
  });
}

function tableSorted(
  zones: ZonePlanCard[],
  sortBy: SortKey,
  sortDir: 'asc' | 'desc',
): ZonePlanCard[] {
  const mult = sortDir === 'asc' ? 1 : -1;
  return [...zones].sort((a, b) => {
    const aV = a[sortBy];
    const bV = b[sortBy];
    if (typeof aV === 'number' && typeof bV === 'number') return mult * (aV - bV);
    if (typeof aV === 'string' && typeof bV === 'string') {
      if (sortBy === 'planning_status') {
        return (
          mult *
          (STATUS_SORT_ORDER[aV as ZonePlanningStatus] -
            STATUS_SORT_ORDER[bV as ZonePlanningStatus])
        );
      }
      return mult * aV.localeCompare(bV, 'ar');
    }
    return 0;
  });
}

function getViewMode(): ViewMode {
  const stored = localStorage.getItem('dist-planning-view');
  return stored === 'table' ? 'table' : 'card';
}

// ── Missing reason badge ──────────────────────────────────────────────────────

/** Raw API reason value → translation key. Falls back to the raw value. */
const MISSING_REASON_KEYS: Record<string, LogisticsLabel> = {
  'Missing city':                 ($) => $.planning.missingReason.missingCity,
  'Unknown city':                 ($) => $.planning.missingReason.unknownCity,
  'City not assigned to a zone':  ($) => $.planning.missingReason.cityNotAssigned,
};

function MissingReasonBadge({ reason }: { reason: string }) {
  const { t } = useTranslation('logistics');
  const color =
    reason === 'Missing city'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : reason === 'Unknown city'
        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';

  const key = MISSING_REASON_KEYS[reason];

  return (
    <Badge className={`text-[10px] font-normal ${color}`}>{key ? t(key) : reason}</Badge>
  );
}

// ── Unassigned panel ──────────────────────────────────────────────────────────

function UnassignedPanel({
  orders,
  isLoading,
}: {
  orders: UnassignedOrder[];
  isLoading: boolean;
}) {
  const { t } = useTranslation('logistics');
  const { money } = useFormatter();

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-700/40 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 dark:border-amber-700/40">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {t($ => $.planning.unassigned.title)}
        </h3>
        <p className="text-xs text-amber-600 dark:text-amber-400 ms-1">
          {t($ => $.planning.unassigned.hint)}
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground px-4 py-3">{t($ => $.common.loading)}</p>
      ) : !orders.length ? (
        <p className="text-xs text-muted-foreground px-4 py-3">
          {t($ => $.planning.unassigned.empty)}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-amber-200 dark:border-amber-700/40 text-muted-foreground">
                <th className="text-start py-2 px-4 font-medium">{t($ => $.planning.unassigned.colOrderNumber)}</th>
                <th className="text-start py-2 px-3 font-medium">{t($ => $.planning.unassigned.colCustomer)}</th>
                <th className="text-start py-2 px-3 font-medium">{t($ => $.common.phone)}</th>
                <th className="text-start py-2 px-3 font-medium">{t($ => $.common.city)}</th>
                <th className="text-start py-2 px-3 font-medium">{t($ => $.planning.unassigned.colReason)}</th>
                <th className="text-end py-2 px-3 font-medium">{t($ => $.common.total)}</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-amber-100 dark:border-amber-800/20 hover:bg-amber-100/40 dark:hover:bg-amber-900/10 transition-colors"
                >
                  <td className="py-2 px-4 font-mono">{o.order_number}</td>
                  <td className="py-2 px-3">{o.customer_name ?? '—'}</td>
                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                    {o.billing_phone ? (
                      <span className="flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />
                        {o.billing_phone}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">{o.city ?? '—'}</td>
                  <td className="py-2 px-3">
                    <MissingReasonBadge reason={o.missing_reason} />
                  </td>
                  <td className="py-2 px-3 text-end tabular-nums font-medium">
                    {money(o.total)}
                  </td>
                  <td className="py-2 px-3">
                    <Link
                      to={`/orders/${o.id}`}
                      target="_blank"
                      className="text-primary hover:underline flex items-center gap-0.5 whitespace-nowrap"
                    >
                      {t($ => $.planning.unassigned.open)}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Sort header (table view) ──────────────────────────────────────────────────

function SortTh({
  label,
  col,
  sortBy,
  sortDir,
  onSort,
  align = 'start',
}: {
  label: string;
  col: SortKey | null;
  sortBy: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (col: SortKey) => void;
  align?: 'start' | 'end';
}) {
  const active = col !== null && sortBy === col;
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      className={`py-2 px-3 font-medium whitespace-nowrap ${
        align === 'end' ? 'text-end' : 'text-start'
      } ${col ? 'cursor-pointer select-none hover:text-foreground' : ''}`}
      onClick={col ? () => onSort(col) : undefined}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'end' ? 'justify-end' : ''}`}>
        {label}
        {col && (
          <Icon className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-30'}`} />
        )}
      </span>
    </th>
  );
}

// ── Start Planning confirmation dialog ────────────────────────────────────────

function StartPlanningDialog({
  zone,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  zone: ZonePlanCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('logistics');
  const { money } = useFormatter();

  if (!zone) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t($ => $.planning.dialog.startTitle, { name: zone.name_ar })}
          </DialogTitle>
          <DialogDescription>
            {t($ => $.planning.dialog.startDescription)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {zone.color && (
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: zone.color }}
              />
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                {zone.code}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4">
            <div>
              <p className="text-xs text-muted-foreground">{t($ => $.planning.metrics.orders)}</p>
              <p className="text-xl font-bold tabular-nums">{zone.orders_count}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t($ => $.planning.metrics.customers)}</p>
              <p className="text-xl font-bold tabular-nums">{zone.customers_count}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t($ => $.planning.metrics.products)}</p>
              <p className="text-xl font-bold tabular-nums">{zone.distinct_products}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t($ => $.planning.metrics.estimatedStops)}</p>
              <p className="text-xl font-bold tabular-nums">{zone.estimated_stops}</p>
            </div>
            <div className="col-span-2 border-t pt-2">
              <p className="text-xs text-muted-foreground">
                {t($ => $.planning.metrics.expectedCollection)}
              </p>
              <p className="text-lg font-bold tabular-nums">{money(zone.total_collection)}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t($ => $.common.cancel)}
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? t($ => $.planning.dialog.starting) : t($ => $.planning.actions.startPlanning)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DistributionPlanningPage() {
  const { toast } = useToast();
  const { t } = useTranslation('logistics');
  const { money } = useFormatter();

  // ── View state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewMode>(getViewMode);

  function toggleView(v: ViewMode) {
    setView(v);
    localStorage.setItem('dist-planning-view', v);
  }

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [date,         setDate]       = useState<string>(todayString());
  const [statusFilter, setStatus]     = useState<ZonePlanningStatus | 'all'>('all');
  const [search,       setSearch]     = useState('');
  const [showEmpty,    setShowEmpty]  = useState(false);

  const filters: PlanningFilters = {
    date:       date || undefined,
    status:     statusFilter !== 'all' ? statusFilter : undefined,
    search:     search || undefined,
    show_empty: showEmpty,
  };

  // ── Table sort state ────────────────────────────────────────────────────────
  const [sortBy,  setSortBy]  = useState<SortKey>('orders_count');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(col: SortKey) {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  }

  // ── Drawer state ────────────────────────────────────────────────────────────
  const [detailOpen,  setDetailOpen]  = useState(false);
  const [activeZone,  setActiveZone]  = useState<ZonePlanCard | null>(null);
  const [activeTab,   setActiveTab]   = useState<ZoneDetailTab>('orders');

  // ── Workspace state ─────────────────────────────────────────────────────────
  const [workspaceZone, setWorkspaceZone] = useState<ZonePlanCard | null>(null);

  // ── Confirmation dialog ─────────────────────────────────────────────────────
  const [confirmZone, setConfirmZone] = useState<ZonePlanCard | null>(null);

  // ── Unassigned panel ────────────────────────────────────────────────────────
  const [unassignedOpen, setUnassignedOpen] = useState(false);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const {
    data: stats,
    isLoading: statsLoading,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = usePlanningStats({ date: date || undefined });

  const {
    data: rawZones = [],
    isLoading: zonesLoading,
    isFetching: zonesFetching,
    refetch: refetchZones,
  } = usePlanningZones(filters);

  const { data: unassigned = [], isLoading: unassignedLoading } =
    usePlanningUnassigned({ date: date || undefined }, unassignedOpen);

  const isFetching = statsFetching || zonesFetching;

  // ── Processed zones ─────────────────────────────────────────────────────────
  const zones = useMemo<ZonePlanCard[]>(() => {
    if (view === 'table') return tableSorted(rawZones, sortBy, sortDir);
    return enterpriseSorted(rawZones);
  }, [rawZones, view, sortBy, sortDir]);

  // ── Planning Progress KPIs (computed from zones list) ───────────────────────
  const planningKpis = useMemo(() => {
    const active = rawZones.filter((z) => z.orders_count > 0);
    return {
      ready:       active.filter((z) => z.planning_status === 'ready').length,
      in_planning: active.filter((z) => z.planning_status === 'in_planning').length,
      planned:     active.filter((z) => z.planning_status === 'planned').length,
      ready_orders: stats?.ready_orders ?? 0,
    };
  }, [rawZones, stats]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const startMutation = useStartPlanning(filters);
  const markMutation  = useMarkPlanned(filters);

  function handleRefresh() {
    void refetchStats();
    void refetchZones();
  }

  function openDetail(zone: ZonePlanCard, tab: ZoneDetailTab = 'orders') {
    setActiveZone(zone);
    setActiveTab(tab);
    setDetailOpen(true);
  }

  function handlePrimaryAction(zone: ZonePlanCard) {
    if (zone.planning_status === 'ready') {
      setConfirmZone(zone);
    } else if (zone.planning_status === 'in_planning') {
      setWorkspaceZone(zone);
    }
    // planned → button is disabled on card / "View Plan" row action
  }

  async function handleConfirmStart() {
    if (!confirmZone) return;
    try {
      await startMutation.mutateAsync({ zoneId: confirmZone.zone_id, date: date || undefined });
      toast({ title: t($ => $.planning.toast.started, { name: confirmZone.name_ar }) });
      setWorkspaceZone({ ...confirmZone, planning_status: 'in_planning' });
      setConfirmZone(null);
    } catch {
      toast({ title: t($ => $.planning.toast.startFailed), variant: 'destructive' });
    }
  }

  async function handleMarkPlanned() {
    if (!workspaceZone) return;
    try {
      await markMutation.mutateAsync({ zoneId: workspaceZone.zone_id, date: date || undefined });
      toast({ title: t($ => $.planning.toast.markedPlanned, { name: workspaceZone.name_ar }) });
      setWorkspaceZone(null);
    } catch {
      toast({ title: t($ => $.planning.toast.markFailed), variant: 'destructive' });
    }
  }

  // ── KPI metrics ─────────────────────────────────────────────────────────────
  const metrics = useMemo(() => [
    {
      id:         'ready',
      icon:       Circle,
      label:      t($ => $.planning.kpi.readyZones),
      value:      planningKpis.ready,
      colorClass: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
      onClick:    () => setStatus((s) => (s === 'ready' ? 'all' : 'ready')),
      active:     statusFilter === 'ready',
      isLoading:  zonesLoading,
    },
    {
      id:         'in_planning',
      icon:       Clock,
      label:      t($ => $.planning.status.inPlanning),
      value:      planningKpis.in_planning,
      colorClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
      onClick:    () => setStatus((s) => (s === 'in_planning' ? 'all' : 'in_planning')),
      active:     statusFilter === 'in_planning',
      isLoading:  zonesLoading,
    },
    {
      id:         'planned',
      icon:       CheckCircle2,
      label:      t($ => $.planning.kpi.plannedZones),
      value:      planningKpis.planned,
      colorClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
      onClick:    () => setStatus((s) => (s === 'planned' ? 'all' : 'planned')),
      active:     statusFilter === 'planned',
      isLoading:  zonesLoading,
    },
    {
      id:         'ready_orders',
      icon:       ListOrdered,
      label:      t($ => $.planning.kpi.readyOrders),
      value:      planningKpis.ready_orders,
      colorClass: 'bg-primary/10 text-primary',
      isLoading:  statsLoading,
    },
   
  ], [planningKpis, statusFilter, zonesLoading, statsLoading, t]);

  // ── Empty state logic ────────────────────────────────────────────────────────
  const hasActiveFilter   = !!(search || statusFilter !== 'all');
  const activeWithOrders  = rawZones.filter((z) => z.orders_count > 0);
  const allZonesPlanned   =
    !hasActiveFilter &&
    activeWithOrders.length > 0 &&
    activeWithOrders.every((z) => z.planning_status === 'planned');

  // ── Toolbar view controls ────────────────────────────────────────────────────
  const viewControls = (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant={view === 'card' ? 'secondary' : 'ghost'}
        className="h-7 w-7 p-0"
        title={t($ => $.planning.toolbar.cardView)}
        onClick={() => toggleView('card')}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant={view === 'table' ? 'secondary' : 'ghost'}
        className="h-7 w-7 p-0"
        title={t($ => $.planning.toolbar.tableView)}
        onClick={() => toggleView('table')}
      >
        <List className="h-3.5 w-3.5" />
      </Button>
      {(stats?.unassigned_orders ?? 0) > 0 && (
        <Button
          size="sm"
          variant="outline"
          className="ms-1 gap-1.5 text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-700 dark:bg-amber-950/30"
          onClick={() => setUnassignedOpen((v) => !v)}
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {t($ => $.planning.toolbar.unassignedCount, { count: stats!.unassigned_orders })}
        </Button>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-full">
      <WorkspaceHeader
        title={t($ => $.planning.title)}
        description={t($ => $.planning.description)}
        breadcrumbs={[
          { label: t($ => $.planning.breadcrumbRoot) },
          { label: t($ => $.planning.title) },
        ]}
        metrics={metrics}
        secondaryActions={[
          {
            key:     'export',
            label:   t($ => $.common.export),
            onClick: () => undefined,
            variant: 'outline',
            soon:    true,
          },
        ]}
      />

      {/* ── SmartToolbar ── */}
      <SmartToolbar
        onRefresh={handleRefresh}
        isFetching={isFetching}
        secondaryActions={[
          {
            key:          'show-empty',
            label:        showEmpty
              ? t($ => $.planning.toolbar.hideEmptyZones)
              : t($ => $.planning.toolbar.showEmptyZones),
            onClick:      () => setShowEmpty((v) => !v),
            hideOnMobile: true,
          },
        ]}
        viewControls={viewControls}
      />

      {/* ── Filter bar ── */}
      <div className="px-4 sm:px-6 py-3 border-b bg-muted/20 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {t($ => $.planning.filters.deliveryDate)}
          </Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 text-sm w-44"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            {t($ => $.planning.filters.planningStatus)}
          </Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatus(v as ZonePlanningStatus | 'all')}
          >
            <SelectTrigger className="h-8 text-sm w-40">
              <SelectValue placeholder={t($ => $.planning.filters.allStatuses)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t($ => $.planning.filters.allStatuses)}</SelectItem>
              <SelectItem value="ready">{t($ => $.planning.status.ready)}</SelectItem>
              <SelectItem value="in_planning">{t($ => $.planning.status.inPlanning)}</SelectItem>
              <SelectItem value="planned">{t($ => $.planning.status.planned)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[180px] max-w-xs">
          <Label className="text-xs text-muted-foreground">
            {t($ => $.planning.filters.searchZone)}
          </Label>
          <Input
            placeholder={t($ => $.planning.filters.searchZonePlaceholder)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Live status summary */}
        <div className="ms-auto flex items-end gap-1.5 pb-0.5">
          {planningKpis.ready > 0 && (
            <Badge variant="outline" className="text-xs">
              {t($ => $.planning.summary.readyCount, { count: planningKpis.ready })}
            </Badge>
          )}
          {planningKpis.in_planning > 0 && (
            <Badge className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-0">
              {t($ => $.planning.summary.inPlanningCount, { count: planningKpis.in_planning })}
            </Badge>
          )}
          {planningKpis.planned > 0 && (
            <Badge className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">
              {t($ => $.planning.summary.plannedCount, { count: planningKpis.planned })}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 py-5 space-y-5">

        {/* ── Unassigned panel ── */}
        {unassignedOpen && (stats?.unassigned_orders ?? 0) > 0 && (
          <UnassignedPanel orders={unassigned} isLoading={unassignedLoading} />
        )}

        {/* ── All planned success state ── */}
        {!zonesLoading && allZonesPlanned && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
            <h3 className="text-xl font-semibold text-foreground">
              {t($ => $.planning.empty.allPlannedTitle)}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {t($ => $.planning.empty.allPlannedHint)}
            </p>
            <Button variant="outline" size="sm" className="mt-5 gap-1.5" onClick={handleRefresh}>
              {t($ => $.common.refresh)}
            </Button>
          </div>
        )}

        {/* ── Loading skeletons ── */}
        {zonesLoading && !allZonesPlanned && (
          view === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <ZonePlanningCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-muted-foreground">
                    {[
                      t($ => $.common.zone),
                      t($ => $.planning.metrics.orders),
                      t($ => $.planning.metrics.customers),
                      t($ => $.planning.metrics.products),
                      t($ => $.planning.metrics.stops),
                      t($ => $.planning.metrics.collection),
                      t($ => $.planning.metrics.weight),
                      t($ => $.common.status),
                      '',
                    ].map((h, i) => (
                      <th key={i} className="py-2 px-3 font-medium text-start">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="py-3 px-3">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── Empty state (no data or no filter match) ── */}
        {!zonesLoading && !allZonesPlanned && zones.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Map className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">
              {hasActiveFilter
                ? t($ => $.planning.empty.noMatchTitle)
                : t($ => $.planning.empty.noOrdersTitle)}
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
              {hasActiveFilter
                ? t($ => $.planning.empty.noMatchHint)
                : date
                  ? t($ => $.planning.empty.noOrdersForDate, { date })
                  : t($ => $.planning.empty.noOrdersAssigned)}
            </p>
            {(stats?.unassigned_orders ?? 0) > 0 && !hasActiveFilter && (
              <div className="mt-4">
                <Badge variant="outline" className="text-amber-700 border-amber-300 gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {t($ => $.planning.empty.needZoneAssignment, { count: stats!.unassigned_orders })}
                </Badge>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-5 gap-1.5"
              onClick={handleRefresh}
            >
              {t($ => $.common.refresh)}
            </Button>
          </div>
        )}

        {/* ── Card View ── */}
        {!zonesLoading && !allZonesPlanned && view === 'card' && zones.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {zones.map((zone) => (
              <ZonePlanningCard
                key={zone.zone_id}
                zone={zone}
                date={date || undefined}
                onViewOrders={() => openDetail(zone, 'orders')}
                onViewProducts={() => openDetail(zone, 'products')}
                onViewCustomers={() => openDetail(zone, 'customers')}
                onStartPlanning={() => handlePrimaryAction(zone)}
                isStarting={startMutation.isPending && confirmZone?.zone_id === zone.zone_id}
              />
            ))}
          </div>
        )}

        {/* ── Table View ── */}
        {!zonesLoading && !allZonesPlanned && view === 'table' && zones.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="border-b text-muted-foreground">
                    <SortTh label={t($ => $.common.zone)}                        col="name_ar"           sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortTh label={t($ => $.planning.metrics.orders)}            col="orders_count"      sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="end" />
                    <SortTh label={t($ => $.planning.metrics.customers)}         col="customers_count"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="end" />
                    <SortTh label={t($ => $.planning.metrics.products)}          col="distinct_products" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="end" />
                    <SortTh label={t($ => $.planning.metrics.stops)}             col="estimated_stops"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="end" />
                    <SortTh label={t($ => $.planning.metrics.collection)}        col="total_collection"  sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="end" />
                    <SortTh label={t($ => $.planning.metrics.weight)}            col={null}              sortBy={sortBy} sortDir={sortDir} onSort={handleSort} align="end" />
                    <SortTh label={t($ => $.common.status)}                      col="planning_status"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <th className="py-2 px-3 font-medium text-end">{t($ => $.planning.table.colAction)}</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((zone) => (
                    <tr
                      key={zone.zone_id}
                      className="border-b hover:bg-muted/30 transition-colors"
                    >
                      {/* Zone */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          {zone.color && (
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: zone.color }}
                            />
                          )}
                          <div>
                            <p className="font-medium text-sm">{zone.name_ar}</p>
                            <p className="text-xs font-mono text-muted-foreground">{zone.code}</p>
                          </div>
                        </div>
                      </td>
                      {/* Orders */}
                      <td className="py-2.5 px-3 text-end tabular-nums font-semibold">
                        {zone.orders_count > 0 ? zone.orders_count : (
                          <span className="text-muted-foreground font-normal">—</span>
                        )}
                      </td>
                      {/* Customers */}
                      <td className="py-2.5 px-3 text-end tabular-nums text-muted-foreground">
                        {zone.orders_count > 0 ? zone.customers_count : '—'}
                      </td>
                      {/* Products */}
                      <td className="py-2.5 px-3 text-end tabular-nums text-muted-foreground">
                        {zone.orders_count > 0 ? zone.distinct_products : '—'}
                      </td>
                      {/* Stops */}
                      <td className="py-2.5 px-3 text-end tabular-nums text-muted-foreground">
                        {zone.orders_count > 0 ? zone.estimated_stops : '—'}
                      </td>
                      {/* Collection */}
                      <td className="py-2.5 px-3 text-end tabular-nums font-medium whitespace-nowrap">
                        {zone.orders_count > 0 ? money(zone.total_collection) : '—'}
                      </td>
                      {/* Weight */}
                      <td className="py-2.5 px-3 text-end text-muted-foreground">—</td>
                      {/* Status */}
                      <td className="py-2.5 px-3">
                        {zone.planning_status === 'planned' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3 me-1" />
                            {t($ => $.planning.status.planned)}
                          </Badge>
                        ) : zone.planning_status === 'in_planning' ? (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            <Clock className="h-3 w-3 me-1" />
                            {t($ => $.planning.status.inPlanning)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            {t($ => $.planning.status.ready)}
                          </Badge>
                        )}
                      </td>
                      {/* Action */}
                      <td className="py-2.5 px-3 text-end whitespace-nowrap">
                        {zone.orders_count === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            {t($ => $.planning.table.empty)}
                          </span>
                        ) : zone.planning_status === 'planned' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setWorkspaceZone(zone)}
                          >
                            {t($ => $.planning.actions.viewPlan)}
                          </Button>
                        ) : zone.planning_status === 'in_planning' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setWorkspaceZone(zone)}
                          >
                            <ShoppingBag className="h-3 w-3" />
                            {t($ => $.planning.actions.continue)}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setConfirmZone(zone)}
                          >
                            {t($ => $.planning.actions.startPlanning)}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Table footer */}
            <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
              <span>{t($ => $.planning.table.zoneCount, { count: zones.length })}</span>
              <div className="flex items-center gap-3">
                {activeWithOrders.length > 0 && (
                  <>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {t($ => $.planning.table.customerCount, {
                        count: rawZones.reduce((s, z) => s + z.customers_count, 0),
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {t($ => $.planning.table.productCount, {
                        count: rawZones.reduce((s, z) => s + z.distinct_products, 0),
                      })}
                    </span>
                    <span className="font-medium text-foreground">
                      {t($ => $.planning.table.totalCollection, {
                        amount: fmt(rawZones.reduce((s, z) => s + z.total_collection, 0)),
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail drawer (quick view) ── */}
      <ZoneDetailDrawer
        zone={activeZone}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        filters={{ date: date || undefined }}
        initialTab={activeTab}
        mode="detail"
      />

      {/* ── Zone Planning Workspace ── */}
      <ZoneDetailDrawer
        zone={workspaceZone}
        open={workspaceZone !== null}
        onOpenChange={(open) => { if (!open) setWorkspaceZone(null); }}
        filters={{ date: date || undefined }}
        initialTab="orders"
        mode="workspace"
        onMarkPlanned={() => void handleMarkPlanned()}
        isMarkingPlanned={markMutation.isPending}
      />

      {/* ── Start Planning confirmation dialog ── */}
      <StartPlanningDialog
        zone={confirmZone}
        open={confirmZone !== null}
        onOpenChange={(open) => { if (!open) setConfirmZone(null); }}
        onConfirm={() => void handleConfirmStart()}
        isPending={startMutation.isPending}
      />
    </div>
  );
}
