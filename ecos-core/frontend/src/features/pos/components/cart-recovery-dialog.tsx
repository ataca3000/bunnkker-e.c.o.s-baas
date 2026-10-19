import { RotateCcw, ShoppingCart, Trash2, User } from 'lucide-react';
import { useFormatter } from '@/hooks/use-formatter';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import type { Cart } from '@/features/pos/types';

type CartRecoveryDialogProps = {
  open: boolean;
  cart: Cart;
  customerName: string | null;
  hasTenderDraft: boolean;
  onResume: () => void;
  onDiscard: () => void;
  isDiscarding: boolean;
};

export function CartRecoveryDialog({
  open,
  cart,
  customerName,
  hasTenderDraft,
  onResume,
  onDiscard,
  isDiscarding,
}: CartRecoveryDialogProps) {
  const { money } = useFormatter();
  const lineCount = cart.lines.length;
  const total = parseFloat(cart.total.amount);

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <RotateCcw className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle>Unfinished Sale Found</DialogTitle>
              <DialogDescription className="mt-0.5">
                A previous sale was interrupted. What would you like to do?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <ShoppingCart className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {lineCount} {lineCount === 1 ? 'item' : 'items'}
              </span>
            </div>
            <span className="text-base font-semibold tabular-nums">
              {money(total, cart.currency)}
            </span>
          </div>

          {(customerName ?? cart.customer_id) && (
            <>
              <Separator className="my-2.5" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="size-4" />
                <span>{customerName ?? 'Assigned Customer'}</span>
              </div>
            </>
          )}

          {hasTenderDraft && (
            <>
              <Separator className="my-2.5" />
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Previously entered payment details will be restored.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={onDiscard}
            disabled={isDiscarding}
          >
            <Trash2 className="size-4" />
            {isDiscarding ? 'Discarding...' : 'Start New Sale'}
          </Button>
          <Button className="gap-2" onClick={onResume} disabled={isDiscarding}>
            <RotateCcw className="size-4" />
            Resume Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
