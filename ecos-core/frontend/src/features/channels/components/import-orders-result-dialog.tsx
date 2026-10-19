import { CheckCircle2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { OrderImportResult } from '@/features/channels/types/channel';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: OrderImportResult | null;
  channelName?: string;
};

export function ImportOrdersResultDialog({ open, onOpenChange, result, channelName }: Props) {
  if (!result) return null;

  const hasErrors = result.errors.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Order Import Complete</DialogTitle>
          <DialogDescription>
            {channelName ? `Results for "${channelName}"` : 'Order import results'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Orders Processed" value={result.imported_orders} />
            <Stat label="Customers Created" value={result.created_customers} />
            <Stat label="Orders Created" value={result.created_orders} />
            <Stat label="Lines Created" value={result.created_lines} />
            <Stat label="Orders Skipped" value={result.skipped_orders} highlight={result.skipped_orders > 0} />
            <Stat label="Failed Lines" value={result.failed_lines} highlight={result.failed_lines > 0} />
          </div>

          {hasErrors && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-rose-600">
                <XCircle className="size-4" />
                Errors
              </div>
              <ul className="text-muted-foreground max-h-32 overflow-y-auto rounded-md border p-2 text-xs">
                {result.errors.map((err, i) => (
                  <li key={i} className="py-0.5">
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasErrors && result.created_orders > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="size-4" />
              All orders imported successfully.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-muted/50 flex flex-col rounded-md p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-xl font-bold ${highlight ? 'text-amber-600' : ''}`}>{value}</span>
    </div>
  );
}
