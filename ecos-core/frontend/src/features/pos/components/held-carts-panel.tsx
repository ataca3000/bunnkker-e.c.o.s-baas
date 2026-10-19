import { PauseCircle, Trash2, User, X, RotateCcw } from 'lucide-react';
import { useFormatter } from '@/hooks/use-formatter';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { usePosStore, type HeldCartSnapshot } from '@/features/pos/store/pos-store';
import { useResumeCart, useDeleteHeldCart } from '@/features/pos/hooks/use-pos-queries';

type HeldCartsPanelProps = {
  onClose: () => void;
  onResumed: () => void;
};

function formatHeldAt(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

type HeldCartCardProps = {
  snapshot: HeldCartSnapshot;
  onResumed: () => void;
};

function HeldCartCard({ snapshot, onResumed }: HeldCartCardProps) {
  const { money } = useFormatter();
  const resumeCart = useResumeCart();
  const deleteCart = useDeleteHeldCart();

  const isBusy = resumeCart.isPending || deleteCart.isPending;

  async function handleResume() {
    await resumeCart.mutateAsync(snapshot.cartId);
    onResumed();
  }

  async function handleDelete() {
    await deleteCart.mutateAsync(snapshot.cartId);
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <User className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium truncate">
            {snapshot.customerName ?? 'No customer'}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {formatHeldAt(snapshot.heldAt)}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {snapshot.lineCount} item{snapshot.lineCount !== 1 ? 's' : ''}
        </span>
        <span className="font-semibold text-foreground tabular-nums">
          {money(Number(snapshot.total), snapshot.currency)}
        </span>
      </div>

      <div className="flex gap-1.5 pt-0.5">
        <Button
          size="sm"
          className="flex-1 h-8 gap-1.5 text-xs"
          onClick={handleResume}
          disabled={isBusy}
        >
          <RotateCcw className="size-3.5" />
          Resume
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
          title="Delete held cart"
          onClick={handleDelete}
          disabled={isBusy}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function HeldCartsPanel({ onClose, onResumed }: HeldCartsPanelProps) {
  const heldCartSnapshots = usePosStore((s) => s.heldCartSnapshots);

  // Reverse-chronological: most recently held first
  const sorted = [...heldCartSnapshots].reverse();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <PauseCircle className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Held Carts</span>
          {sorted.length > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
              {sorted.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          title="Close (Esc)"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <Separator />

      {/* Cart list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center text-muted-foreground">
            <PauseCircle className="size-8 opacity-30" />
            <p className="text-xs">No held carts</p>
            <p className="text-[10px] opacity-70">
              Press <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">F9</kbd> to hold the current cart
            </p>
          </div>
        ) : (
          sorted.map((snapshot) => (
            <HeldCartCard
              key={snapshot.cartId}
              snapshot={snapshot}
              onResumed={onResumed}
            />
          ))
        )}
      </div>
    </div>
  );
}
