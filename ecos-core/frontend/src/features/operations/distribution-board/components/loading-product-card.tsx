import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  Package,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SHORTAGE_RESOLUTION_LABELS, type ManifestItem } from '../types/distribution-board';
import { useProductBreakdown } from '../hooks/use-loading-manifest';
import { ShortageResolutionDialog } from './shortage-resolution-dialog';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   className: 'bg-muted text-muted-foreground' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  shortage:  { label: 'Shortage',  className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  skipped:   { label: 'Skipped',   className: 'bg-slate-100 text-slate-600 dark:bg-slate-900/30' },
};

interface LoadingProductCardProps {
  manifestId: number;
  item: ManifestItem;
  onConfirm: (itemId: number, loadedQty: number) => void;
  onResolveShortage: (itemId: number, resolution: string, notes?: string) => void;
  confirmPending: boolean;
  shortageResolvePending: boolean;
}

export function LoadingProductCard({
  manifestId,
  item,
  onConfirm,
  onResolveShortage,
  confirmPending,
  shortageResolvePending,
}: LoadingProductCardProps) {
  const [loadedQty, setLoadedQty]           = useState(item.loaded_qty?.toString() ?? item.required_qty.toString());
  const [showBreakdown, setShowBreakdown]   = useState(false);
  const [resolveOpen, setResolveOpen]       = useState(false);

  const breakdown = useProductBreakdown(manifestId, showBreakdown ? item.id : null);

  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending;

  const isConfirmedOrSkipped = item.status === 'confirmed' || item.status === 'skipped';
  const hasUnresolvedShortage = item.status === 'shortage' && !item.shortage_resolution;

  return (
    <>
      <div className={cn(
        'rounded-xl border bg-card',
        item.status === 'shortage' && !item.shortage_resolution && 'border-red-300 dark:border-red-800',
        item.status === 'confirmed' && 'border-emerald-200 dark:border-emerald-900/50',
      )}>
        {/* Header */}
        <div className="flex items-center gap-3 p-3">
          <div className="p-2 rounded-md bg-muted shrink-0">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">{item.product_name}</span>
              {item.product_sku && (
                <span className="text-xs font-mono text-muted-foreground">{item.product_sku}</span>
              )}
              <Badge className={cn('text-xs h-4 px-1.5', cfg.className)}>{cfg.label}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              <span>Required: <strong>{item.required_qty} {item.unit}</strong></span>
              {item.loaded_qty !== null && (
                <span>Loaded: <strong>{item.loaded_qty} {item.unit}</strong></span>
              )}
              {item.shortage_qty && (
                <span className="text-red-500 font-medium">Shortage: {item.shortage_qty} {item.unit}</span>
              )}
            </div>
          </div>

          {/* Confirm section */}
          {!isConfirmedOrSkipped && item.status !== 'shortage' && (
            <div className="flex items-center gap-2 shrink-0">
              <Input
                type="number"
                min={0}
                step={0.1}
                value={loadedQty}
                onChange={(e) => setLoadedQty(e.target.value)}
                className="w-20 h-7 text-xs text-center"
                disabled={confirmPending}
              />
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onConfirm(item.id, parseFloat(loadedQty) || 0)}
                disabled={confirmPending || !loadedQty}
              >
                {confirmPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                Confirm
              </Button>
            </div>
          )}

          {/* Shortage resolution */}
          {hasUnresolvedShortage && (
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs gap-1 shrink-0"
              onClick={() => setResolveOpen(true)}
              disabled={shortageResolvePending}
            >
              <AlertTriangle className="h-3 w-3" />
              Resolve Shortage
            </Button>
          )}

          {/* Already resolved shortage badge */}
          {item.status === 'shortage' && item.shortage_resolution && (
            <Badge variant="outline" className="text-xs shrink-0">
              {SHORTAGE_RESOLUTION_LABELS[item.shortage_resolution as keyof typeof SHORTAGE_RESOLUTION_LABELS]}
            </Badge>
          )}

          {/* Order breakdown toggle */}
          <button
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors shrink-0"
            onClick={() => setShowBreakdown((v) => !v)}
            title="View order breakdown"
          >
            {showBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Order breakdown */}
        {showBreakdown && (
          <div className="px-3 pb-3 border-t pt-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <Users className="h-3.5 w-3.5" />
              Order Breakdown
            </div>
            {breakdown.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (breakdown.data?.breakdown ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No order line items.</p>
            ) : (
              <div className="space-y-1">
                {(breakdown.data?.breakdown ?? []).map((b) => (
                  <div key={b.order_id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/40">
                    <span className="font-mono font-medium text-primary">#{b.order_number}</span>
                    <span className="text-muted-foreground">
                      {b.quantity} {item.unit}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs px-2 py-1 font-medium border-t mt-1 pt-1">
                  <span>Total Required</span>
                  <span>{item.required_qty} {item.unit}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shortage resolution dialog */}
      <ShortageResolutionDialog
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        productName={item.product_name}
        shortageQty={item.shortage_qty ?? 0}
        unit={item.unit}
        onResolve={(resolution, notes) => {
          onResolveShortage(item.id, resolution, notes);
          setResolveOpen(false);
        }}
        isPending={shortageResolvePending}
      />
    </>
  );
}
