import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/features/authorization';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import { useSetTripStatus, useTrip, useTripDispatchReadiness } from '../hooks/use-trips';
import type { Trip, TripStatus, TripType } from '../types/trip';
import { TripCustodyTab } from './trip-custody-tab';
import { TripExceptionsTab } from './trip-exceptions-tab';
import { TripOrdersTab } from './trip-orders-tab';
import { TripReturnsTab } from './trip-returns-tab';
import { TripRoutingTab } from '@/features/logistics/routing/components/trip-routing-tab';
import { TripPaymentsTab } from './trip-payments-tab';
import { TripSettlementTab } from './trip-settlement-tab';
import { TripStatusBadge } from './trip-status-badge';
import { TripStopsTab } from './trip-stops-tab';

type LogisticsLabel = ($: typeof enLogistics) => string;

const TYPE_LABEL: Record<TripType, LogisticsLabel> = {
  company_vehicle: ($) => $.trips.type.company_vehicle,
  personal_vehicle: ($) => $.trips.type.personal_vehicle,
  external_carrier: ($) => $.trips.type.external_carrier,
};

// ── Presentational pieces (module scope: never redeclared per render) ─────────

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function YesNo({ value }: { value: boolean }) {
  const { t } = useTranslation('logistics');
  return (
    <span className={value ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
      {value ? t(($) => $.trips.drawer.acceptance.yes) : t(($) => $.trips.drawer.acceptance.no)}
    </span>
  );
}

// ── Status transition ────────────────────────────────────────────────────────

/**
 * The trip publishes its own legal transitions, so the control offers exactly
 * those and nothing else. A hard-coded state machine in the client would drift
 * from the domain's the first time the domain changed.
 */
function StatusTransition({ trip }: { trip: Trip }) {
  const { t } = useTranslation('logistics');
  const setStatus = useSetTripStatus();
  const [target, setTarget] = useState<TripStatus | ''>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (trip.allowed_transitions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t(($) => $.trips.actions.noTransitions)}</p>;
  }

  async function apply() {
    if (!target) return;
    setError(null);
    try {
      await setStatus.mutateAsync({ id: trip.id, status: target, reason: reason.trim() || undefined });
      setTarget('');
      setReason('');
    } catch {
      // The domain refuses illegal transitions with a 422 and a reason. Showing
      // the refusal is the point; swallowing it would make the button lie.
      setError(t(($) => $.trips.actions.failed));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{t(($) => $.trips.actions.changeStatusTitle)}</p>
        <p className="text-xs text-muted-foreground">
          {t(($) => $.trips.actions.changeStatusDescription)}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trip-next-status">{t(($) => $.trips.actions.newStatus)}</Label>
        <select
          id="trip-next-status"
          value={target}
          onChange={(e) => setTarget(e.target.value as TripStatus | '')}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">—</option>
          {trip.allowed_transitions.map((transition) => (
            <option key={transition.value} value={transition.value}>
              {transition.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="trip-status-reason">{t(($) => $.trips.actions.reason)}</Label>
        <Input
          id="trip-status-reason"
          value={reason}
          maxLength={255}
          placeholder={t(($) => $.trips.actions.reasonPlaceholder)}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <Button
        size="sm"
        className="self-start"
        disabled={!target || setStatus.isPending}
        onClick={() => void apply()}
      >
        {t(($) => $.trips.actions.confirm)}
      </Button>
    </div>
  );
}

// ── Readiness ────────────────────────────────────────────────────────────────

function Readiness({ tripId }: { tripId: string }) {
  const { t } = useTranslation('logistics');
  const readiness = useTripDispatchReadiness(tripId);

  if (readiness.isLoading) {
    return <p className="text-sm text-muted-foreground">{t(($) => $.trips.drawer.readiness.checking)}</p>;
  }
  if (!readiness.data) return null;

  const { is_ready, blockers } = readiness.data;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {is_ready ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        )}
        <span className="text-sm font-medium">
          {is_ready
            ? t(($) => $.trips.drawer.readiness.ready)
            : t(($) => $.trips.drawer.readiness.notReady)}
        </span>
      </div>

      {blockers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(($) => $.trips.drawer.readiness.none)}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {blockers.map((blocker) => (
            <li key={blocker} className="rounded-md border px-3 py-2 text-sm">
              {blocker}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────

export function TripDrawer({
  tripId,
  open,
  onOpenChange,
  onEdit,
}: {
  tripId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (trip: Trip) => void;
}) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();
  // The parent remounts this drawer per trip and per open/close, so the tab
  // simply starts at overview — there is no prior state to reset.
  const [tab, setTab] = useState('overview');
  const { data: trip, isLoading } = useTrip(open ? tripId : null);

  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : t(($) => $.trips.drawer.timeline.none);
  const money = (value: number) => new Intl.NumberFormat(i18n.language).format(value);

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={trip ? `${trip.trip_number} — ${trip.name}` : t(($) => $.trips.drawer.title)}
      description={trip?.status_label}
      size="xl"
      footer={
        trip && trip.is_editable && can('logistics.distribution.update') ? (
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => onEdit(trip)}>
              <Pencil className="me-1 h-3.5 w-3.5" />
              {t(($) => $.trips.drawer.edit)}
            </Button>
          </div>
        ) : undefined
      }
    >
      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!isLoading && !trip && (
        <p className="py-6 text-sm text-muted-foreground">{t(($) => $.trips.drawer.notFound)}</p>
      )}

      {trip && (
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">{t(($) => $.trips.drawer.tabs.overview)}</TabsTrigger>
            <TabsTrigger value="resourcing">{t(($) => $.trips.drawer.tabs.resourcing)}</TabsTrigger>
            <TabsTrigger value="acceptance">{t(($) => $.trips.drawer.tabs.acceptance)}</TabsTrigger>
            <TabsTrigger value="timeline">{t(($) => $.trips.drawer.tabs.timeline)}</TabsTrigger>
            <TabsTrigger value="money">{t(($) => $.trips.drawer.tabs.money)}</TabsTrigger>
            <TabsTrigger value="orders">{t(($) => $.trips.execution.tabs.orders)}</TabsTrigger>
            <TabsTrigger value="stops">{t(($) => $.trips.execution.tabs.stops)}</TabsTrigger>
            <TabsTrigger value="custody">{t(($) => $.trips.execution.custody.tab)}</TabsTrigger>
            <TabsTrigger value="exceptions">
              {t(($) => $.trips.execution.tabs.exceptions)}
            </TabsTrigger>
            <TabsTrigger value="returns">{t(($) => $.trips.execution.tabs.returns)}</TabsTrigger>
            <TabsTrigger value="routing">{t(($) => $.trips.routing.tab)}</TabsTrigger>
            <TabsTrigger value="payments">
              {t(($) => $.trips.settlement.tabs.payments)}
            </TabsTrigger>
            <TabsTrigger value="settlement">
              {t(($) => $.trips.settlement.tabs.settlement)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-5">
            <Grid>
              <Field label={t(($) => $.trips.drawer.overview.tripNumber)} value={trip.trip_number} />
              <Field label={t(($) => $.trips.drawer.overview.name)} value={trip.name} />
              <Field label={t(($) => $.trips.drawer.overview.type)} value={t(TYPE_LABEL[trip.type])} />
              <Field
                label={t(($) => $.trips.drawer.overview.status)}
                value={<TripStatusBadge status={trip.status} />}
              />
              <Field label={t(($) => $.trips.drawer.overview.capacity)} value={trip.capacity} />
              <Field label={t(($) => $.trips.drawer.overview.orders)} value={trip.orders_count} />
              <Field
                label={t(($) => $.trips.drawer.overview.remaining)}
                value={trip.remaining_capacity}
              />
              <Field
                label={t(($) => $.trips.drawer.overview.notes)}
                value={trip.notes ?? t(($) => $.trips.drawer.timeline.none)}
              />
            </Grid>

            <div className="flex flex-wrap gap-2">
              {trip.is_editable && (
                <Badge variant="outline">{t(($) => $.trips.drawer.overview.editable)}</Badge>
              )}
              {trip.is_terminal && (
                <Badge variant="secondary">{t(($) => $.trips.drawer.overview.terminal)}</Badge>
              )}
              <Badge variant="outline">
                {t(($) => $.trips.counts.stops)}: {trip.stops_count ?? 0}
              </Badge>
              <Badge variant="outline">
                {t(($) => $.trips.counts.custody)}: {trip.custody_count ?? 0}
              </Badge>
              <Badge variant="outline">
                {t(($) => $.trips.counts.exceptions)}: {trip.exceptions_count ?? 0}
              </Badge>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t(($) => $.trips.drawer.readiness.title)}</h3>
              <Readiness tripId={trip.id} />
            </div>

            {can('logistics.distribution.update') && <StatusTransition trip={trip} />}

          </TabsContent>

          <TabsContent value="resourcing" className="flex flex-col gap-4">
            <Grid>
              <Field
                label={t(($) => $.trips.drawer.resourcing.shippingCompany)}
                value={trip.shipping_company_name ?? t(($) => $.trips.drawer.resourcing.none)}
              />
              <Field
                label={t(($) => $.trips.drawer.resourcing.driver)}
                value={trip.driver?.full_name ?? t(($) => $.trips.drawer.resourcing.none)}
              />
              <Field
                label={t(($) => $.trips.drawer.resourcing.mobile)}
                value={trip.driver?.mobile ?? t(($) => $.trips.drawer.resourcing.none)}
              />
              <Field
                label={t(($) => $.trips.drawer.resourcing.licenceStatus)}
                value={trip.driver?.license_status ?? t(($) => $.trips.drawer.resourcing.none)}
              />
              <Field
                label={t(($) => $.trips.drawer.resourcing.vehicle)}
                value={trip.vehicle?.label ?? t(($) => $.trips.drawer.resourcing.none)}
              />
              <Field
                label={t(($) => $.trips.drawer.resourcing.plate)}
                value={trip.vehicle?.plate_number ?? t(($) => $.trips.drawer.resourcing.none)}
              />
            </Grid>
            <p className="text-xs text-muted-foreground">{t(($) => $.trips.drawer.resourcing.note)}</p>
          </TabsContent>

          <TabsContent value="acceptance" className="flex flex-col gap-4">
            {trip.driver_acceptance_at === null ? (
              <p className="text-sm text-muted-foreground">
                {t(($) => $.trips.drawer.acceptance.pending)}
              </p>
            ) : (
              <Grid>
                <Field
                  label={t(($) => $.trips.drawer.acceptance.products)}
                  value={<YesNo value={trip.driver_accepted_products} />}
                />
                <Field
                  label={t(($) => $.trips.drawer.acceptance.custody)}
                  value={<YesNo value={trip.driver_accepted_custody} />}
                />
                <Field
                  label={t(($) => $.trips.drawer.acceptance.equipment)}
                  value={<YesNo value={trip.driver_accepted_equipment} />}
                />
                <Field
                  label={t(($) => $.trips.drawer.acceptance.full)}
                  value={<YesNo value={trip.has_full_driver_acceptance} />}
                />
                <Field
                  label={t(($) => $.trips.drawer.acceptance.at)}
                  value={dateTime(trip.driver_acceptance_at)}
                />
                <Field
                  label={t(($) => $.trips.drawer.acceptance.discrepancy)}
                  value={<YesNo value={trip.has_discrepancy} />}
                />
              </Grid>
            )}

            {trip.discrepancy_notes && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t(($) => $.trips.drawer.acceptance.discrepancyNotes)}
                </span>
                <p className="rounded-md border p-3 text-sm">{trip.discrepancy_notes}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="timeline">
            <Grid>
              <Field
                label={t(($) => $.trips.drawer.timeline.finalized)}
                value={dateTime(trip.finalized_at)}
              />
              <Field
                label={t(($) => $.trips.drawer.timeline.dispatched)}
                value={dateTime(trip.dispatched_at)}
              />
              <Field
                label={t(($) => $.trips.drawer.timeline.driverNotified)}
                value={dateTime(trip.driver_notified_at)}
              />
              <Field
                label={t(($) => $.trips.drawer.timeline.departure)}
                value={dateTime(trip.departure_at)}
              />
              <Field
                label={t(($) => $.trips.drawer.timeline.started)}
                value={dateTime(trip.trip_started_at)}
              />
              <Field
                label={t(($) => $.trips.drawer.timeline.finished)}
                value={dateTime(trip.trip_finished_at)}
              />
              <Field
                label={t(($) => $.trips.drawer.timeline.odometerStart)}
                value={trip.odometer_start ?? t(($) => $.trips.drawer.timeline.none)}
              />
              <Field
                label={t(($) => $.trips.drawer.timeline.odometerEnd)}
                value={trip.odometer_end ?? t(($) => $.trips.drawer.timeline.none)}
              />
              <Field
                label={t(($) => $.trips.drawer.timeline.created)}
                value={dateTime(trip.created_at)}
              />
              <Field
                label={t(($) => $.trips.drawer.timeline.updated)}
                value={dateTime(trip.updated_at)}
              />
            </Grid>
          </TabsContent>

          <TabsContent value="orders">
            <TripOrdersTab tripId={trip.id} />
          </TabsContent>

          <TabsContent value="stops">
            <TripStopsTab tripId={trip.id} />
          </TabsContent>

          <TabsContent value="custody">
            <TripCustodyTab tripId={trip.id} />
          </TabsContent>

          <TabsContent value="exceptions">
            <TripExceptionsTab tripId={trip.id} />
          </TabsContent>

          <TabsContent value="returns">
            <TripReturnsTab tripId={trip.id} />
          </TabsContent>

          <TabsContent value="routing">
            <TripRoutingTab tripId={trip.id} />
          </TabsContent>

          <TabsContent value="payments">
            <TripPaymentsTab tripId={trip.id} />
          </TabsContent>

          <TabsContent value="settlement">
            <TripSettlementTab tripId={trip.id} />
          </TabsContent>

          <TabsContent value="money" className="flex flex-col gap-4">
            <Grid>
              <Field
                label={t(($) => $.trips.drawer.money.collection)}
                value={money(trip.collection_amount)}
              />
              <Field
                label={t(($) => $.trips.drawer.money.cash)}
                value={money(trip.total_cash_collected)}
              />
              <Field
                label={t(($) => $.trips.drawer.money.bank)}
                value={money(trip.total_bank_transfers)}
              />
              <Field
                label={t(($) => $.trips.drawer.money.alreadyPaid)}
                value={money(trip.total_already_paid)}
              />
            </Grid>
            <p className="text-xs text-muted-foreground">{t(($) => $.trips.drawer.money.note)}</p>
          </TabsContent>
        </Tabs>
      )}
    </PageDrawer>
  );
}
