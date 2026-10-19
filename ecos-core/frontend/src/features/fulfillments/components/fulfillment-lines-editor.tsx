import { useFieldArray, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import { Combobox } from '@/components/crud/combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FulfillmentFormValues } from '@/features/fulfillments/components/fulfillment-form-schema';
import { useProductOptions } from '@/features/orders/hooks/use-product-options';

type LineError = {
  product_id?: { message?: string };
  quantity?: { message?: string };
};

function fieldError(errors: LineError | undefined, field: keyof LineError): string | undefined {
  const err = errors?.[field];
  return typeof err?.message === 'string' ? err.message : undefined;
}

type Props = { readOnly?: boolean };

export function FulfillmentLinesEditor({ readOnly }: Props) {
  const { t } = useTranslation('fulfillments');
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<FulfillmentFormValues>();

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const { data: productOptions = [], isLoading: loadingProducts } = useProductOptions();

  const lines = watch('lines');
  const lineErrors = errors.lines as LineError[] | undefined;

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t($ => $.create.lineItems)}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ product_id: '', quantity: '' })}
          >
            <Plus className="size-3.5" />
            {t($ => $.create.addLine)}
          </Button>
        </div>
      )}

      {typeof errors.lines?.message === 'string' && (
        <p className="text-destructive text-xs">{errors.lines.message}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-start">
              <th className="pb-2 pr-3 font-medium">{t($ => $.detail.product)}</th>
              <th className="w-32 pb-2 pr-3 font-medium">{t($ => $.detail.quantity)}</th>
              {!readOnly && <th className="w-10 pb-2" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {fields.map((field, index) => {
              const errs = lineErrors?.[index];

              return (
                <tr key={field.id}>
                  <td className="py-2 pr-3">
                    {readOnly ? (
                      <span className="font-medium">
                        {lines[index]?.product_id ?? '—'}
                      </span>
                    ) : (
                      <>
                        <Combobox
                          options={productOptions}
                          value={lines[index]?.product_id ?? null}
                          onChange={(v) =>
                            setValue(`lines.${index}.product_id`, v, { shouldValidate: true })
                          }
                          placeholder={t($ => $.create.selectProduct)}
                          loading={loadingProducts}
                        />
                        {fieldError(errs, 'product_id') && (
                          <p className="text-destructive mt-1 text-xs">
                            {fieldError(errs, 'product_id')}
                          </p>
                        )}
                      </>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {readOnly ? (
                      <span>{lines[index]?.quantity ?? '—'}</span>
                    ) : (
                      <>
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
                      </>
                    )}
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
