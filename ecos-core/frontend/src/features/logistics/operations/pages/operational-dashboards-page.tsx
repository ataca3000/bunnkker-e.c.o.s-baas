import { Activity, Gauge, Layers, Truck, Users } from 'lucide-react';

import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  useCapacityDashboard,
  useDispatchDashboard,
  useDriverDashboard,
  useFleetDashboard,
  useKpiDashboard,
} from '../hooks/use-operations-analytics';

function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'No data yet';
  return `${Math.round(value * 100)}%`;
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'bad'
      ? 'text-destructive'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'good'
          ? 'text-emerald-600'
          : '';

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

/**
 * A utilisation bar with the snapshot caveat baked in — the figure is
 * "in use right now ÷ available right now", never a projection.
 */
function UtilisationBar({ value }: { value: number | null }) {
  if (value === null) {
    return <p className="text-sm text-muted-foreground">No assignable resources to measure.</p>;
  }

  const capped = Math.min(1, Math.max(0, value));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">In use now</span>
        <span className="tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${capped >= 0.85 ? 'bg-amber-500' : 'bg-emerald-600'}`}
          style={{ width: `${capped * 100}%` }}
        />
      </div>
    </div>
  );
}

function FleetTab() {
  const { data, isLoading } = useFleetDashboard();

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card label="Total vehicles" value={data.total_vehicles} />
        <Card label="Assignable" value={data.assignable} tone="good" />
        <Card label="Unfit" value={data.unfit} tone={data.unfit > 0 ? 'warn' : undefined} />
        <Card label="In use now" value={data.in_use_now} />
      </div>

      <Panel title="Fleet utilisation (snapshot)">
        <UtilisationBar value={data.utilisation_now} />
        <p className="mt-2 text-xs text-muted-foreground">
          {data.idle_assignable} assignable vehicle{data.idle_assignable === 1 ? '' : 's'} idle
          right now.
        </p>
      </Panel>

      {/* BO-1: an idle vehicle nobody noticed is pure loss. Named, not counted. */}
      <Panel title={`Idle vehicles (${data.idle_vehicles.length})`}>
        {data.idle_vehicles.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Every assignable vehicle is working.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.idle_vehicles.map((v) => (
              <Badge key={v.vehicle_id} variant="outline" className="text-xs">
                {v.plate_number ?? `#${v.vehicle_id}`}
              </Badge>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function DriverTab() {
  const { data, isLoading } = useDriverDashboard();

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card label="Total drivers" value={data.total_drivers} />
        <Card label="Available" value={data.available} tone="good" />
        <Card
          label="Unavailable"
          value={data.unavailable}
          tone={data.unavailable > 0 ? 'warn' : undefined}
        />
        <Card label="In use now" value={data.in_use_now} />
      </div>

      <Panel title="Driver utilisation (snapshot)">
        <UtilisationBar value={data.utilisation_now} />
        <p className="mt-2 text-xs text-muted-foreground">
          {data.idle_available} available driver{data.idle_available === 1 ? '' : 's'} idle right
          now.
        </p>
      </Panel>

      <Panel title={`Idle drivers (${data.idle_drivers.length})`}>
        {data.idle_drivers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Every available driver is working.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.idle_drivers.map((d) => (
              <Badge key={d.driver_id} variant="outline" className="text-xs">
                {d.full_name ?? d.driver_code ?? `#${d.driver_id}`}
              </Badge>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function CapacityTab() {
  const { data, isLoading } = useCapacityDashboard();

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Slots today (owned by Network)">
        <div className="space-y-1.5 text-xs">
          <Row label="Slots" value={data.slots.slot_count} />
          <Row label="Average utilisation" value={pct(data.slots.avg_utilisation)} />
          <Row label="Near capacity" value={data.slots.at_warn_threshold} />
          <Row label="Exhausted" value={data.slots.exhausted} />
        </div>
      </Panel>
      <Panel title="Our reservations">
        <div className="space-y-1.5 text-xs">
          <Row label="Requested" value={data.reservations.requested} />
          <Row label="Currently holding" value={data.reservations.currently_holding} />
          <Row label="Confirmed" value={data.reservations.confirmed} />
          <Row label="Refused" value={data.reservations.refused} />
          <Row label="Refusal rate" value={pct(data.reservations.refusal_rate)} />
        </div>
      </Panel>
    </div>
  );
}

function DispatchTab() {
  const { data, isLoading } = useDispatchDashboard();

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card label="Active sessions" value={data.kpis.sessions_active} tone="good" />
        <Card label="Confirmed" value={data.kpis.allocations_confirmed} />
        <Card label="Confirmation rate" value={pct(data.kpis.confirmation_rate)} />
        <Card label="Automatic share" value={pct(data.kpis.automatic_share)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Queue">
          <div className="space-y-1.5 text-xs">
            <Row label="Depth" value={data.queue.depth} />
            <Row label="Needs action" value={data.queue.needs_action} />
            <Row label="Stuck" value={data.queue.stuck} />
            <Row
              label="Average wait"
              value={
                data.queue.avg_wait_minutes !== null ? `${data.queue.avg_wait_minutes} min` : '—'
              }
            />
          </div>
        </Panel>
        <Panel title="Cycle time">
          <div className="space-y-1.5 text-xs">
            <Row
              label="Average session"
              value={
                data.kpis.avg_session_minutes !== null
                  ? `${data.kpis.avg_session_minutes} min`
                  : 'No data yet'
              }
            />
            <Row label="Attempted" value={data.kpis.allocations_attempted} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function KpiTab() {
  const { data, isLoading } = useKpiDashboard();

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      {data.is_quiet && (
        <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-4 text-sm text-emerald-700 dark:text-emerald-400">
          The operation is healthy — nothing needs a person right now.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card
          label="Critical alerts"
          value={data.headline.critical_alerts}
          tone={data.headline.critical_alerts > 0 ? 'bad' : undefined}
        />
        <Card
          label="Needs attention"
          value={data.headline.open_exceptions}
          tone={data.headline.open_exceptions > 0 ? 'warn' : undefined}
        />
        <Card
          label="Unhealthy pools"
          value={data.headline.unhealthy_pools}
          tone={data.headline.unhealthy_pools > 0 ? 'warn' : undefined}
        />
        <Card label="Can field today" value={data.headline.fieldable_units} tone="good" />
        <Card
          label="Exhausted slots"
          value={data.headline.exhausted_capacity_slots}
          tone={data.headline.exhausted_capacity_slots > 0 ? 'warn' : undefined}
        />
        <Card
          label="Overdue escalations"
          value={data.headline.overdue_escalations}
          tone={data.headline.overdue_escalations > 0 ? 'bad' : undefined}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Pools">
          <div className="space-y-1.5 text-xs">
            <Row label="Total" value={data.pools.total} />
            <Row label="Unhealthy" value={data.pools.unhealthy} />
            <Row label="Available vehicles" value={data.pools.available_vehicles} />
            <Row label="Available drivers" value={data.pools.available_drivers} />
          </div>
        </Panel>
        <Panel title="Dispatch">
          <div className="space-y-1.5 text-xs">
            <Row label="Active sessions" value={data.dispatch.sessions_active} />
            <Row label="Confirmed" value={data.dispatch.allocations_confirmed} />
            <Row label="Confirmation rate" value={pct(data.dispatch.confirmation_rate)} />
            <Row label="Automatic share" value={pct(data.dispatch.automatic_share)} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Operational Dashboards.
 *
 * Five read-only views assembled server-side from the owning modules. Every
 * utilisation figure is a snapshot; nothing here forecasts.
 */
export function OperationalDashboardsPage() {
  const { refetch, isFetching } = useKpiDashboard();

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Logistics OS' }, { label: 'Operations' }]}
        title="Operational Dashboards"
        description="Fleet, driver, capacity and dispatch utilisation — operational metrics only"
        metrics={[]}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar onRefresh={() => refetch()} isFetching={isFetching} />
          </div>
        }
      >
        <div className="px-4 pb-6 sm:px-6">
          <Tabs defaultValue="kpi" className="w-full">
            <TabsList>
              <TabsTrigger value="kpi">
                <Activity className="mr-1 size-3.5" />
                KPI
              </TabsTrigger>
              <TabsTrigger value="fleet">
                <Truck className="mr-1 size-3.5" />
                Fleet
              </TabsTrigger>
              <TabsTrigger value="drivers">
                <Users className="mr-1 size-3.5" />
                Drivers
              </TabsTrigger>
              <TabsTrigger value="capacity">
                <Gauge className="mr-1 size-3.5" />
                Capacity
              </TabsTrigger>
              <TabsTrigger value="dispatch">
                <Layers className="mr-1 size-3.5" />
                Dispatch
              </TabsTrigger>
            </TabsList>

            <TabsContent value="kpi" className="pt-4">
              <KpiTab />
            </TabsContent>
            <TabsContent value="fleet" className="pt-4">
              <FleetTab />
            </TabsContent>
            <TabsContent value="drivers" className="pt-4">
              <DriverTab />
            </TabsContent>
            <TabsContent value="capacity" className="pt-4">
              <CapacityTab />
            </TabsContent>
            <TabsContent value="dispatch" className="pt-4">
              <DispatchTab />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspacePage>
    </>
  );
}
