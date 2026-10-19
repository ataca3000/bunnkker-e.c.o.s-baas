import { useEffect, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';

import { FormField } from '@/components/crud';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { ProductCategorySelect } from '@/features/products/components/product-category-select';
import { BrandSelect } from '@/features/brands/components/brand-select';
import { ProductPricingSection } from '@/features/products/components/product-pricing-section';
import { channelsService } from '@/features/channels/services/channels-service';
import { brandsService } from '@/features/brands/services/brands-service';
import { productsService } from '@/features/products/services/products-service';
import type { ProductFormValues } from '@/features/products/components/product-form-schema';
import type { Product } from '@/features/products/types/product';

type ProductFormFieldsProps = {
  isEdit?: boolean;
  existingProduct?: Product | null;
  onImageChange?: (file: File | null) => void;
};

// Multi-select channel toggle for channels belonging to a brand
function ChannelMultiSelect({
  brandId,
  value,
  onChange,
}: {
  brandId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation('products');
  const { data: channelsData, isLoading } = useQuery({
    queryKey: ['channels-for-brand', brandId],
    queryFn: () => channelsService.list({ brand_id: brandId, per_page: 100 }),
    enabled: Boolean(brandId),
    staleTime: 60_000,
  });

  const channels = channelsData?.items ?? [];

  // Auto-select the only channel once it resolves after a brand change.
  // Only fires when channels go from 0→N, not on every value change.
  useEffect(() => {
    if (channels.length === 1 && value.length === 0) {
      onChange([channels[0].id]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.length]);

  if (!brandId) {
    return (
      <p className="text-xs text-muted-foreground italic">{t($ => $.formSection.selectBrandFirst)}</p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        {t($ => $.formSection.loadingChannels)}
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">{t($ => $.formSection.noChannelsForBrand)}</p>
    );
  }

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {channels.map((ch) => {
        const selected = value.includes(ch.id);
        return (
          <button
            key={ch.id}
            type="button"
            onClick={() => toggle(ch.id)}
            aria-pressed={selected}
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-accent',
            ].join(' ')}
          >
            {ch.name}
            {selected && (
              <span aria-hidden className="ml-0.5 text-[10px] opacity-70">✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ProductFormFields({ isEdit = false, existingProduct = null, onImageChange }: ProductFormFieldsProps) {
  const { t } = useTranslation('products');
  const { register, control, watch, setValue, getValues } = useFormContext<ProductFormValues>();

  const imageUrl    = watch('image_url');
  const brandId     = watch('brand_id');
  const channelIds  = watch('channel_ids');
  const sku         = watch('sku');
  const useBrandPricing = watch('use_brand_pricing');
  const manualCost  = watch('manual_cost');

  // Shared query with BrandSelect — no extra HTTP call (React Query dedupes by key)
  const { data: brandsOptions } = useQuery({
    queryKey: ['brand-options'],
    queryFn: () => brandsService.list({ per_page: 100, sort_by: 'name', sort_dir: 'asc', status: 'active' }),
    staleTime: 5 * 60 * 1000,
  });

  // Auto-select brand if there's only one active brand (uses separate lightweight query)
  const { data: brandsData } = useQuery({
    queryKey: ['brand-options-count'],
    queryFn: () => brandsService.list({ per_page: 2, sort_by: 'name', sort_dir: 'asc', status: 'active' }),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isEdit && brandsData?.items.length === 1) {
      const single = brandsData.items[0];
      if (!getValues('brand_id')) {
        setValue('brand_id', single.id, { shouldValidate: false });
      }
    }
  }, [brandsData, isEdit, setValue, getValues]);

  // Auto-generate SKU for new products when SKU is empty
  const { data: autoSku, isLoading: skuLoading } = useQuery({
    queryKey: ['next-sku', 'FG'],
    queryFn: () => productsService.nextSku('FG'),
    enabled: !isEdit && !sku,
    staleTime: 0,
  });

  useEffect(() => {
    if (!isEdit && !getValues('sku') && autoSku) {
      setValue('sku', autoSku, { shouldValidate: false });
    }
  }, [autoSku, isEdit, setValue, getValues]);

  // Clear channels when brand changes
  const prevBrandRef = useRef('');
  useEffect(() => {
    if (prevBrandRef.current && prevBrandRef.current !== brandId) {
      setValue('channel_ids', [], { shouldValidate: false });
    }
    prevBrandRef.current = brandId;
   
  }, [brandId, setValue]);

  // When brand is selected (or options load) and Use Brand Defaults is ON:
  // populate markup%, discount% from the brand; auto-apply prices for new products.
  useEffect(() => {
    if (!brandId || !useBrandPricing || !brandsOptions?.items) return;

    const brand = brandsOptions.items.find((b) => b.id === brandId);
    if (!brand) return;

    // Resolve markup from brand — prefer stored markup, derive from target_margin if needed
    const brandMarkup = brand.default_markup != null
      ? brand.default_markup
      : brand.default_target_margin != null
        ? parseFloat((brand.default_target_margin / (100 - brand.default_target_margin) * 100).toFixed(4))
        : 30;
    const brandDiscount = brand.default_discount_pct ?? 0;

    setValue('markup_pct', brandMarkup, { shouldValidate: false });
    setValue('discount_pct', brandDiscount, { shouldValidate: false });

    // Auto-apply prices for new products only (don't overwrite existing product prices)
    if (!isEdit) {
      const cost = manualCost ?? null;
      if (cost != null && cost > 0) {
        const regularPrice = parseFloat((cost * (1 + brandMarkup / 100)).toFixed(2));
        const salePrice = brandDiscount > 0
          ? parseFloat((regularPrice * (1 - brandDiscount / 100)).toFixed(2))
          : null;
        setValue('regular_price', regularPrice, { shouldValidate: false });
        setValue('sale_price', salePrice, { shouldValidate: false });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, useBrandPricing, brandsOptions?.items, manualCost]);

  function handleImageChange(file: File | null) {
    if (file === null) setValue('image_url', null);
    onImageChange?.(file);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Section: Assignment */}
      <div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t($ => $.formSection.assignment)}</p>

        <FormField name="brand_id" label={t($ => $.formSection.brand)} required>
          <Controller
            control={control}
            name="brand_id"
            render={({ field }) => (
              <BrandSelect value={field.value || null} onChange={field.onChange} />
            )}
          />
        </FormField>

        <FormField name="channel_ids" label={t($ => $.formSection.channels)}>
          <Controller
            control={control}
            name="channel_ids"
            render={({ field }) => (
              <ChannelMultiSelect
                brandId={brandId}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            )}
          />
          {channelIds.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t($ => $.formSection.channelsSelected, { count: channelIds.length })}
            </p>
          )}
        </FormField>
      </div>

      {/* Section: Product Image */}
      <FormField name="image_url" label={t($ => $.formSection.productImage)}>
        <ImageUploadField existingUrl={imageUrl ?? null} onChange={handleImageChange} />
      </FormField>

      {/* Section: Basic Info */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="sku" label={t($ => $.form.sku.label)} required>
          <div className="relative">
            <Input
              placeholder={skuLoading ? t($ => $.formSection.generatingSku) : t($ => $.form.sku.placeholder)}
              {...register('sku')}
              className="pr-8"
            />
            {skuLoading && (
              <Loader2 className="absolute right-2.5 top-2.5 size-4 animate-spin text-muted-foreground" aria-hidden />
            )}
            {!isEdit && autoSku && sku === autoSku && (
              <Sparkles className="absolute right-2.5 top-2.5 size-4 text-muted-foreground" aria-label="Auto-generated SKU" />
            )}
          </div>
        </FormField>

        <FormField name="category_id" label={t($ => $.form.category.label)} required>
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <ProductCategorySelect value={field.value || null} onChange={field.onChange} />
            )}
          />
        </FormField>

        <div className="sm:col-span-2">
          <FormField name="name" label={t($ => $.form.name.label)} required>
            <Input placeholder={t($ => $.form.name.placeholder)} {...register('name')} />
          </FormField>
        </div>
      </div>

      {/* Pricing Engine */}
      <ProductPricingSection existingProduct={existingProduct} />

      <FormField name="description" label={t($ => $.form.description.label)}>
        <Input placeholder={t($ => $.form.description.placeholder)} {...register('description')} />
      </FormField>

      <FormField name="long_description" label={t($ => $.form.longDescription.label)}>
        <Textarea
          placeholder={t($ => $.form.longDescription.placeholder)}
          rows={3}
          {...register('long_description')}
        />
      </FormField>

      <label className="flex items-center gap-2 text-sm">
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <input
              type="checkbox"
              className="border-input size-4 rounded"
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
            />
          )}
        />
        {t($ => $.form.active)}
      </label>
    </div>
  );
}
