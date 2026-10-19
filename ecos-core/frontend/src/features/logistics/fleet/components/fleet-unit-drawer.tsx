import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge, Loader2, Wallet, Wrench } from 'lucide-react';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/features/authorization';
import { useToast } from '@/components/ds/use-toast';

import {
  useFleetUnit,
  useHealth,
  useMaintenancePlans,
  useReprojectMaintenancePlan,
  useOdometerHistory,
  useRecordOdometer,
  useUnitCosts,
} from '../hooks/use-fleet';
import type { CostType } from '../types/fleet';
import { BlockerList } from './blocker-list';
import { FitnessBadge, LifecycleBadge } from './fitness-badge';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function Overview({ unitId }: { unitId: string }) {
  const { t } = useTranslation('logistics');
  const { data: unit } = useFleetUnit(unitId);
  const { data: health } = useHealth(unitId);

  if (!unit) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t($ => $.fleet.table.fitness)}>
          <FitnessBadge level={unit.fitness.level} />
        </Field>
        <Field label={t($ => $.fleet.table.lifecycle)}>
          <LifecycleBadge state={unit.lifecycle_state} />
        </Field>
        <Field label={t($ => $.fleet.unit.plate)}>{unit.vehicle?.plate_number ?? '—'}</Field>
        <Field label={t($ => $.fleet.unit.vehicleCode)}>{unit.vehicle?.vehicle_code ?? '—'}</Field>
        <Field label={t($ => $.fleet.table.odometer)}>
          {unit.current_odometer_km !== null
            ? t($ => $.fleet.kmValue, { value: unit.current_odometer_km.toLocaleString() })
            : '—'}
        </Field>
        <Field label={t($ => $.fleet.unit.commissioned)}>{formatDate(unit.commissioned_at)}</Field>
      </div>

      {unit.lifecycle_reason && (
        <Alert>
          <AlertDescription className="text-xs">{unit.lifecycle_reason}</AlertDescription>
        </Alert>
      )}

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium">{t($ => $.fleet.unit.readiness)}</p>
        <BlockerList verdict={unit.fitness} />
      </div>

      {health && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t($ => $.fleet.health.title)}</p>
              <Badge variant="outline" className="text-xs">
                {health.value}/100 · {t($ => $.fleet.health.band[health.band])}
              </Badge>
            </div>
            <div className="space-y-1.5">
              {Object.entries(health.factors).map(([name, factor]) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 capitalize text-muted-foreground">
                    {name.replace(/_/g, ' ')}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${
                        factor.score >= 0.9
                          ? 'bg-emerald-600'
                          : factor.score >= 0.5
                            ? 'bg-amber-500'
                            : 'bg-destructive'
                      }`}
                      style={{ width: `${Math.round(factor.score * 100)}%` }}
                    />
                  </div>
                  <span className="w-40 shrink-0 text-end text-muted-foreground">
                    {factor.note}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Odometer ─────────────────────────────────────────────────────────────────

function Odometer({ unitId }: { unitId: string }) {
  const { t } = useTranslation('logistics');
  const { data, isLoading } = useOdometerHistory(unitId);
  const record = useRecordOdometer();
  const { toast } = useToast();
  const [reading, setReading] = useState('');

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  async function submit() {
    const km = Number(reading);
    if (!Number.isFinite(km) || km < 0) return;

    try {
      const result = await record.mutateAsync({ id: unitId, readingKm: km });
      setReading('');
      toast({
        title: result.is_accepted
          ? t($ => $.fleet.odometer.toastRecorded)
          : t($ => $.fleet.odometer.toastNotAccepted),
        description: result.rejection_reason ?? undefined,
        variant: result.is_accepted ? undefined : 'destructive',
      });
    } catch {
      toast({ title: t($ => $.fleet.odometer.toastFailed), variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="odometer" className="text-xs">
            {t($ => $.fleet.odometer.newReading)}
          </Label>
          <Input
            id="odometer"
            type="number"
            value={reading}
            onChange={(e) => setReading(e.target.value)}
            placeholder={data?.meta.current_odometer_km?.toString() ?? '0'}
            className="h-8 text-sm"
          />
        </div>
        <Button size="sm" className="gap-1.5" disabled={!reading || record.isPending} onClick={submit}>
          {record.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Gauge className="size-3.5" />}
          {t($ => $.fleet.odometer.record)}
        </Button>
      </div>

      {data?.meta.is_stale && (
        <Alert>
          <AlertDescription className="text-xs">
            {t($ => $.fleet.odometer.staleWarning)}
          </AlertDescription>
        </Alert>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-1 text-start font-normal">{t($ => $.fleet.odometer.colReading)}</th>
            <th className="py-1 text-start font-normal">{t($ => $.fleet.odometer.colSource)}</th>
            <th className="py-1 text-start font-normal">{t($ => $.fleet.odometer.colWhen)}</th>
            <th className="py-1 text-start font-normal">{t($ => $.fleet.odometer.colAccepted)}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(data?.data ?? []).map((row) => (
            <tr key={row.id}>
              <td className="py-1 tabular-nums">
                {t($ => $.fleet.kmValue, { value: row.reading_km.toLocaleString() })}
              </td>
              <td className="py-1 text-muted-foreground">{row.source_label}</td>
              <td className="py-1 text-muted-foreground">{formatDate(row.recorded_at)}</td>
              <td className="py-1">
                {row.is_accepted ? (
                  <span className="text-emerald-600">{t($ => $.common.yes)}</span>
                ) : (
                  <span className="text-destructive" title={row.rejection_reason ?? undefined}>
                    {t($ => $.fleet.odometer.rejected)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Maintenance ──────────────────────────────────────────────────────────────

function Maintenance({ unitId }: { unitId: string }) {
  const { t } = useTranslation('logistics');
  const { data: plans, isLoading } = useMaintenancePlans(unitId);

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!plans || plans.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t($ => $.fleet.maintenance.empty)}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {plans.map((plan) => (
        <div key={plan.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">{plan.name}</span>
            </div>
            {plan.is_overdue ? (
              <Badge variant="destructive" className="text-[10px]">
                {t($ => $.fleet.maintenance.overdue)}
              </Badge>
            ) : plan.is_due ? (
              <Badge className="bg-amber-500 text-[10px] hover:bg-amber-500">
                {t($ => $.fleet.maintenance.due)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                {t($ => $.common.scheduled)}
              </Badge>
            )}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-3">
            <Field label={t($ => $.fleet.maintenance.nextDueDate)}>{plan.next_due_date ?? '—'}</Field>
            <Field label={t($ => $.fleet.maintenance.nextDueKm)}>
              {plan.next_due_km !== null
                ? t($ => $.fleet.kmValue, { value: plan.next_due_km.toLocaleString() })
                : '—'}
            </Field>
            <Field label={t($ => $.fleet.maintenance.remaining)}>
              {plan.km_until_due !== null
                ? t($ => $.fleet.kmValue, { value: plan.km_until_due.toLocaleString() })
                : plan.days_until_due !== null
                  ? t($ => $.fleet.daysShort, { days: plan.days_until_due })
                  : '—'}
            </Field>
          </div>

          <ReprojectControl unitId={unitId} planId={plan.id} />

          {plan.rules && plan.rules.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {plan.rules.map((rule) => (
                <Badge key={rule.id} variant="secondary" className="text-[10px]">
                  {t($ => $.fleet.maintenance.everyInterval, {
                    value: rule.interval_value.toLocaleString(),
                    unit: rule.unit,
                  })}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Recomputing a plan's next-due projection.
 *
 * The endpoint takes no payload on purpose: the projection comes from the
 * unit's odometer and service history, and letting an operator supply a date
 * would turn the maintenance schedule into an opinion. So this is a single
 * action with no form.
 */
function ReprojectControl({ unitId, planId }: { unitId: string; planId: string }) {
  const { t } = useTranslation('logistics');
  const { can } = usePermission();
  const reproject = useReprojectMaintenancePlan();
  const [error, setError] = useState<string | null>(null);

  if (!can('fleet.maintenance.schedule')) return null;

  async function run() {
    setError(null);
    try {
      await reproject.mutateAsync({ unitId, planId });
    } catch {
      setError(t($ => $.fleet.review.reprojectFailed));
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 self-start text-xs"
        disabled={reproject.isPending}
        onClick={() => void run()}
      >
        {t($ => $.fleet.review.reproject)}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {t($ => $.fleet.review.reprojectDescription)}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Cost ─────────────────────────────────────────────────────────────────────

function Cost({ unitId }: { unitId: string }) {
  const { t } = useTranslation('logistics');
  const { data: costs, isLoading } = useUnitCosts(unitId);

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!costs) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label={t($ => $.common.total)}>
          {costs.total.toLocaleString()} {costs.currency}
        </Field>
        <Field label={t($ => $.fleet.cost.distance)}>
          {costs.distance_km !== null
            ? t($ => $.fleet.kmValue, { value: costs.distance_km.toLocaleString() })
            : '—'}
        </Field>
        <Field label={t($ => $.fleet.cost.costPerKm)}>
          {costs.cost_per_km !== null ? (
            `${costs.cost_per_km} ${costs.currency}`
          ) : (
            // Null, never zero — a silent zero reads as "free to run".
            <span className="text-muted-foreground">{t($ => $.fleet.cost.notEnoughOdometer)}</span>
          )}
        </Field>
      </div>

      <Separator />

      <div className="space-y-1.5">
        {/* Object.entries widens keys to `string`; by_type is Record<CostType, number>,
            so this restores the key type the signature discards. */}
        {(Object.entries(costs.by_type) as [CostType, number][])
          .filter(([, amount]) => amount !== 0)
          .map(([type, amount]) => (
            <div key={type} className="flex items-center justify-between text-xs">
              <span className="capitalize text-muted-foreground">{t($ => $.fleet.costType[type])}</span>
              <span className="tabular-nums">
                {amount.toLocaleString()} {costs.currency}
              </span>
            </div>
          ))}
      </div>

      <p className="text-[11px] text-muted-foreground">{t($ => $.fleet.cost.authorityNote)}</p>
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────

export function FleetUnitDrawer({
  unitId,
  open,
  onOpenChange,
}: {
  unitId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('logistics');
  const { data: unit } = useFleetUnit(open ? unitId : null);

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      title={
        unit
          ? t($ => $.fleet.drawer.titleWithPlate, {
              plate: unit.vehicle?.plate_number ?? unit.vehicle_id,
            })
          : t($ => $.fleet.drawer.title)
      }
      description={unit?.vehicle?.name ?? undefined}
    >
      {!unitId ? null : (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">{t($ => $.common.overview)}</TabsTrigger>
            <TabsTrigger value="maintenance">{t($ => $.fleet.drawer.tabMaintenance)}</TabsTrigger>
            <TabsTrigger value="odometer">{t($ => $.fleet.drawer.tabOdometer)}</TabsTrigger>
            <TabsTrigger value="cost">
              <Wallet className="me-1 size-3.5" />
              {t($ => $.fleet.drawer.tabCost)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <Overview unitId={unitId} />
          </TabsContent>
          <TabsContent value="maintenance" className="pt-4">
            <Maintenance unitId={unitId} />
          </TabsContent>
          <TabsContent value="odometer" className="pt-4">
            <Odometer unitId={unitId} />
          </TabsContent>
          <TabsContent value="cost" className="pt-4">
            <Cost unitId={unitId} />
          </TabsContent>
        </Tabs>
      )}
    </PageDrawer>
  );
}
