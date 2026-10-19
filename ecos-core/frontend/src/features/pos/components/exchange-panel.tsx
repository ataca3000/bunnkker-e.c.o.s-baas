import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, X, ArrowLeftRight, Plus, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useSale, useProcessExchange } from '@/features/pos/hooks/use-pos-queries';
import { usePosStore } from '@/features/pos/store/pos-store';
import type { ExchangeLine } from '@/features/pos/types';

const exchangeSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
  notes:  z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.reason === 'other' && !data.notes?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Notes are required when reason is "other"',
      path: ['notes'],
    });
  }
});

type ExchangeForm = z.infer<typeof exchangeSchema>;

type ExchangePanelProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export function ExchangePanel({ onClose, onSuccess }: ExchangePanelProps) {
  const { money } = useFormatter();
  const { cashierId, cashierName, currency, exchangeSaleId } = usePosStore();
  const [saleSearch, setSaleSearch] = useState(exchangeSaleId ?? '');
  const [activeSaleId, setActiveSaleId] = useState<string | null>(exchangeSaleId ?? null);
  const [returnedLines, setReturnedLines] = useState<ExchangeLine[]>([]);
  const [replacementLines, setReplacementLines] = useState<ExchangeLine[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: sale, isLoading: saleLoading } = useSale(activeSaleId);
  const processExchange = useProcessExchange();

  const form = useForm<ExchangeForm>({
    resolver: zodResolver(exchangeSchema),
    defaultValues: { reason: 'Customer exchange' },
  });

  const watchedReason = form.watch('reason');

  function loadSale() {
    if (saleSearch.trim()) setActiveSaleId(saleSearch.trim());
  }

  function addAllReturned() {
    if (!sale) return;
    setReturnedLines(
      sale.lines.map((l, i) => ({
        original_line_id: l.id,
        product_id:       l.product_id,
        product_name:     l.product_name,
        sku:              l.sku,
        quantity:         l.quantity,
        unit_price:       l.unit_price,
        line_total:       l.line_total,
        sort_order:       i,
      })),
    );
    setSubmitError(null);
  }

  function addBlankReplacement() {
    setReplacementLines((prev) => [
      ...prev,
      {
        original_line_id: null,
        product_id:       '',
        product_name:     '',
        sku:              '',
        quantity:         '1',
        unit_price:       { amount: '0.00', currency },
        line_total:       { amount: '0.00', currency },
        sort_order:       prev.length,
      },
    ]);
  }

  async function onSubmit(data: ExchangeForm) {
    if (!activeSaleId) return;

    if (returnedLines.length === 0) {
      setSubmitError('Select at least one item to return');
      return;
    }
    setSubmitError(null);

    await processExchange.mutateAsync({
      original_sale_id:  activeSaleId,
      cashier_id:        cashierId,
      cashier_name:      cashierName,
      currency,
      reason:            data.reason,
      notes:             data.notes,
      returned_lines:    returnedLines,
      replacement_lines: replacementLines,
    });
    onSuccess();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="size-4 text-blue-500" />
          <h2 className="text-base font-semibold">Process Exchange</h2>
        </div>
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onClose} aria-label="Close exchange panel">
          <X className="size-4" />
        </Button>
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Sale lookup */}
        <div>
          <Label className="mb-2 text-xs">Original Sale ID</Label>
          <div className="flex gap-2">
            <Input
              value={saleSearch}
              onChange={(e) => setSaleSearch(e.target.value)}
              placeholder="Enter sale ID..."
              onKeyDown={(e) => e.key === 'Enter' && loadSale()}
              aria-label="Original sale ID"
            />
            <Button variant="outline" size="icon" onClick={loadSale} disabled={saleLoading} aria-label="Search sale">
              <Search className="size-4" />
            </Button>
          </div>
        </div>

        {sale && (
          <>
            <div className="rounded-lg bg-muted p-3 text-xs">
              <div className="flex justify-between font-medium">
                <span>Receipt #{sale.receipt_number}</span>
                <span>{money(Number(sale.total.amount), currency)}</span>
              </div>
            </div>

            {/* Returned items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Items to Return</Label>
                  {submitError && (
                    <span className="flex items-center gap-1 text-[10px] text-destructive">
                      <AlertCircle className="size-3" />{submitError}
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addAllReturned}>
                  All Items
                </Button>
              </div>
              {returnedLines.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No items selected for return.</p>
              ) : (
                <div className="space-y-1.5">
                  {returnedLines.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border px-2 py-1.5 text-xs">
                      <span className="flex-1 truncate">{l.product_name || l.sku}</span>
                      <span className="text-muted-foreground tabular-nums">×{l.quantity}</span>
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setReturnedLines((p) => p.filter((_, j) => j !== i));
                          setSubmitError(null);
                        }}
                        aria-label={`Remove ${l.product_name || l.sku} from return`}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Replacement items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Replacement Items</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={addBlankReplacement}>
                  <Plus className="size-3" />Add
                </Button>
              </div>
              {replacementLines.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No replacement items (return only).</p>
              ) : (
                <div className="space-y-1.5">
                  {replacementLines.map((l, i) => (
                    <div key={i} className="grid grid-cols-3 gap-1.5">
                      <Input
                        className="h-7 text-xs col-span-2"
                        placeholder="Product ID"
                        value={l.product_id}
                        aria-label={`Replacement product ID ${i + 1}`}
                        onChange={(e) => {
                          const next = [...replacementLines];
                          next[i] = { ...next[i], product_id: e.target.value };
                          setReplacementLines(next);
                        }}
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-7 text-xs"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Price"
                          value={l.unit_price.amount}
                          aria-label={`Replacement price ${i + 1}`}
                          onChange={(e) => {
                            const next = [...replacementLines];
                            next[i] = { ...next[i], unit_price: { amount: e.target.value, currency } };
                            setReplacementLines(next);
                          }}
                        />
                        <button
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setReplacementLines((p) => p.filter((_, j) => j !== i))}
                          aria-label={`Remove replacement item ${i + 1}`}
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form id="exchange-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              {/* Reason */}
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="exchange-reason">Reason</Label>
                <Input
                  id="exchange-reason"
                  {...form.register('reason')}
                  aria-invalid={!!form.formState.errors.reason}
                  aria-describedby={form.formState.errors.reason ? 'exchange-reason-error' : undefined}
                  className={cn(form.formState.errors.reason && 'border-destructive')}
                />
                {form.formState.errors.reason && (
                  <p id="exchange-reason-error" className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {form.formState.errors.reason.message}
                  </p>
                )}
              </div>

              {/* Notes (required when reason === 'other') */}
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="exchange-notes">
                  Notes {watchedReason === 'other' && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="exchange-notes"
                  {...form.register('notes')}
                  placeholder={watchedReason === 'other' ? 'Required for "other" reason...' : 'Optional...'}
                  aria-invalid={!!form.formState.errors.notes}
                  aria-describedby={form.formState.errors.notes ? 'exchange-notes-error' : undefined}
                  className={cn(form.formState.errors.notes && 'border-destructive')}
                />
                {form.formState.errors.notes && (
                  <p id="exchange-notes-error" className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {form.formState.errors.notes.message}
                  </p>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      <Separator />

      <div className="px-4 py-3 shrink-0">
        <Button
          form="exchange-form"
          type="submit"
          className="w-full"
          disabled={!sale || processExchange.isPending}
        >
          {processExchange.isPending ? 'Processing...' : 'Process Exchange'}
        </Button>
      </div>
    </div>
  );
}
