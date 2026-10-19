import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMoveOrder, useReturnToWave } from '../hooks/use-distribution-board';
import type { DistributionTrip, TripOrder } from '../types/distribution-board';

interface MoveOrderDialogProps {
  open: boolean;
  onClose: () => void;
  order: TripOrder | null;
  currentTripId: string;
  trips: DistributionTrip[];
}

export function MoveOrderDialog({ open, onClose, order, currentTripId, trips }: MoveOrderDialogProps) {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [mode, setMode] = useState<'move' | 'return'>('move');

  const moveOrder    = useMoveOrder();
  const returnToWave = useReturnToWave();

  const otherTrips = trips.filter((t) => t.id !== currentTripId && t.status === 'planning');

  function handleSubmit() {
    if (!order) return;

    if (mode === 'return') {
      returnToWave.mutate(
        { tripId: currentTripId, orderId: order.order_id },
        { onSuccess: onClose },
      );
      return;
    }

    if (!selectedTripId) return;
    moveOrder.mutate(
      { fromTripId: currentTripId, toTripId: selectedTripId, orderId: order.order_id },
      { onSuccess: onClose },
    );
  }

  const isPending = moveOrder.isPending || returnToWave.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move Order #{order?.order_number}</DialogTitle>
          <DialogDescription>
            Choose where to send this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Mode selector */}
          <div className="flex rounded-md border overflow-hidden">
            <button
              className={cn(
                'flex-1 py-1.5 text-xs font-medium transition-colors',
                mode === 'move'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setMode('move')}
            >
              Move to Another Trip
            </button>
            <button
              className={cn(
                'flex-1 py-1.5 text-xs font-medium transition-colors',
                mode === 'return'
                  ? 'bg-amber-500 text-white'
                  : 'bg-transparent text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setMode('return')}
            >
              Return to Wave
            </button>
          </div>

          {mode === 'move' ? (
            otherTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No other planning trips available.
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Select destination trip:</p>
                {otherTrips.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTripId(t.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm transition-colors',
                      selectedTripId === t.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{t.trip_number}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t.orders_count}/{t.capacity} orders
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
              This order will be removed from its current trip and placed in the Wave Exception list.
              A supervisor will need to reassign it to another trip.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant={mode === 'return' ? 'destructive' : 'default'}
            disabled={(mode === 'move' && !selectedTripId) || isPending}
            onClick={handleSubmit}
          >
            {mode === 'return' ? 'Return to Wave' : 'Move Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
