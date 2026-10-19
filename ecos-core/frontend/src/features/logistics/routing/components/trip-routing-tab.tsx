import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Route as RouteIcon } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/features/authorization';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import {
  useActivateRoutePlan,
  useCompleteRoutePlan,
  useCurrentRoutePlan,
  usePlanTrip,
  useProjectEta,
  useRoutePlanHistory,
  useRoutingStrategies,
} from '../hooks/use-routing';
import type { RoutePlan, RoutePlanStatus, RoutingStrategy } from '../types/routing';

type LogisticsLabel = ($: typeof enLogistics) => string;

const PLAN_STATUS_LABEL: Record<RoutePlanStatus, LogisticsLabel> = {
  draft: ($) => $.trips.routing.planStatus.draft,
  optimizing: ($) => $.trips.routing.planStatus.optimizing,
  failed: ($) => $.trips.routing.planStatus.failed,
  planned: ($) => $.trips.routing.planStatus.planned,
  active: ($) => $.trips.routing.planStatus.active,
  superseded: ($) => $.trips.routing.planStatus.superseded,
  completed: ($) => $.trips.routing.planStatus.completed,
  cancelled: ($) => $.trips.routing.planStatus.cancelled,
};

const PLAN_STATUS_CLASS: Record<RoutePlanStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  optimizing: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  failed: 'bg-destructive/10 text-destructive',
  planned: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  superseded: 'bg-muted text-muted-foreground',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  cancelled: 'bg-muted text-muted-foreground line-through',
};

/** Strategy entries are adapter-shaped; take whichever identity fields exist. */
function strategyValue(strategy: RoutingStrategy): string {
  return strategy.key ?? strategy.value ?? strategy.name ?? '';
}

function strategyLabel(strategy: RoutingStrategy): string {
  return strategy.label ?? strategy.name ?? strategyValue(strategy);
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/**
 * Route planning for one trip.
 *
 * Planning and re-planning are the same endpoint — the backend freezes stops
 * already attempted and re-sequences the remainder — so one button serves both
 * and its label reflects whether a plan exists.
 */
export function TripRoutingTab({ tripId }: { tripId: string }) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();
  const canOptimize = can('routing.optimize');

  const { data: plan, isLoading } = useCurrentRoutePlan(tripId);
  const { data: history } = useRoutePlanHistory(tripId);
  const { data: strategies } = useRoutingStrategies();

  const planTrip = usePlanTrip(tripId);
  const activate = useActivateRoutePlan(tripId);
  const complete = useCompleteRoutePlan(tripId);
  const projectEta = useProjectEta(tripId);

  const [strategy, setStrategy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [breaches, setBreaches] = useState<number | null>(null);

  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';
  const num = (value: number | null) =>
    value === null || value === undefined
      ? '—'
      : new Intl.NumberFormat(i18n.language).format(value);

  async function run(action: () => Promise<unknown>, failure: LogisticsLabel) {
    setError(null);
    try {
      await action();
    } catch {
      setError(t(failure));
    }
  }

  async function runEta(planUuid: string) {
    setError(null);
    setBreaches(null);
    try {
      const result = await projectEta.mutateAsync(planUuid);
      setBreaches(result.predicted_breaches.length);
    } catch {
      setError(t(($) => $.trips.routing.etaFailed));
    }
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const planButton = canOptimize && (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="routing-strategy">{t(($) => $.trips.routing.strategy)}</Label>
        <select
          id="routing-strategy"
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">{t(($) => $.trips.routing.strategyDefault)}</option>
          {(strategies ?? []).map((item) => (
            <option key={strategyValue(item)} value={strategyValue(item)}>
              {strategyLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <Button
        size="sm"
        className="self-start"
        disabled={planTrip.isPending}
        onClick={() =>
          void run(
            () => planTrip.mutateAsync({ strategy: strategy || null }),
            ($) => $.trips.routing.planFailed,
          )
        }
      >
        <RouteIcon className="me-1 h-3.5 w-3.5" />
        {plan ? t(($) => $.trips.routing.replan) : t(($) => $.trips.routing.plan)}
      </Button>

      <p className="text-[11px] text-muted-foreground">
        {t(($) => $.trips.routing.deterministicNote)}
      </p>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!plan ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t(($) => $.trips.routing.none)}</p>
          <p className="text-[11px] text-muted-foreground">{t(($) => $.trips.routing.noneHint)}</p>
          {planButton}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{t(($) => $.trips.routing.title)}</h3>
            <Badge variant="secondary" className={PLAN_STATUS_CLASS[plan.status]}>
              {t(PLAN_STATUS_LABEL[plan.status])}
            </Badge>
            {plan.is_current && (
              <Badge variant="outline" className="text-[10px]">
                {t(($) => $.trips.routing.current)}
              </Badge>
            )}
            {plan.strategy && (
              <span className="text-[11px] text-muted-foreground">
                {plan.strategy}
                {plan.strategy_version ? ` · ${plan.strategy_version}` : ''}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label={t(($) => $.trips.routing.distance)}
              value={num(plan.total_distance_km)}
            />
            <Stat
              label={t(($) => $.trips.routing.duration)}
              value={num(plan.total_duration_minutes)}
            />
            <Stat label={t(($) => $.trips.routing.stopCount)} value={plan.stop_count} />
            <Stat
              label={t(($) => $.trips.routing.averagePerStop)}
              value={num(plan.average_km_per_stop)}
            />
            <Stat label={t(($) => $.trips.routing.plannedAt)} value={dateTime(plan.planned_at)} />
            <Stat
              label={t(($) => $.trips.routing.activatedAt)}
              value={dateTime(plan.activated_at)}
            />
          </div>

          {canOptimize && (
            <div className="flex flex-wrap gap-2">
              {plan.status !== 'active' && plan.status !== 'completed' && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={activate.isPending}
                  onClick={() =>
                    void run(
                      () => activate.mutateAsync(plan.uuid),
                      ($) => $.trips.routing.activateFailed,
                    )
                  }
                >
                  {t(($) => $.trips.routing.activate)}
                </Button>
              )}
              {plan.status === 'active' && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={complete.isPending}
                  onClick={() =>
                    void run(
                      () => complete.mutateAsync(plan.uuid),
                      ($) => $.trips.routing.completeFailed,
                    )
                  }
                >
                  {t(($) => $.trips.routing.complete)}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={projectEta.isPending}
                onClick={() => void runEta(plan.uuid)}
              >
                <Clock className="me-1 h-3.5 w-3.5" />
                {t(($) => $.trips.routing.projectEta)}
              </Button>
            </div>
          )}

          {breaches !== null && (
            <p className="text-xs text-muted-foreground">
              {breaches === 0
                ? t(($) => $.trips.routing.noBreaches)
                : t(($) => $.trips.routing.breachesFound, { count: breaches })}
            </p>
          )}

          {(plan.stops?.length ?? 0) > 0 && (
            <section className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(($) => $.trips.routing.stops)}
              </h4>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2 text-start font-medium">
                        {t(($) => $.trips.routing.sequence)}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t(($) => $.trips.routing.stopId)}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t(($) => $.trips.routing.eta)}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t(($) => $.trips.routing.etaLevel)}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {plan.stops?.map((stop) => (
                      <tr key={stop.stop_id}>
                        <td className="px-3 py-2">{stop.sequence}</td>
                        <td className="px-3 py-2">
                          {stop.stop_id}
                          {stop.is_frozen && (
                            <Badge variant="outline" className="ms-2 text-[10px]">
                              {t(($) => $.trips.routing.frozen)}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {dateTime(stop.eta)}
                          {stop.breach_predicted && (
                            <Badge variant="outline" className="ms-2 text-[10px] text-destructive">
                              {t(($) => $.trips.routing.breach)}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {stop.eta_level_label ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {planButton}

          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(($) => $.trips.routing.history)}
            </h4>
            {(history ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t(($) => $.trips.routing.noHistory)}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {(history ?? []).map((entry: RoutePlan) => (
                  <li
                    key={entry.uuid}
                    className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs"
                  >
                    <Badge variant="secondary" className={PLAN_STATUS_CLASS[entry.status]}>
                      {t(PLAN_STATUS_LABEL[entry.status])}
                    </Badge>
                    <span className="text-muted-foreground">{dateTime(entry.planned_at)}</span>
                    {entry.supersede_reason && (
                      <span className="text-muted-foreground">{entry.supersede_reason}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
