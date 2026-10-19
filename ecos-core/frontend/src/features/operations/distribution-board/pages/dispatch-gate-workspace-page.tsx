import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  History,
  MapPin,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDispatchGateWorkspace, useDriverAcceptTrip, useDispatchVehicle } from '../hooks/use-dispatch-gate';
import { TripReviewPanel } from '../components/trip-review-panel';
import { DriverAcceptanceForm } from '../components/driver-acceptance-form';
import { DispatchChecklistPanel } from '../components/dispatch-checklist-panel';
import { DepartureDialog } from '../components/departure-dialog';
import { AuditTrailList } from '../components/audit-trail-list';
import { TRIP_STATUS_LABELS, TRIP_STATUS_COLORS } from '../types/distribution-board';
import { ROUTES } from '@/router/routes';
import { cn } from '@/lib/utils';

type Tab = 'review' | 'acceptance' | 'dispatch' | 'history';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'review',     label: 'Trip Review',    icon: ClipboardList },
  { id: 'acceptance', label: 'Driver Acceptance', icon: CheckCircle2 },
  { id: 'dispatch',   label: 'Dispatch',       icon: Truck },
  { id: 'history',    label: 'Audit Log',      icon: History },
];

export function DispatchGateWorkspacePage() {
  const { currency } = useFormatter();
  const { tripId }  = useParams<{ tripId: string }>();
  const navigate    = useNavigate();
  const [tab, setTab] = useState<Tab>('review');
  const [departureOpen, setDepartureOpen] = useState(false);

  const { data, isLoading, isError } = useDispatchGateWorkspace(tripId ?? null);
  const acceptMut   = useDriverAcceptTrip(tripId ?? '');
  const dispatchMut = useDispatchVehicle(tripId ?? '');

  if (isLoading) {
    return (
      <div className="flex flex-col h-full gap-3 p-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-10 w-96" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Trip not found or access denied.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.dispatchGate)}>
          Back to Dispatch Gate
        </Button>
      </div>
    );
  }

  const { trip, manifest_summary, custody_summary, checklist, audit_trail } = data;

  const statusLabel = TRIP_STATUS_LABELS[trip.status] ?? trip.status;
  const statusColor = TRIP_STATUS_COLORS[trip.status] ?? 'bg-muted text-muted-foreground';

  const canDispatchVehicle = trip.status === 'driver_accepted' && checklist.can_dispatch;
  const isDispatched       = trip.status === 'out_for_delivery' || trip.status === 'dispatched';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/95 backdrop-blur shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -ml-1 shrink-0"
          onClick={() => navigate(ROUTES.dispatchGate)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
          <ShieldCheck className="h-4 w-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{trip.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{trip.trip_number}</span>
            <Badge className={cn('text-xs h-4 px-1.5', statusColor)}>{statusLabel}</Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {trip.zone_name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {trip.zone_name}
              </span>
            )}
            {trip.wave_number && <span>· {trip.wave_number}</span>}
            {trip.driver_display !== 'No Driver' && <span>· {trip.driver_display}</span>}
          </div>
        </div>

        {/* Header KPIs */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <div className="text-xs px-2 py-1 rounded-md bg-muted border">
            <span className="text-muted-foreground">Orders </span>
            <span className="font-semibold">{trip.orders_count}</span>
          </div>
          <div className="text-xs px-2 py-1 rounded-md bg-muted border">
            <span className="text-muted-foreground">{currency}</span>
            <span className="font-semibold">
              {trip.collection_amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Dispatch button (shown when ready) */}
        {canDispatchVehicle && (
          <Button
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => setDepartureOpen(true)}
          >
            <Truck className="h-3.5 w-3.5" />
            Dispatch Vehicle
          </Button>
        )}

        {isDispatched && (
          <Badge className="shrink-0 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 text-xs">
            Out for Delivery
          </Badge>
        )}
      </div>

      {/* Tab nav */}
      <div className="flex border-b shrink-0 bg-muted/20">
        {TABS.map(({ id, label, icon: Icon }) => {
          const hasBadge = (id === 'acceptance' && trip.status === 'dispatch_blocked')
            || (id === 'dispatch' && checklist.can_dispatch && !isDispatched);

          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                tab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {hasBadge && (
                <span className="h-2 w-2 rounded-full bg-red-500 ml-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'review' && (
          <TripReviewPanel
            manifest={manifest_summary}
            custody={custody_summary}
          />
        )}

        {tab === 'acceptance' && (
          <DriverAcceptanceForm
            tripId={trip.id}
            tripStatus={trip.status}
            driverAcceptedProducts={trip.driver_accepted_products}
            driverAcceptedCustody={trip.driver_accepted_custody}
            driverAcceptedEquipment={trip.driver_accepted_equipment}
            driverAcceptanceAt={trip.driver_acceptance_at}
            acceptingUserName={trip.accepting_user_name}
            hasDiscrepancy={trip.has_discrepancy}
            discrepancyNotes={trip.discrepancy_notes}
            onAccept={(payload) => acceptMut.mutate(payload)}
            isPending={acceptMut.isPending}
          />
        )}

        {tab === 'dispatch' && (
          <div className="space-y-6">
            <DispatchChecklistPanel checklist={checklist} />

            {isDispatched && trip.departure_at && (
              <div className="p-4 rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div className="font-semibold text-sm text-indigo-700 dark:text-indigo-300 mb-2">
                  Vehicle Dispatched
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Departure Time</span>
                    <div className="font-medium">{new Date(trip.departure_at).toLocaleString('en-US')}</div>
                  </div>
                  {trip.odometer_start != null && (
                    <div>
                      <span className="text-muted-foreground">Odometer</span>
                      <div className="font-medium">{trip.odometer_start.toLocaleString('en-US')} km</div>
                    </div>
                  )}
                  {trip.fuel_level != null && (
                    <div>
                      <span className="text-muted-foreground">Fuel Level</span>
                      <div className="font-medium">{trip.fuel_level}%</div>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">GPS</span>
                    <div className="font-medium text-emerald-600 dark:text-emerald-400">
                      {trip.gps_tracking_started ? 'Active' : 'Not Started'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {canDispatchVehicle && (
              <Button
                className="w-full gap-2"
                size="lg"
                onClick={() => setDepartureOpen(true)}
              >
                <Truck className="h-4 w-4" />
                Dispatch Vehicle
              </Button>
            )}
          </div>
        )}

        {tab === 'history' && (
          <AuditTrailList entries={audit_trail} />
        )}
      </div>

      {/* Departure dialog */}
      <DepartureDialog
        open={departureOpen}
        onOpenChange={setDepartureOpen}
        tripType={trip.type}
        onDispatch={(payload) => {
          dispatchMut.mutate(payload, { onSuccess: () => setDepartureOpen(false) });
        }}
        isPending={dispatchMut.isPending}
      />
    </div>
  );
}
