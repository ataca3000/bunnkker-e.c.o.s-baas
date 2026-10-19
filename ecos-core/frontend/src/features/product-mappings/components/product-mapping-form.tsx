import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Combobox } from '@/components/crud/combobox';
import { FormField } from '@/components/crud';
import { Input } from '@/components/ui/input';
import type { ProductMappingFormValues } from '@/features/product-mappings/components/product-mapping-form-schema';
import { useChannelOptions } from '@/features/product-mappings/hooks/use-channel-options';
import { useProductOptions } from '@/features/product-mappings/hooks/use-product-options';

export function ProductMappingFormFields() {
  const { t } = useTranslation('product-mappings');
  const { register, setValue, control } = useFormContext<ProductMappingFormValues>();
  const { data: productOptions = [], isLoading: productsLoading } = useProductOptions();
  const { data: channelOptions = [], isLoading: channelsLoading } = useChannelOptions();

  const productId = useWatch({ control, name: 'product_id' });
  const channelId = useWatch({ control, name: 'channel_id' });

  const syncStatusOptions = [
    { value: 'pending', label: t($ => $.syncStatus.pending) },
    { value: 'synced', label: t($ => $.syncStatus.synced) },
    { value: 'error', label: t($ => $.syncStatus.failed) },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField name="product_id" label={t($ => $.form.product.label)} required>
            <Combobox
              options={productOptions}
              value={productId || null}
              onChange={(val) => setValue('product_id', val, { shouldValidate: true })}
              placeholder={t($ => $.form.product.placeholder)}
              searchPlaceholder={t($ => $.form.product.placeholder)}
              loading={productsLoading}
            />
          </FormField>
        </div>

        <div className="sm:col-span-2">
          <FormField name="channel_id" label={t($ => $.form.channel.label)} required>
            <Combobox
              options={channelOptions}
              value={channelId || null}
              onChange={(val) => setValue('channel_id', val, { shouldValidate: true })}
              placeholder={t($ => $.form.channel.placeholder)}
              loading={channelsLoading}
            />
          </FormField>
        </div>

        <FormField name="external_product_id" label={t($ => $.form.externalId.label)} required>
          <Input placeholder={t($ => $.form.externalId.placeholder)} {...register('external_product_id')} />
        </FormField>

        <FormField name="external_sku" label={t($ => $.form.externalSku.label)}>
          <Input placeholder={t($ => $.form.externalSku.placeholder)} {...register('external_sku')} />
        </FormField>

        <div className="sm:col-span-2">
          <FormField name="sync_status" label={t($ => $.columns.syncStatus)}>
            <select
              {...register('sync_status')}
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              {syncStatusOptions.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </div>
    </div>
  );
}
