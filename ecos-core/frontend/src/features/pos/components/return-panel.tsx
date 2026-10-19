import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, X, RotateCcw, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useSale, useProcessReturn } from '@/features/pos/hooks/use-pos-queries';
import { usePosStore } from '@/features/pos/store/pos-store';

const returnLineSchema = z.object({
  line_id:        z.string(),
  product_id:     z.string(),
  product_name:   z.string(),
  sku:            z.string(),
  quantity:       z.string(),
  unit_price:     z.object({ amount: z.string(), currency: z.string() }),
  refund_amount:  z.object({
    amount: z.string().refine(
      (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
      { message: 'Refund amount must be greater than 0' },
    ),
    currency: z.string(),
  }),
  should_restock: z.boolean(),
  sort_order:     z.number(),
});

const returnSchema = z.object({
  notes:         z.string().optional(),
  refund_method: z.string().min(1, 'Refund method is required'),
  lines: z.array(returnLineSchema).min(1, 'Select at least one item to return'),
});

type ReturnForm = z.infer<typeof returnSchema>;

type ReturnPanelProps = {
  onClose: () => void;
  onSuccess: () => void;
};

export function ReturnPanel({ onClose, onSuccess }: ReturnPanelProps) {
  const { money } = useFormatter();
  const { cashierId, cashierName, currency, returnSaleId } = usePosStore();
  const [saleSearch, setSaleSearch] = useState(returnSaleId ?? '');
  const [activeSaleId, setActiveSaleId] = useState<string | null>(returnSaleId ?? null);

  const { data: sale, isLoading: saleLoading } = useSale(activeSaleId);
  const processReturn = useProcessReturn();

  const form = useForm<ReturnForm>({
    resolver: zodResolver(returnSchema),
    defaultValues: { refund_method: 'cash', lines: [] },
  });

  const { fields } = useFieldArray({ control: form.control, name: 'lines' });

  const linesError = form.formState.errors.lines?.root?.message
    ?? (form.formState.errors.lines as { message?: string } | undefined)?.message;

  function loadSale() {
    if (saleSearch.trim()) setActiveSaleId(saleSearch.trim());
  }

  function addAllLines() {
    if (!sale) return;
    form.setValue(
      'lines',
      sale.lines.map((l, i) => ({
        line_id:        l.id,
        product_id:     l.product_id,
        product_name:   l.product_name,
        sku:            l.sku,
        quantity:       l.quantity,
        unit_price:     l.unit_price,
        refund_amount:  l.line_total,
        should_restock: true,
        sort_order:     i,
      })),
      { shouldValidate: form.formState.isSubmitted },
    );
  }

  async function onSubmit(data: ReturnForm) {
    if (!activeSaleId) return;
    const refundTotal = data.lines
      .reduce((s, l) => s + parseFloat(l.refund_amount.amount), 0)
      .toFixed(2);

    await processReturn.mutateAsync({
      sale_id:       activeSaleId,
      cashier_id:    cashierId,
      cashier_name:  cashierName,
      currency,
      refund_total:  refundTotal,
      refund_method: data.refund_method,
      notes:         data.notes,
      lines:         data.lines,
    });
    onSuccess();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <RotateCcw className="size-4 text-amber-500" />
          <h2 className="text-base font-semibold">Process Return</h2>
        </div>
        <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onClose} aria-label="Close return panel">
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

        {/* Sale details */}
        {sale && (
          <>
            <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
              <div className="flex justify-between font-medium">
                <span>Receipt #{sale.receipt_number}</span>
                <span>{money(Number(sale.total.amount), currency)}</span>
              </div>
              <div className="text-muted-foreground">
                {new Date(sale.created_at).toLocaleDateString()} · {sale.lines.length} items
              </div>
            </div>

            <Button variant="outline" className="w-full" size="sm" onClick={addAllLines}>
              Return All Items
            </Button>

            {/* Lines to return */}
            <form id="return-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              {/* Lines section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Items to Return</Label>
                  {linesError && (
                    <span className="flex items-center gap-1 text-[10px] text-destructive">
                      <AlertCircle className="size-3" />{linesError}
                    </span>
                  )}
                </div>

                {fields.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Use "Return All Items" or add lines individually.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, index) => {
                      const refundErr = form.formState.errors.lines?.[index]?.refund_amount?.amount?.message;
                      return (
                        <div key={field.id} className="flex items-start gap-2 rounded-md border px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium">{field.product_name}</p>
                            <p className="text-xs text-muted-foreground">{field.sku}</p>
                            <div className="mt-1.5">
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                aria-label={`Refund amount for ${field.product_name}`}
                                aria-describedby={refundErr ? `refund-err-${index}` : undefined}
                                aria-invalid={!!refundErr}
                                className={cn('h-7 w-28 text-xs text-right tabular-nums', refundErr && 'border-destructive')}
                                {...form.register(`lines.${index}.refund_amount.amount`)}
                              />
                              {refundErr && (
                                <p id={`refund-err-${index}`} className="mt-0.5 text-[10px] text-destructive flex items-center gap-1">
                                  <AlertCircle className="size-2.5" />{refundErr}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 mt-0.5 text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${field.product_name} from return`}
                            onClick={() => {
                              const current = form.getValues('lines');
                              form.setValue('lines', current.filter((_, i) => i !== index), { shouldValidate: true });
                            }}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Refund method */}
              <div className="space-y-1.5">
                <Label className="text-xs">Refund Method</Label>
                <Input
                  {...form.register('refund_method')}
                  placeholder="Cash"
                  aria-invalid={!!form.formState.errors.refund_method}
                  aria-describedby={form.formState.errors.refund_method ? 'refund-method-error' : undefined}
                  className={cn(form.formState.errors.refund_method && 'border-destructive')}
                />
                {form.formState.errors.refund_method && (
                  <p id="refund-method-error" className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {form.formState.errors.refund_method.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Input {...form.register('notes')} placeholder="Optional notes..." />
              </div>
            </form>
          </>
        )}
      </div>

      <Separator />

      <div className="px-4 py-3 shrink-0">
        <Button
          form="return-form"
          type="submit"
          className="w-full"
          disabled={!sale || processReturn.isPending}
        >
          {processReturn.isPending ? 'Processing...' : 'Process Return'}
        </Button>
      </div>
    </div>
  );
}
