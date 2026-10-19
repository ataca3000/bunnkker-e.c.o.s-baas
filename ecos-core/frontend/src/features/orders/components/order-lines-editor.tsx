import { useFieldArray, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import { Combobox } from '@/components/crud/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OrderFormValues } from '@/features/orders/components/order-form-schema';
import { useProductOptions } from '@/features/orders/hooks/use-product-options';

type LineError = {
  product_id?: { message?: string };
  quantity?: { message?: string };
  unit_price?: { message?: string };
};

function fieldError(errors: LineError | undefined, field: keyof LineError): string | undefined {
  const err = errors?.[field];
  return typeof err?.message === 'string' ? err.message : undefined;
}

export function OrderLinesEditor() {
  const { t } = useTranslation('orders');
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<OrderFormValues>();

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const { data: productOptions = [], isLoading: loadingProducts } = useProductOptions();

  const lines = watch('lines');
  const lineErrors = errors.lines as LineError[] | undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t($ => $.workspace.lineItems)}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => append({ product_id: '', quantity: '', unit_price: '' })}
        >
          <Plus className="size-3.5" />
          {t($ => $.workspace.addLine)}
        </Button>
      </div>

      {typeof errors.lines?.message === 'string' && (
        <p className="text-destructive text-xs">{errors.lines.message}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-start">
              <th className="pb-2 pr-3 font-medium">{t($ => $.workspace.colProduct)}</th>
              <th className="w-28 pb-2 pr-3 font-medium">{t($ => $.workspace.colQty)}</th>
              <th className="w-32 pb-2 pr-3 font-medium">{t($ => $.workspace.colUnitPrice)}</th>
              <th className="w-32 pb-2 pr-3 font-medium text-end">{t($ => $.detail.lineTotal)}</th>
              <th className="w-10 pb-2" />
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
                      onChange={(v) =>
                        setValue(`lines.${index}.product_id`, v, { shouldValidate: true })
                      }
                      placeholder={t($ => $.workspace.selectProduct)}
                      loading={loadingProducts}
                    />
                    {fieldError(errs, 'product_id') && (
                      <p className="text-destructive mt-1 text-xs">
                        {fieldError(errs, 'product_id')}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      min="0.0001"
                      step="any"
                      {...register(`lines.${index}.quantity`)}
                    />
                    {fieldError(errs, 'quantity') && (
                      <p className="text-destructive mt-1 text-xs">
                        {fieldError(errs, 'quantity')}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      {...register(`lines.${index}.unit_price`)}
                    />
                    {fieldError(errs, 'unit_price') && (
                      <p className="text-destructive mt-1 text-xs">
                        {fieldError(errs, 'unit_price')}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-end font-medium">
                    {total.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
