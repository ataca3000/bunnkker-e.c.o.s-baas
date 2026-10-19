import { useRef, useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { ShoppingCart, PauseCircle, X, CreditCard } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CartLineRow } from '@/features/pos/components/cart-line';
import type { CartLineHandle } from '@/features/pos/components/cart-line';
import { useKeyboardShortcuts } from '@/features/pos/hooks/use-keyboard-shortcuts';
import {
  useCart,
  useUpdateCartLine,
  useRemoveCartLine,
  useHoldCart,
  useCancelCart,
} from '@/features/pos/hooks/use-pos-queries';
import { usePosStore } from '@/features/pos/store/pos-store';
import type { CartLine } from '@/features/pos/types';

type CartPanelProps = {
  onCheckout: () => void;
  onViewHeld: () => void;
};

export function CartPanel({ onCheckout, onViewHeld }: CartPanelProps) {
  const { money } = useFormatter();
  const { cartId, currency, openPayment, heldCartSnapshots } = usePosStore();

  const { data: cart } = useCart();
  const updateLine = useUpdateCartLine();
  const removeLine = useRemoveCartLine();
  const holdCart   = useHoldCart();
  const cancelCart = useCancelCart();

  const lines = cart?.lines ?? [];
  const total = cart?.total?.amount ?? '0.00';
  const currencyCode = cart?.currency ?? currency;
  const isBusy =
    updateLine.isPending || removeLine.isPending ||
    holdCart.isPending  || cancelCart.isPending;

  // ── Line selection state for keyboard navigation ────────────────────────────
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const lineHandles = useRef(new Map<string, CartLineHandle>());

  function selectedIndex(): number {
    return lines.findIndex((l: CartLine) => l.id === selectedLineId);
  }

  function selectByIndex(idx: number) {
    if (lines.length === 0) return;
    const clamped = Math.max(0, Math.min(idx, lines.length - 1));
    setSelectedLineId(lines[clamped].id);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleRemove(lineId: string) {
    if (!cartId) return;
    if (selectedLineId === lineId) {
      const idx = lines.findIndex((l: CartLine) => l.id === lineId);
      const nextId = lines[idx + 1]?.id ?? lines[idx - 1]?.id ?? null;
      setSelectedLineId(nextId);
    }
    await removeLine.mutateAsync({ cartId, lineId });
  }

  async function handleQtyChange(lineId: string, newQty: number) {
    if (!cartId) return;
    const line = lines.find((l: CartLine) => l.id === lineId);
    if (!line) return;
    await updateLine.mutateAsync({ cartId, lineId, newQty, line });
  }

  async function handleHold() {
    if (!cartId) return;
    await holdCart.mutateAsync(cartId);
  }

  async function handleCancel() {
    if (!cartId) return;
    await cancelCart.mutateAsync(cartId);
  }

  // ── Keyboard navigation shortcuts (scoped to this panel) ───────────────────
  useKeyboardShortcuts([
    {
      key: 'ArrowDown',
      description: 'Select next cart line',
      handler: () => {
        if (lines.length === 0) return;
        const idx = selectedLineId === null ? -1 : selectedIndex();
        selectByIndex(idx + 1);
      },
    },
    {
      key: 'ArrowUp',
      description: 'Select previous cart line',
      handler: () => {
        if (lines.length === 0) return;
        const idx = selectedLineId === null ? lines.length : selectedIndex();
        selectByIndex(idx - 1);
      },
    },
    {
      key: 'Enter',
      description: 'Edit quantity of selected line',
      handler: () => {
        if (selectedLineId) {
          lineHandles.current.get(selectedLineId)?.startEdit();
        }
      },
    },
    {
      key: '+',
      description: 'Increment selected line qty',
      handler: () => {
        if (!selectedLineId || !cartId) return;
        const line = lines.find((l: CartLine) => l.id === selectedLineId);
        if (line) handleQtyChange(selectedLineId, parseFloat(line.quantity) + 1);
      },
    },
    {
      key: '=',
      description: 'Increment selected line qty (no-shift +)',
      handler: () => {
        if (!selectedLineId || !cartId) return;
        const line = lines.find((l: CartLine) => l.id === selectedLineId);
        if (line) handleQtyChange(selectedLineId, parseFloat(line.quantity) + 1);
      },
    },
    {
      key: '-',
      description: 'Decrement selected line qty',
      handler: () => {
        if (!selectedLineId || !cartId) return;
        const line = lines.find((l: CartLine) => l.id === selectedLineId);
        if (!line) return;
        const newQty = parseFloat(line.quantity) - 1;
        if (newQty > 0) handleQtyChange(selectedLineId, newQty);
      },
    },
    {
      key: 'Delete',
      description: 'Remove selected line',
      handler: () => {
        if (selectedLineId) handleRemove(selectedLineId);
      },
    },
  ], lines.length > 0 && !isBusy);

  const heldCount = heldCartSnapshots.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Cart</span>
          {lines.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {lines.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="View held carts (Ctrl+H)"
            onClick={onViewHeld}
          >
            <PauseCircle className="size-3.5" />
            {heldCount > 0 ? (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                {heldCount}
              </span>
            ) : (
              <span className="text-[10px]">Held</span>
            )}
          </Button>

          {cart && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                title="Hold cart (F9)"
                onClick={handleHold}
                disabled={isBusy || lines.length === 0}
              >
                <PauseCircle className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 text-destructive hover:text-destructive"
                title="Cancel cart"
                onClick={handleCancel}
                disabled={isBusy}
              >
                <X className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Lines */}
      <div
        className="flex-1 overflow-y-auto px-1 py-1"
        role="listbox"
        aria-label="Cart items"
        aria-activedescendant={selectedLineId ?? undefined}
      >
        {lines.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
            Scan a barcode or search for a product
          </div>
        ) : (
          lines.map((line: CartLine) => (
            <CartLineRow
              key={line.id}
              ref={(handle) => {
                if (handle) lineHandles.current.set(line.id, handle);
                else lineHandles.current.delete(line.id);
              }}
              line={line}
              onRemove={handleRemove}
              onQtyChange={handleQtyChange}
              disabled={isBusy}
              isSelected={selectedLineId === line.id}
              onSelect={() => setSelectedLineId(line.id)}
            />
          ))
        )}
      </div>

      <Separator />

      {/* Totals */}
      {cart && (
        <div className="px-3 py-2 space-y-1 shrink-0 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(Number(cart.subtotal.amount), currencyCode)}</span>
          </div>
          {parseFloat(cart.discount_total.amount) > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount</span>
              <span className="tabular-nums">−{money(Number(cart.discount_total.amount), currencyCode)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{money(Number(total), currencyCode)}</span>
          </div>
        </div>
      )}

      {/* Checkout */}
      <div className="px-3 pb-3 shrink-0">
        {lines.length > 0 && (
          <p className="mb-1.5 text-[10px] text-muted-foreground text-center">
            ↑↓ navigate · Enter edit qty · +/- adjust · Del remove
          </p>
        )}
        <Button
          className="w-full gap-2"
          size="lg"
          disabled={lines.length === 0 || isBusy}
          onClick={() => { openPayment(); onCheckout(); }}
          aria-label={`Proceed to payment. Total: ${currencyCode} ${total}`}
        >
          <CreditCard className="size-4" />
          Pay {money(Number(total), currencyCode)}
          <span className="ms-auto text-xs opacity-70">F8</span>
        </Button>
      </div>
    </div>
  );
}
