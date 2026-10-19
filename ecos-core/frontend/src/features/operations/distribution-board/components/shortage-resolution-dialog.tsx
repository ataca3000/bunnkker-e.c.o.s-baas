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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SHORTAGE_RESOLUTION_LABELS, type ShortageResolution } from '../types/distribution-board';

const RESOLUTION_DESCRIPTIONS: Record<ShortageResolution, string> = {
  priority_allocation: 'Redistribute from another order according to priority rules.',
  manual_selection:    'Supervisor manually selects which orders will receive the product.',
  return_preparation:  'Return to the preparation system to cover the shortage.',
  send_manufacturing:  'Send a production order to manufacturing.',
  delay_orders:        'Mark affected orders as delayed and notify customers.',
};

interface ShortageResolutionDialogProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  shortageQty: number;
  unit: string;
  onResolve: (resolution: ShortageResolution, notes?: string) => void;
  isPending: boolean;
}

export function ShortageResolutionDialog({
  open,
  onClose,
  productName,
  shortageQty,
  unit,
  onResolve,
  isPending,
}: ShortageResolutionDialogProps) {
  const [selected, setSelected] = useState<ShortageResolution | null>(null);
  const [notes, setNotes]       = useState('');

  const resolutions = Object.keys(SHORTAGE_RESOLUTION_LABELS) as ShortageResolution[];

  function handleSubmit() {
    if (!selected) return;
    onResolve(selected, notes || undefined);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-red-600 dark:text-red-400">Resolve Shortage</DialogTitle>
          <DialogDescription>
            <span className="font-medium">{productName}</span> — shortage of{' '}
            <span className="font-semibold text-red-600 dark:text-red-400">
              {shortageQty} {unit}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-xs text-muted-foreground">Select how to resolve this shortage:</p>

          <div className="space-y-2">
            {resolutions.map((res) => (
              <button
                key={res}
                onClick={() => setSelected(res)}
                className={cn(
                  'w-full text-start px-3 py-2.5 rounded-lg border text-sm transition-colors',
                  selected === res
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'hover:bg-muted/50',
                )}
              >
                <p className="font-medium">{SHORTAGE_RESOLUTION_LABELS[res]}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{RESOLUTION_DESCRIPTIONS[res]}</p>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional context or instructions…"
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!selected || isPending}
            onClick={handleSubmit}
          >
            Apply Resolution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
