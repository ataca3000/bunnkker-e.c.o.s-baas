import { z } from 'zod';

import type { Channel, ChannelPayload, ChannelPlatform } from '@/features/channels/types/channel';

const PLATFORMS: [ChannelPlatform, ...ChannelPlatform[]] = [
  'woocommerce',
  'shopify',
  'amazon',
  'noon',
  'salla',
  'zid',
];

export const channelSchema = z.object({
  company_id: z.string().optional(),
  brand_id: z.string().min(1, 'Brand is required.'),
  name: z.string().min(1, 'Name is required.').max(255),
  platform: z.enum(PLATFORMS, 'Platform is required.'),
  store_url: z.string().min(1, 'Store URL is required.').url('Enter a valid URL.').max(500),
  is_active: z.boolean(),
  sync_products: z.boolean(),
  sync_prices: z.boolean(),
  sync_stock: z.boolean(),
  sync_customers: z.boolean(),
  consumer_key: z.string().max(500).optional(),
  consumer_secret: z.string().max(500).optional(),
});

export type ChannelFormValues = z.infer<typeof channelSchema>;

export function toFormValues(channel?: Channel | null): ChannelFormValues {
  return {
    company_id: channel?.brand?.company?.id ?? '',
    brand_id: channel?.brand_id ?? '',
    name: channel?.name ?? '',
    platform: channel?.platform ?? 'woocommerce',
    store_url: channel?.store_url ?? '',
    is_active: channel?.is_active ?? true,
    sync_products: channel?.sync_products ?? true,
    sync_prices: channel?.sync_prices ?? true,
    sync_stock: channel?.sync_stock ?? true,
    sync_customers: channel?.sync_customers ?? true,
    consumer_key: '',
    consumer_secret: '',
  };
}

export function toPayload(values: ChannelFormValues): ChannelPayload {
  return {
    brand_id: values.brand_id,
    name: values.name,
    platform: values.platform,
    store_url: values.store_url,
    is_active: values.is_active,
    sync_products: values.sync_products,
    sync_prices: values.sync_prices,
    sync_stock: values.sync_stock,
    sync_customers: values.sync_customers,
    consumer_key: values.consumer_key || undefined,
    consumer_secret: values.consumer_secret || undefined,
  };
}
