import { CheckCircle2, Clock, ListOrdered, Package, ShoppingBag, Truck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatter } from '@/hooks/use-formatter';
import type { ZonePlanCard, ZonePlanningStatus } from '../types/distribution-planning';

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ZonePlanningStatus }) {
  const { t } = useTranslation('logistics');

  if (status === 'planned') {
    return (
      <Badge className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        {t($ => $.planning.status.planned)}
      </Badge>
    );
  }
  if (status === 'in_planning') {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
        <Clock className="h-3 w-3" />
        {t($ => $.planning.status.inPlanning)}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {t($ => $.planning.status.ready)}
    </Badge>
  );
}

function estimatedSessions(ordersCount: number): number {
  return Math.max(1, Math.ceil(ordersCount / 25));
}

// ── Zone card ─────────────────────────────────────────────────────────────────

type Props = {
  zone:            ZonePlanCard;
  date?:           string;
  onViewOrders:    () => void;
  onViewProducts:  () => void;
  onViewCustomers: () => void;
  onStartPlanning: () => void;
  isStarting?:     boolean;
};

export function ZonePlanningCard({
  zone,
  onViewOrders,
  onViewProducts,
  onViewCustomers,
  onStartPlanning,
  isStarting,
}: Props) {
  const { t } = useTranslation('logistics');
  const { money } = useFormatter();

  const startLabel =
    zone.planning_status === 'planned'
      ? t($ => $.planning.actions.plannedDone)
      : zone.planning_status === 'in_planning'
        ? t($ => $.planning.actions.continuePlanning)
        : t($ => $.planning.actions.startPlanning);

  const isEmpty = zone.orders_count === 0;
  const sessions = estimatedSessions(zone.orders_count);

  return (
    <Card
      className={`flex flex-col overflow-hidden hover:shadow-md transition-shadow duration-150 ${
        isEmpty ? 'opacity-60' : ''
      }`}
    >
      {/* ── Zone color accent strip ── */}
      <div
        className="h-2 w-full shrink-0"
        style={{ backgroundColor: zone.color ?? 'hsl(var(--muted))' }}
      />

      <CardHeader className="pb-2 pt-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {zone.code}
          </span>
          <StatusBadge status={zone.planning_status} />
        </div>

        <div>
          <h3 className="font-semibold text-base leading-tight">{zone.name_ar}</h3>
          {zone.name_en && (
            <p className="text-xs text-muted-foreground mt-0.5">{zone.name_en}</p>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {/* Primary metrics: Orders (dominant) + Collection */}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-4xl font-bold tabular-nums leading-none">
              {isEmpty ? '—' : zone.orders_count}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <ListOrdered className="h-3 w-3" />
              {t($ => $.planning.metrics.orders)}
            </p>
          </div>
          <div className="text-end pb-0.5">
            <p className="text-xl font-bold tabular-nums leading-none">
              {isEmpty ? '—' : money(zone.total_collection)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t($ => $.planning.metrics.collection)}
            </p>
          </div>
        </div>

        {/* Secondary metrics grid */}
        <div className="grid grid-cols-3 gap-x-2 gap-y-2 border-t pt-2">
          <div>
            <p className="text-sm font-medium tabular-nums">{isEmpty ? '—' : zone.customers_count}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
              <Users className="h-2.5 w-2.5" />
              {t($ => $.planning.metrics.customers)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium tabular-nums">{isEmpty ? '—' : zone.distinct_products}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
              <Package className="h-2.5 w-2.5" />
              {t($ => $.planning.metrics.products)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium tabular-nums">{isEmpty ? '—' : zone.estimated_stops}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
              <ShoppingBag className="h-2.5 w-2.5" />
              {t($ => $.planning.metrics.stops)}
            </p>
          </div>
        </div>

        {/* Capacity indicator */}
        {!isEmpty && (
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Truck className="h-3 w-3" />
              {t($ => $.planning.card.estSessions)}
            </span>
            <span className="font-semibold tabular-nums">{sessions}</span>
          </div>
        )}

        {/* Action buttons */}
        {!isEmpty && (
          <div className="space-y-2 pt-1">
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={onViewOrders}>
                {t($ => $.planning.metrics.orders)}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={onViewProducts}>
                {t($ => $.planning.metrics.products)}
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={onViewCustomers}>
                {t($ => $.planning.metrics.customers)}
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={onStartPlanning}
              disabled={zone.planning_status === 'planned' || isStarting}
              variant={zone.planning_status === 'planned' ? 'secondary' : 'default'}
            >
              {startLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

export function ZonePlanningCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-2 w-full bg-muted" />
      <CardHeader className="pb-2 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <Skeleton className="h-12 w-14" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="grid grid-cols-3 gap-2 border-t pt-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="h-7 w-full" />
        <div className="space-y-2">
          <div className="flex gap-1.5">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
