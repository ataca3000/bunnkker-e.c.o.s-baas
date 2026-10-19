import { useState } from 'react';
import { CheckCircle2, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CUSTODY_ITEM_LABELS } from '../types/distribution-board';
import type { HandoverCustody, HandoverCustodyItem } from '../types/distribution-board';

interface DriverCustodyConfirmationProps {
  custody: HandoverCustody;
  onConfirm: (custodyId: number, receivedQty: number) => void;
  confirmPending: boolean;
}

function CustodyRow({
  item,
  onConfirm,
  confirmPending,
}: {
  item: HandoverCustodyItem;
  onConfirm: (id: number, qty: number) => void;
  confirmPending: boolean;
}) {
  const [receivedQty, setReceivedQty] = useState(
    item.received_quantity !== null ? String(item.received_quantity) : String(item.quantity),
  );

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
      item.is_driver_confirmed
        ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/40 dark:bg-emerald-950/10'
        : 'border-border bg-card',
    )}>
      {/* Status */}
      <div className="shrink-0">
        {item.is_driver_confirmed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
        )}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {CUSTODY_ITEM_LABELS[item.item_type] ?? item.label}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span>Assigned: <span className="font-semibold tabular-nums text-foreground">{item.quantity}</span></span>
          {item.received_quantity !== null && (
            <span>Received: <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{item.received_quantity}</span></span>
          )}
        </div>
      </div>

      {/* Confirm input */}
      {!item.is_driver_confirmed && (
        <div className="flex items-center gap-1.5 shrink-0">
          <Input
            type="number"
            min={0}
            value={receivedQty}
            onChange={(e) => setReceivedQty(e.target.value)}
            className="h-7 w-20 text-xs"
          />
          <Button
            size="sm"
            className="h-7 text-xs px-2 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={confirmPending}
            onClick={() => onConfirm(item.id, parseInt(receivedQty) || 0)}
          >
            {confirmPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            Confirm
          </Button>
        </div>
      )}

      {item.is_driver_confirmed && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
          Confirmed
        </span>
      )}
    </div>
  );
}

export function DriverCustodyConfirmation({
  custody,
  onConfirm,
  confirmPending,
}: DriverCustodyConfirmationProps) {
  if (custody.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Package className="h-8 w-8 text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">No custody items assigned to this trip.</p>
      </div>
    );
  }

  const pending   = custody.items.filter((i) => !i.is_driver_confirmed);
  const confirmed = custody.items.filter((i) => i.is_driver_confirmed);

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Custody Handover</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${custody.total === 0 ? 0 : Math.round((custody.confirmed / custody.total) * 100)}%` }}
          />
        </div>
        <span className="tabular-nums text-xs font-medium">{custody.confirmed}/{custody.total}</span>
      </div>

      {pending.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Awaiting Confirmation
          </h4>
          <div className="space-y-2">
            {pending.map((item) => (
              <CustodyRow key={item.id} item={item} onConfirm={onConfirm} confirmPending={confirmPending} />
            ))}
          </div>
        </section>
      )}

      {confirmed.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide">
            Confirmed ({confirmed.length})
          </h4>
          <div className="space-y-2">
            {confirmed.map((item) => (
              <CustodyRow key={item.id} item={item} onConfirm={onConfirm} confirmPending={confirmPending} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
