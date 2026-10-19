import { Plus, Printer, X } from 'lucide-react';
import { useFormatter } from '@/hooks/use-formatter';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useReceipt, useReprintReceipt } from '@/features/pos/hooks/use-pos-queries';
import { usePosStore } from '@/features/pos/store/pos-store';

type ReceiptPanelProps = {
  receiptId?: string | null;
  onClose: () => void;
  onNewSale?: () => void;
};

export function ReceiptPanel({ receiptId, onClose, onNewSale }: ReceiptPanelProps) {
  const { money } = useFormatter();
  const { lastReceiptId } = usePosStore();
  const id = receiptId ?? lastReceiptId;
  const { data: receipt, isLoading } = useReceipt(id);
  const reprint = useReprintReceipt();

  if (!id) return null;

  const RECEIPT_TYPE_LABELS: Record<string, string> = {
    sale:     'Sale',
    return:   'Return',
    exchange: 'Exchange',
    void:     'Voided',
    reprint:  'Reprint',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <h2 className="text-base font-semibold">Receipt</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="Reprint"
            disabled={reprint.isPending || !receipt}
            onClick={() => receipt && reprint.mutate(receipt.id)}
          >
            <Printer className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Loading receipt...
        </div>
      ) : !receipt ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Receipt not found
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 font-mono text-sm">
          {/* Store header */}
          <div className="text-center space-y-0.5">
            <p className="font-bold text-base">ECOS ERP</p>
            <p className="text-xs text-muted-foreground">Terminal: {receipt.terminal_id}</p>
            <Badge variant="outline" className="text-[10px]">
              {RECEIPT_TYPE_LABELS[receipt.type] ?? receipt.type}
            </Badge>
          </div>

          <Separator />

          {/* Receipt info */}
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Receipt #</span>
              <span>{receipt.receipt_number}</span>
            </div>
            <div className="flex justify-between">
              <span>Date</span>
              <span>{new Date(receipt.issued_at).toLocaleString()}</span>
            </div>
            {receipt.cashier_name && (
              <div className="flex justify-between">
                <span>Cashier</span>
                <span>{receipt.cashier_name}</span>
              </div>
            )}
            {receipt.customer_name && (
              <div className="flex justify-between">
                <span>Customer</span>
                <span>{receipt.customer_name}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Line items */}
          <div className="space-y-1.5">
            {receipt.line_items.map((item, i) => (
              <div key={i} className="space-y-0.5">
                <div className="flex justify-between font-medium text-xs">
                  <span className="flex-1 truncate">{item.product_name}</span>
                  <span className="ml-2 tabular-nums">{money(Number(item.line_total.amount), item.line_total.currency)}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {item.sku} × {item.quantity} @ {money(Number(item.unit_price.amount), item.unit_price.currency)}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-0.5 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(Number(receipt.totals.subtotal.amount), receipt.currency)}</span>
            </div>
            {parseFloat(receipt.totals.discount.amount) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span className="tabular-nums">-{money(Number(receipt.totals.discount.amount), receipt.currency)}</span>
              </div>
            )}
            {parseFloat(receipt.totals.tax.amount) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span className="tabular-nums">{money(Number(receipt.totals.tax.amount), receipt.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm">
              <span>Total</span>
              <span className="tabular-nums">{money(Number(receipt.totals.total.amount), receipt.currency)}</span>
            </div>
          </div>

          <Separator />

          {/* Payments */}
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {receipt.payments.map((p, i) => (
              <div key={i} className="flex justify-between">
                <span className="capitalize">{p.method.replace('_', ' ')}</span>
                <span className="tabular-nums">{money(Number(p.amount.amount), p.amount.currency)}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span>Tendered</span>
              <span className="tabular-nums">{money(Number(receipt.totals.tendered.amount), receipt.currency)}</span>
            </div>
            <div className="flex justify-between font-medium text-foreground">
              <span>Change</span>
              <span className="tabular-nums">{money(Number(receipt.totals.change.amount), receipt.currency)}</span>
            </div>
          </div>

          {/* Void notice */}
          {receipt.is_voided && (
            <>
              <Separator />
              <div className="rounded bg-destructive/10 px-3 py-2 text-center text-xs text-destructive font-semibold">
                Voided — {receipt.void_reason}
              </div>
            </>
          )}

          {/* Reprint notice */}
          {receipt.type === 'reprint' && (
            <p className="text-center text-[10px] text-muted-foreground">*** Reprint ***</p>
          )}
        </div>
      )}

      {/* New Sale CTA */}
      {receipt && (
        <>
          <Separator />
          <div className="px-4 py-3 shrink-0">
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={onNewSale ?? onClose}
            >
              <Plus className="size-4" />
              New Sale
              <kbd className="ms-auto rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[10px]">
                Ctrl+N
              </kbd>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
