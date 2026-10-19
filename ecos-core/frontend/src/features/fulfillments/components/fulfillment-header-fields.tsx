import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Combobox } from '@/components/crud/combobox';
import { FormField } from '@/components/crud';
import { Input } from '@/components/ui/input';
import type { FulfillmentFormValues } from '@/features/fulfillments/components/fulfillment-form-schema';
import { useOrderOptions } from '@/features/fulfillments/hooks/use-order-options';
import { useWarehouseOptions } from '@/features/fulfillments/hooks/use-warehouse-options';

type Props = { readOnly?: boolean };

export function FulfillmentHeaderFields({ readOnly }: Props) {
  const { t } = useTranslation('fulfillments');
  const { register, control } = useFormContext<FulfillmentFormValues>();
  const { data: orderOptions = [], isLoading: loadingOrders } = useOrderOptions();
  const { data: warehouseOptions = [], isLoading: loadingWarehouses } = useWarehouseOptions();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormField name="order_id" label={t($ => $.form.order.label)} required>
          <Controller
            control={control}
            name="order_id"
            render={({ field }) => (
              <Combobox
                options={orderOptions}
                value={field.value || null}
                onChange={field.onChange}
                placeholder={t($ => $.form.order.placeholder)}
                loading={loadingOrders}
                disabled={readOnly}
              />
            )}
          />
        </FormField>
      </div>

      <div className="sm:col-span-2">
        <FormField name="warehouse_id" label={t($ => $.form.warehouse.label)} required>
          <Controller
            control={control}
            name="warehouse_id"
            render={({ field }) => (
              <Combobox
                options={warehouseOptions}
                value={field.value || null}
                onChange={field.onChange}
                placeholder={t($ => $.form.warehouse.placeholder)}
                loading={loadingWarehouses}
                disabled={readOnly}
              />
            )}
          />
        </FormField>
      </div>

      <FormField name="fulfillment_date" label={t($ => $.form.fulfillmentDate)} required>
        <Input type="date" {...register('fulfillment_date')} disabled={readOnly} />
      </FormField>

      <div className="sm:col-span-2">
        <FormField name="notes" label={t($ => $.form.notes.label)}>
          <textarea
            rows={3}
            placeholder={t($ => $.form.notes.placeholder)}
            disabled={readOnly}
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
            {...register('notes')}
          />
        </FormField>
      </div>
    </div>
  );
}
