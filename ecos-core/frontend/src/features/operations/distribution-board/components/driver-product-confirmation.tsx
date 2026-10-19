import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { HandoverManifest, HandoverManifestItem } from '../types/distribution-board';

interface DriverProductConfirmationProps {
  manifest: HandoverManifest;
  manifestId: number;
  tripId: string;
  onConfirm: (itemId: number, receivedQty: number) => void;
  onAcceptDiscrepancy: (itemId: number, notes?: string) => void;
  confirmPending: boolean;
  acceptPending: boolean;
}

function ProductRow({
  item,
  onConfirm,
  onAcceptDiscrepancy,
  confirmPending,
  acceptPending,
}: {
  item: HandoverManifestItem;
  onConfirm: (id: number, qty: number) => void;
  onAcceptDiscrepancy: (id: number, notes?: string) => void;
  confirmPending: boolean;
  acceptPending: boolean;
}) {
  const [receivedQty, setReceivedQty] = useState(
    item.driver_received_qty !== null ? String(item.driver_received_qty) : String(item.loaded_qty ?? ''),
  );
  const [notes, setNotes] = useState('');
  const [showAccept, setShowAccept] = useState(false);

  const isConfirmed    = item.driver_status === 'confirmed' || item.driver_status === 'accepted';
  const isDiscrepancy  = item.driver_status === 'discrepancy';

  return (
    <div className={cn(
      'rounded-lg border p-3 transition-colors',
      isConfirmed   ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/40 dark:bg-emerald-950/10'  : '',
      isDiscrepancy ? 'border-amber-200 bg-amber-50/40 dark:border-amber-800/40 dark:bg-amber-950/10' : '',
      !isConfirmed && !isDiscrepancy ? 'border-border bg-card' : '',
    )}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="mt-0.5 shrink-0">
          {isConfirmed && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          {isDiscrepancy && <AlertTriangle className="h-4 w-4 text-amber-500" />}
          {item.driver_status === 'pending' && (
            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{item.product_name}</span>
            {item.product_sku && (
              <span className="text-xs text-muted-foreground font-mono">{item.product_sku}</span>
            )}
            {isDiscrepancy && (
              <Badge className="text-xs h-4 px-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                Discrepancy
              </Badge>
            )}
            {item.driver_status === 'accepted' && (
              <Badge className="text-xs h-4 px-1.5 bg-slate-100 text-slate-600 dark:bg-slate-800/40">
                Accepted
              </Badge>
            )}
          </div>

          {/* Qty line */}
          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
            <span>Loaded: <span className="font-semibold tabular-nums text-foreground">{item.loaded_qty}</span></span>
            {item.driver_received_qty !== null && (
              <span>Received: <span className={cn(
                'font-semibold tabular-nums',
                isDiscrepancy ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
              )}>{item.driver_received_qty}</span></span>
            )}
            {item.shortage_qty !== null && item.shortage_qty > 0 && (
              <span className="text-red-500">Shortage: {item.shortage_qty}</span>
            )}
          </div>

          {/* Input + confirm (only when pending) */}
          {item.driver_status === 'pending' && (
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="number"
                min={0}
                step="0.001"
                value={receivedQty}
                onChange={(e) => setReceivedQty(e.target.value)}
                className="h-8 w-28 text-sm"
                placeholder="Received quantity"
              />
              <Button
                size="sm"
                className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={confirmPending || receivedQty === ''}
                onClick={() => onConfirm(item.id, parseFloat(receivedQty) || 0)}
              >
                {confirmPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Confirm Receipt
              </Button>
            </div>
          )}

          {/* Accept discrepancy */}
          {isDiscrepancy && (
            <div className="mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 border-amber-300 dark:border-amber-800"
                onClick={() => setShowAccept((v) => !v)}
              >
                {showAccept ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Supervisor Accept Discrepancy
              </Button>

              {showAccept && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    placeholder="Discrepancy notes (optional)…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-sm resize-none h-16"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-300"
                    disabled={acceptPending}
                    onClick={() => onAcceptDiscrepancy(item.id, notes || undefined)}
                  >
                    {acceptPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Accept and Allow Dispatch
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DriverProductConfirmation({
  manifest,
  onConfirm,
  onAcceptDiscrepancy,
  confirmPending,
  acceptPending,
}: DriverProductConfirmationProps) {
  const pending      = manifest.items.filter((i) => i.driver_status === 'pending');
  const discrepancy  = manifest.items.filter((i) => i.driver_status === 'discrepancy');
  const confirmed    = manifest.items.filter((i) => i.driver_status === 'confirmed' || i.driver_status === 'accepted');

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Driver Confirmations</span>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${manifest.total_products === 0 ? 0 : Math.round((manifest.driver_confirmed / manifest.total_products) * 100)}%` }}
          />
        </div>
        <span className="tabular-nums text-xs font-medium">{manifest.driver_confirmed}/{manifest.total_products}</span>
      </div>

      {pending.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Awaiting Driver Confirmation
          </h4>
          <div className="space-y-2">
            {pending.map((item) => (
              <ProductRow
                key={item.id}
                item={item}
                onConfirm={onConfirm}
                onAcceptDiscrepancy={onAcceptDiscrepancy}
                confirmPending={confirmPending}
                acceptPending={acceptPending}
              />
            ))}
          </div>
        </section>
      )}

      {discrepancy.length > 0 && (
        <section>
          <h4 className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 uppercase tracking-wide">
            Discrepancies ({discrepancy.length})
          </h4>
          <div className="space-y-2">
            {discrepancy.map((item) => (
              <ProductRow
                key={item.id}
                item={item}
                onConfirm={onConfirm}
                onAcceptDiscrepancy={onAcceptDiscrepancy}
                confirmPending={confirmPending}
                acceptPending={acceptPending}
              />
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
              <ProductRow
                key={item.id}
                item={item}
                onConfirm={onConfirm}
                onAcceptDiscrepancy={onAcceptDiscrepancy}
                confirmPending={confirmPending}
                acceptPending={acceptPending}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
