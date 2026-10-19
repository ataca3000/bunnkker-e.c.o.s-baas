import { z } from 'zod';

import type { Product, ProductPayload, ProductStockStatus, ProductType } from '@/features/products/types/product';

export const productSchema = z.object({
  sku:              z.string().min(1, 'SKU is required.').max(100),
  name:             z.string().min(1, 'Name is required.').max(255),
  description:      z.string().max(1000).optional(),
  category_id:      z.string().min(1, 'Category is required.'),
  brand_id:         z.string().min(1, 'Brand is required.'),
  channel_ids:      z.array(z.string()),
  product_type:     z.enum(['finished_good', 'raw_material', 'packaging_material']),
  is_active:        z.boolean(),
  image_url:        z.string().max(500).nullable().optional(),
  manual_cost:      z.number().min(0).optional().nullable(),
  markup_pct:       z.number().min(0).optional().nullable(),
  discount_pct:     z.number().min(0).max(100).optional().nullable(),
  use_brand_pricing: z.boolean(),
  regular_price:    z.number().min(0).optional().nullable(),
  sale_price:       z.number().min(0).optional().nullable(),
  long_description: z.string().optional(),
  stock_status:     z.enum(['instock', 'outofstock', 'onbackorder']).optional().nullable(),
});

export type ProductFormValues = z.infer<typeof productSchema>;

export function toFormValues(
  product?: Product | null,
  defaultType: ProductType = 'finished_good',
): ProductFormValues {
  const isCustom = product?.pricing_mode === 'custom';
  return {
    sku:               product?.sku ?? '',
    name:              product?.name ?? '',
    description:       product?.description ?? '',
    category_id:       product?.category_id ?? '',
    brand_id:          product?.brand_id ?? '',
    channel_ids:       product?.channels?.map((c) => c.id) ?? [],
    product_type:      product?.product_type ?? defaultType,
    is_active:         product?.is_active ?? true,
    image_url:         product?.image_url ?? null,
    manual_cost:       product?.material_cost ?? null,
    // When custom mode: load the product's own markup/discount; otherwise null (brand effect fills in)
    markup_pct:        isCustom ? (product?.custom_markup ?? null) : null,
    discount_pct:      isCustom ? (product?.custom_discount_pct ?? null) : null,
    use_brand_pricing: !isCustom,
    regular_price:     product?.regular_price ?? null,
    sale_price:        product?.sale_price ?? null,
    long_description:  product?.long_description ?? '',
    stock_status:      (product?.stock_status as ProductStockStatus | null | undefined) ?? null,
  };
}

export function toPayload(values: ProductFormValues): ProductPayload {
  const useBrand = values.use_brand_pricing;

  // Derive target_margin from markup for storage
  const customTargetMargin = !useBrand && values.markup_pct != null && values.markup_pct >= 0
    ? parseFloat((values.markup_pct / (100 + values.markup_pct) * 100).toFixed(4))
    : null;

  return {
    sku:                  values.sku,
    name:                 values.name,
    description:          values.description === '' ? null : (values.description ?? null),
    brand_id:             values.brand_id || null,
    category_id:          values.category_id,
    product_type:         values.product_type,
    is_active:            values.is_active,
    image_url:            values.image_url || null,
    manual_cost:          values.manual_cost ?? null,
    regular_price:        values.regular_price ?? null,
    sale_price:           values.sale_price ?? null,
    long_description:     values.long_description === '' ? null : (values.long_description ?? null),
    stock_status:         values.stock_status ?? null,
    channel_ids:          values.channel_ids,
    pricing_mode:         useBrand ? 'brand_policy' : 'custom',
    custom_markup:        useBrand ? null : (values.markup_pct ?? null),
    custom_target_margin: customTargetMargin,
    custom_discount_pct:  useBrand ? null : (values.discount_pct ?? null),
  };
}
