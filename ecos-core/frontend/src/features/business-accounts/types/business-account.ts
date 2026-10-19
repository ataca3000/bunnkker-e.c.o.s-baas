export interface BusinessAccountCompany {
  id: string;
  code: string;
  name: string;
}

export interface BusinessAccountBrand {
  id: string;
  code: string;
  name: string;
}

export interface BusinessAccount {
  id: string;
  company_id: string;
  company?: BusinessAccountCompany;
  brand_id: string | null;
  brand?: BusinessAccountBrand | null;
  code: string;
  name: string;
  provider: string;
  status: string;
  description: string | null;
  logo: string | null;
  oauth_config: Record<string, unknown> | null;
  api_keys: Record<string, unknown> | null;
  webhook_config: Record<string, unknown> | null;
  sync_settings: Record<string, unknown> | null;
  external_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessAccountPayload {
  company_id: string;
  brand_id?: string | null;
  name: string;
  provider: string;
  code?: string;
  status?: string;
  description?: string | null;
  logo?: string | null;
}

export interface BusinessAccountsQuery {
  page?: number;
  per_page?: number;
  search?: string;
  company_id?: string;
  brand_id?: string;
  provider?: string;
  status?: string;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface BusinessAccountsResult {
  items: BusinessAccount[];
  meta: PaginationMeta;
}

export const BUSINESS_ACCOUNT_PROVIDERS = [
  'Meta',
  'WooCommerce',
  'Shopify',
  'Amazon',
  'TikTok',
  'Google',
  'Noon',
  'Snapchat',
  'Custom',
] as const;

export const BUSINESS_ACCOUNT_STATUSES = ['active', 'inactive', 'suspended'] as const;
