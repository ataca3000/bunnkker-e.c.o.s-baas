import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import {
  useApproveTrip,
  useAutoFillTrip,
  useDeleteTrip,
  useRemoveOrderFromTrip,
  useTripOrders,
} from '../hooks/use-distribution-board';
import { TRIP_STATUS_COLORS, TRIP_STATUS_LABELS, TRIP_TYPE_LABELS, type DistributionTrip, type TripOrder } from '../types/distribution-board';
import { CapacityIndicator } from './capacity-indicator';
import { ResourceAssignmentPanel } from './resource-assignment-panel';
import { CustodyPanel } from './custody-panel';
import { CoverageMap } from './coverage-map';
import { MoveOrderDialog } from './move-order-dialog';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/router/routes';

interface TripCardProps {
  trip: DistributionTrip;
  onEdit: (trip: DistributionTrip) => void;
  allTrips: DistributionTrip[];
}


export function TripCard({ trip, onEdit, allTrips }: TripCardProps) {
  const { money } = useFormatter();
  const navigate = useNavigate();
  const [expanded, setExpanded]     = useState(true);
  const [showOrders, setShowOrders] = useState(false);
  const [moveOrder, setMoveOrder]   = useState<TripOrder | null>(null);
  const autoFill    = useAutoFillTrip();
  const deleteTrip  = useDeleteTrip();
  const removeOrder = useRemoveOrderFromTrip();
  const approveTrip = useApproveTrip();
  const tripOrders  = useTripOrders(showOrders ? trip.id : null);

  const isPlanning          = trip.status === 'planning';
  const isLoading           = trip.status === 'loading';
  const isReadyForDispatch  = trip.status === 'ready_for_dispatch';

  const typeColors: Record<string, string> = {
    company_vehicle:  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    personal_vehicle: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    external_carrier: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  };

  const borderClass = isReadyForDispatch
    ? 'border-emerald-300 dark:border-emerald-700'
    : (trip.is_ready_for_loading && isPlanning)
      ? 'border-blue-200 dark:border-blue-800'
      : '';

  return (
    <>
      <div className={cn(
        'rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md',
        borderClass,
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 p-3 pb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">{trip.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{trip.trip_number}</span>
              <span className={cn('text-xs px-1.5 py-0.5 rounded-md font-medium', typeColors[trip.type])}>
                {TRIP_TYPE_LABELS[trip.type]}
              </span>
              {trip.status !== 'planning' && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-md font-medium',
                  TRIP_STATUS_COLORS[trip.status] ?? 'bg-muted text-muted-foreground',
                )}>
                  {TRIP_STATUS_LABELS[trip.status] ?? trip.status}
                </span>
              )}
            </div>
            <CapacityIndicator
              current={trip.orders_count}
              capacity={trip.capacity}
              status={trip.capacity_status}
              className="mt-1.5"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {isPlanning && trip.distribution_zone_id && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 px-2"
                onClick={() => autoFill.mutate(trip.id)}
                disabled={autoFill.isPending || trip.orders_count >= trip.capacity}
                title="Auto-fill from zone orders"
              >
                <Sparkles className="h-3 w-3" />
                Auto-fill
              </Button>
            )}

            {/* Approve Trip */}
            {isPlanning && trip.is_ready_for_loading && trip.orders_count > 0 && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1 px-2 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  if (confirm(`Approve trip "${trip.name}" for loading? A loading manifest will be created automatically.`)) {
                    approveTrip.mutate(trip.id);
                  }
                }}
                disabled={approveTrip.isPending}
                title="Approve Trip — Create Loading Manifest"
              >
                {approveTrip.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                Approve
              </Button>
            )}

            {/* Coverage Map */}
            {trip.orders_count > 0 && (
              <CoverageMap tripId={trip.id} tripNumber={trip.trip_number} />
            )}

            {/* Open Loading Workspace (when in loading / ready_for_dispatch status) */}
            {(isLoading || isReadyForDispatch) && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 px-2"
                onClick={() => navigate(`${ROUTES.loadingWorkspace}/${trip.id}/loading`)}
                title="Open Loading Workspace"
              >
                <ClipboardList className="h-3 w-3" />
                Workspace
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isPlanning && (
                  <DropdownMenuItem onClick={() => onEdit(trip)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Edit Trip
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {isPlanning && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete trip "${trip.name}"? All orders will be unassigned.`)) {
                        deleteTrip.mutate(trip.id);
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Trip
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Collection amount */}
        <div className="px-3 pb-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>Collection:</span>
          <span className="font-semibold tabular-nums text-foreground">
            {money(trip.collection_amount)}
          </span>
          {isReadyForDispatch && (
            <span className="ms-auto flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3 w-3" />
              {TRIP_STATUS_LABELS.ready_for_dispatch}
            </span>
          )}
        </div>

        {/* Expanded body */}
        {expanded && (
          <>
            <Separator />
            <div className="p-3 space-y-3">
              {/* Resource assignment — only editable in planning */}
              <ResourceAssignmentPanel trip={trip} />

              <Separator />

              {/* Custody items */}
              <CustodyPanel tripId={trip.id} items={trip.custody_items} />
            </div>

            {/* Orders toggle */}
            {trip.orders_count > 0 && (
              <>
                <Separator />
                <div className="px-3 py-2">
                  <button
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowOrders((v) => !v)}
                  >
                    {showOrders ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {trip.orders_count} order{trip.orders_count !== 1 ? 's' : ''} assigned
                  </button>

                  {showOrders && (
                    <div className="mt-2">
                      {tripOrders.isLoading ? (
                        <p className="text-xs text-muted-foreground">Loading…</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto">
                          <div className="space-y-1 pr-2">
                            {(tripOrders.data?.orders ?? []).map((order) => (
                              <div
                                key={order.order_id}
                                className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-muted/50 group"
                              >
                                <div className="min-w-0">
                                  <span className="text-xs font-mono text-primary">#{order.order_number}</span>
                                  <span className="text-xs text-muted-foreground ml-2 truncate">{order.city_name}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-xs tabular-nums">
                                    {money(Number(order.grand_total))}
                                  </span>
                                  {isPlanning && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                        onClick={() => setMoveOrder(order)}
                                        title="Move / Return to Wave"
                                      >
                                        <ArrowRightLeft className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                        onClick={() => removeOrder.mutate({ tripId: trip.id, orderId: order.order_id })}
                                        disabled={removeOrder.isPending}
                                        title="Unassign from Trip"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Move / Return dialog */}
      <MoveOrderDialog
        open={moveOrder !== null}
        onClose={() => setMoveOrder(null)}
        order={moveOrder}
        currentTripId={trip.id}
        trips={allTrips}
      />
    </>
  );
}
