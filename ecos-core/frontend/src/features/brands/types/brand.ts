export type BrandCompany = {
  id: string;
  code: string;
  name: string;
};

export type Brand = {
  id: string;
  company_id: string;
  company?: BrandCompany;
  code: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  is_active: boolean;
  minimum_margin_pct: number | null;    // canonical Config OS field
  default_target_margin: number | null; // projection alias (same value)
  default_markup: number | null;
  default_discount_pct: number | null;
  channels_count: number;
  active_channels_count: number;
  products_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type BrandPayload = {
  company_id: string;
  name: string;
  code?: string;
  slug?: string;
  logo?: string;
  description?: string;
  is_active: boolean;
  default_target_margin?: number | null;
  default_markup?: number | null;
  default_discount_pct?: number | null;
};

export type BrandTransferPayload = {
  target_company_id: string;
};

export type TransferAnalyzePayload = {
  target_company_id: string;
};

export type TransferImpactReport = {
  brand_id: string;
  brand_code: string;
  brand_slug: string;
  from_company_id: string;
  to_company_id: string;
  counts: {
    channels: number;
    orders: number;
    products: number;
    business_accounts: number;
    marketing_campaigns: number;
    automation_workflows: number;
    ai_contexts: number;
    cep_conversations: number;
    policies: number;
    total_records: number;
  };
  warnings: {
    slug_conflict: boolean;
    resolved_slug: string;
    locked_snapshots: number;
  };
  blockers: {
    code_conflict: boolean;
  };
  has_blockers: boolean;
};

export type BrandTransferCascade = {
  config_brand_policies: number;
  channels: number;
  orders: number;
  order_business_context_snapshots: number;
  order_financial_snapshots: number;
  business_accounts: number;
  marketing_campaign_business_contexts: number;
  marketing_campaign_drafts: number;
  marketing_initiatives: number;
  automation_workflows: number;
  bae_business_dna: number;
  bae_business_events: number;
  cep_conversations: number;
  cep_leads: number;
  cep_channel_providers: number;
};

export type BrandTransferResult = {
  brand: Brand;
  transfer: {
    slug: string;
    slug_changed: boolean;
    from_company: string;
    to_company: string;
    cascade: BrandTransferCascade;
  };
};

export type BrandSortField = 'code' | 'name' | 'slug' | 'is_active' | 'created_at' | 'updated_at';
export type SortDirection = 'asc' | 'desc';
export type BrandStatusFilter = 'all' | 'active' | 'inactive';

export type BrandsQuery = {
  search?: string;
  company_id?: string;
  status?: BrandStatusFilter;
  page?: number;
  per_page?: number;
  sort_by?: BrandSortField;
  sort_dir?: SortDirection;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type BrandsSummary = {
  total_active_channels: number;
};

export type BrandsResult = {
  items: Brand[];
  meta: PaginationMeta;
  summary: BrandsSummary;
};

// ── Brand Shipping Configuration ─────────────────────────────────────────────

export type UnsupportedAreaAction = 'allow' | 'pending_review' | 'reject';

export type BrandShippingSettings = {
  id: number | null;
  brand_id: string;
  unsupported_governorate_action: UnsupportedAreaAction;
  unsupported_city_action: UnsupportedAreaAction;
  default_cod_enabled: boolean;
  default_free_shipping_threshold: number | null;
  default_shipping_provider: string | null;
  updated_at: string | null;
};

export type BrandGovernorateSettings = {
  id: number | null;
  brand_id: string;
  governorate_id: number;
  is_enabled: boolean;
  shipping_price: number | null;
  estimated_delivery_days: number | null;
  same_day_supported: boolean;
  display_order: number;
  preferred_provider: string | null;
  governorate: {
    id: number;
    name_ar: string;
    name_en: string;
    default_shipping_price: number;
    is_active: boolean;
    cities_count: number;
  } | null;
  updated_at: string | null;
};

export type BrandCitySetting = {
  id: number | null;
  brand_id: string;
  city_id: number;
  is_enabled: boolean | null;
  shipping_price: number | null;
  supports_cod: boolean | null;
  is_remote_override: boolean | null;
  city: {
    id: number;
    name_ar: string;
    name_en: string;
    is_active: boolean;
    effective_shipping_price: number;
    is_remote_area: boolean;
    governorate_id: number;
  } | null;
  updated_at: string | null;
};

export type ShippingCalculation = {
  shipping_price: number;
  validation: {
    allowed: boolean;
    action: UnsupportedAreaAction;
    reason: string;
  };
};

export type BrandGovernorateSettingsPayload = {
  is_enabled?: boolean;
  shipping_price?: number | null;
  estimated_delivery_days?: number | null;
  same_day_supported?: boolean;
  display_order?: number;
  preferred_provider?: string | null;
};

export type BrandCitySettingPayload = {
  is_enabled?: boolean | null;
  shipping_price?: number | null;
  supports_cod?: boolean | null;
  is_remote_override?: boolean | null;
};

export type BrandShippingSettingsPayload = {
  unsupported_governorate_action?: UnsupportedAreaAction;
  unsupported_city_action?: UnsupportedAreaAction;
  default_cod_enabled?: boolean;
  default_free_shipping_threshold?: number | null;
  default_shipping_provider?: string | null;
};

// ── Brand delivery configuration (legacy) ───────────────────────────────────
export type BrandDeliveryZone = {
  id: string;
  name: string;
  shipping_cost: number | null;
};

export type BrandDeliveryGovernorate = {
  id: string;
  name: string;
  zones: BrandDeliveryZone[];
};

export type BrandDeliveryGeography = {
  governorates: BrandDeliveryGovernorate[];
};

/** Lightweight type for order-form checkout dropdown (active slots only) */
export type BrandDeliveryWindow = {
  id: string;
  label: string;
  starts_at: string;
  ends_at: string;
};

/** Full type for Brand → Shipping & Delivery management */
export type BrandDeliveryTimeSlot = {
  id: string;
  brand_id: string;
  name: string;
  start_time: string;
  end_time: string;
  display_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type BrandDeliveryTimeSlotPayload = {
  name?: string;
  start_time?: string;
  end_time?: string;
  display_order?: number;
  is_active?: boolean;
};

export type BrandConfigHealth = {
  is_ready: boolean;
  checks: {
    channels: boolean;
    delivery_geography: boolean;
    delivery_zones: boolean;
    delivery_windows: boolean;
    shipping_rules: boolean;
  };
};
