import { useState } from 'react';
import { Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DeparturePayload } from '../types/distribution-board';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripType: string;
  onDispatch: (payload: DeparturePayload) => void;
  isPending: boolean;
}

export function DepartureDialog({ open, onOpenChange, tripType, onDispatch, isPending }: Props) {
  const isCompanyVehicle = tripType === 'company_vehicle';

  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel]         = useState('');
  const [notes, setNotes]       = useState('');

  function handleDispatch() {
    onDispatch({
      odometer_start: odometer ? parseInt(odometer, 10) : undefined,
      fuel_level:     fuel ? parseFloat(fuel) : undefined,
      notes:          notes.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Dispatch Vehicle
          </DialogTitle>
          <DialogDescription>
            Record departure information. GPS tracking will start automatically upon dispatch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isCompanyVehicle && (
            <div className="space-y-1.5">
              <Label htmlFor="odometer">Odometer Reading (km)</Label>
              <Input
                id="odometer"
                type="number"
                min="0"
                placeholder="e.g. 45320"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fuel">Fuel Level (%)</Label>
            <Input
              id="fuel"
              type="number"
              min="0"
              max="100"
              step="5"
              placeholder="e.g. 85"
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes at departure..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/40 border">
            Dispatching will set the trip status to <strong>Out for Delivery</strong> and start GPS tracking.
            This action cannot be undone.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleDispatch} disabled={isPending} className="gap-2">
            <Truck className="h-4 w-4" />
            {isPending ? 'Dispatching…' : 'Dispatch Vehicle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
