import { useEffect, useRef, useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { Banknote, CreditCard, RotateCcw, Wallet, X, Check, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useCart, useProcessSale } from '@/features/pos/hooks/use-pos-queries';
import { usePosStore } from '@/features/pos/store/pos-store';
import type { PaymentMethod, PaymentTender } from '@/features/pos/types';

const PAYMENT_METHODS: { method: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { method: 'cash',         label: 'Cash',         icon: Banknote },
  { method: 'card',         label: 'Card',         icon: CreditCard },
  { method: 'wallet',       label: 'Wallet',       icon: Wallet },
  { method: 'store_credit', label: 'Store Credit', icon: CreditCard },
];

const QUICK_AMOUNTS = [50, 100, 200, 500];

type PaymentPanelProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export function PaymentPanel({ onClose, onSuccess }: PaymentPanelProps) {
  const { money } = useFormatter();
  const { cartId, currency, setTenderDraft } = usePosStore();
  const { data: cart } = useCart();
  const processSale = useProcessSale();
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Restore tenders from draft if the panel was open during a crash.
  // We read directly from the store's current state at mount time to avoid
  // creating a subscription that would re-initialize on every store update.
  const [tenders, setTenders] = useState<PaymentTender[]>(
    () => usePosStore.getState().tenderDraft ?? [],
  );
  const wasRestored = useRef((usePosStore.getState().tenderDraft?.length ?? 0) > 0);

  const total = parseFloat(cart?.total?.amount ?? '0');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amountStr, setAmountStr] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  const tendered   = tenders.reduce((s, t) => s + parseFloat(t.amount), 0);
  const remaining  = Math.max(0, total - tendered);
  const change     = Math.max(0, tendered - total);
  const isSufficient = tendered >= total;

  const currentAmount = amountStr ? parseFloat(amountStr) : remaining;

  // Focus amount input on mount so cashier can type immediately
  useEffect(() => {
    amountInputRef.current?.focus();
  }, []);

  // Auto-save tenders to store so they survive a browser crash
  useEffect(() => {
    setTenderDraft(tenders.length > 0 ? tenders : null);
  }, [tenders, setTenderDraft]);

  // Enter key confirms payment when sufficient
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && isSufficient && !processSale.isPending) {
        e.preventDefault();
        handlePay();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSufficient, processSale.isPending, cartId, tenders, method, total]); // eslint-disable-line react-hooks/exhaustive-deps

  function addTender() {
    if (currentAmount <= 0 || isNaN(currentAmount)) {
      setAmountError('Enter a valid amount greater than 0');
      amountInputRef.current?.focus();
      return;
    }
    setAmountError(null);
    setTenders((prev) => [...prev, { method, amount: currentAmount.toFixed(2) }]);
    setAmountStr('');
    amountInputRef.current?.focus();
  }

  async function handlePay() {
    if (!cartId || !isSufficient) return;

    const payments = tenders.length === 0
      ? [{ method, amount: total.toFixed(2) }]
      : tenders;

    await processSale.mutateAsync({ cart_id: cartId, payments });
    // clearTransaction() (called inside useProcessSale.onSuccess) wipes tenderDraft from store
    onSuccess();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <h2 className="text-base font-semibold">Payment</h2>
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onClose} aria-label="Close payment panel">
          <X className="size-4" />
        </Button>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Restored draft notice */}
        {wasRestored.current && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <RotateCcw className="size-3.5 shrink-0" />
            Payment details restored from previous session.
          </div>
        )}

        {/* Total due */}
        <div className="rounded-lg bg-muted p-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Total Due</span>
            <span>{money(total, currency)}</span>
          </div>
          {tendered > 0 && (
            <>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Amount Tendered</span>
                <span>{money(tendered, currency)}</span>
              </div>
              <Separator className="my-2" />
              <div className={cn(
                'flex justify-between text-base font-bold',
                remaining > 0 ? 'text-destructive' : 'text-emerald-600',
              )}>
                <span>{remaining > 0 ? 'Remaining' : 'Change'}</span>
                <span>{money(remaining > 0 ? remaining : change, currency)}</span>
              </div>
            </>
          )}
        </div>

        {/* Method selector — min 44px touch targets */}
        <div>
          <Label className="mb-2 text-xs">Payment Method</Label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map(({ method: m, label, icon: Icon }) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
                  method === m
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:bg-accent',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <Label className="mb-2 text-xs">Amount</Label>
          <Input
            ref={amountInputRef}
            type="number"
            min="0"
            step="0.01"
            placeholder={remaining.toFixed(2)}
            value={amountStr}
            onChange={(e) => { setAmountStr(e.target.value); setAmountError(null); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                if (isSufficient) handlePay();
                else addTender();
              }
            }}
            className={cn('text-right tabular-nums', amountError && 'border-destructive focus-visible:ring-destructive')}
            aria-describedby={amountError ? 'payment-amount-error' : undefined}
            aria-invalid={!!amountError}
          />
          {amountError && (
            <p id="payment-amount-error" className="mt-1 text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="size-3 shrink-0" />{amountError}
            </p>
          )}
          {/* Quick amounts for cash — min 44px touch targets */}
          {method === 'cash' && (
            <div className="mt-2 flex gap-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => { setAmountStr(amt.toString()); amountInputRef.current?.focus(); }}
                  className="flex min-h-11 flex-1 items-center justify-center rounded border text-xs hover:bg-accent"
                >
                  {amt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add tender (for split payments) */}
        {tendered < total && (
          <Button variant="outline" className="w-full" onClick={addTender}>
            + Add Payment
          </Button>
        )}

        {/* Tenders list */}
        {tenders.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Payments</Label>
            {tenders.map((t, i) => (
              <div key={i} className="flex items-center justify-between rounded bg-muted px-3 py-1.5 text-sm">
                <span className="capitalize">{t.method.replace('_', ' ')}</span>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">{money(Number(t.amount), currency)}</span>
                  <button
                    onClick={() => setTenders((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline error */}
        {processSale.isError && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>Payment failed. Please check the amount and try again.</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Confirm button — Enter key hint shown when sufficient */}
      <div className="px-4 py-3 shrink-0">
        <Button
          className="w-full gap-2"
          size="lg"
          disabled={!isSufficient || processSale.isPending}
          onClick={handlePay}
        >
          {processSale.isPending ? (
            'Processing...'
          ) : (
            <>
              <Check className="size-4" />
              Confirm Payment
              {isSufficient && (
                <kbd className="ms-auto rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[10px]">
                  Enter
                </kbd>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
