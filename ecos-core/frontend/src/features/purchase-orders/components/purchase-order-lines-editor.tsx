import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';

import { Combobox } from '@/components/crud/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProductOptions } from '@/features/purchase-orders/hooks/use-product-options';
import type { PurchaseOrderFormValues } from '@/features/purchase-orders/components/purchase-order-form-schema';

type LineError = {
  product_id?: { message?: string };
  quantity?: { message?: string };
  unit_price?: { message?: string };
};

function fieldError(errors: LineError | undefined, field: keyof LineError): string | undefined {
  const err = errors?.[field];
  return typeof err?.message === 'string' ? err.message : undefined;
}

export function PurchaseOrderLinesEditor({ readOnly = false }: { readOnly?: boolean }) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<PurchaseOrderFormValues>();

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const { data: productOptions = [], isLoading: loadingProducts } = useProductOptions();

  const lines = watch('lines');
  const lineErrors = errors.lines as LineError[] | undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Line Items</span>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ product_id: '', quantity: '', unit_price: '' })}
          >
            <Plus className="size-3.5" />
            Add Line
          </Button>
        )}
      </div>

      {typeof errors.lines?.message === 'string' && (
        <p className="text-destructive text-xs">{errors.lines.message}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-start">
              <th className="pb-2 pr-3 font-medium">Product</th>
              <th className="w-28 pb-2 pr-3 font-medium">Qty</th>
              <th className="w-32 pb-2 pr-3 font-medium">Unit Price</th>
              <th className="w-32 pb-2 pr-3 font-medium text-end">Line Total</th>
              {!readOnly && <th className="w-10 pb-2" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {fields.map((field, index) => {
              const qty = Number(lines[index]?.quantity ?? 0);
              const price = Number(lines[index]?.unit_price ?? 0);
              const total = qty * price;
              const errs = lineErrors?.[index];

              return (
                <tr key={field.id}>
                  <td className="py-2 pr-3">
                    <Combobox
                      options={productOptions}
                      value={lines[index]?.product_id ?? null}
                      onChange={(v) => setValue(`lines.${index}.product_id`, v, { shouldValidate: true })}
                      placeholder="Select product…"
                      loading={loadingProducts}
                      disabled={readOnly}
                    />
                    {fieldError(errs, 'product_id') && (
                      <p className="text-destructive mt-1 text-xs">{fieldError(errs, 'product_id')}</p>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      min="0.0001"
                      step="any"
                      disabled={readOnly}
                      {...register(`lines.${index}.quantity`)}
                    />
                    {fieldError(errs, 'quantity') && (
                      <p className="text-destructive mt-1 text-xs">{fieldError(errs, 'quantity')}</p>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      disabled={readOnly}
                      {...register(`lines.${index}.unit_price`)}
                    />
                    {fieldError(errs, 'unit_price') && (
                      <p className="text-destructive mt-1 text-xs">{fieldError(errs, 'unit_price')}</p>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-end font-medium">
                    {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {!readOnly && (
                    <td className="py-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive size-8"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
