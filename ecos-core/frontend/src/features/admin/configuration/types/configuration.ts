// ── Policy Groups ─────────────────────────────────────────────────────────────

export type PolicyGroup =
  | 'preparation'
  | 'pricing'
  | 'inventory'
  | 'manufacturing'
  | 'order'
  | 'logistics'
  | 'crm'
  | 'marketing'
  | 'ai'
  | 'workflow'
  | 'notification'
  | 'integration'
  | 'security'
  | 'numbering'
  | 'approval';

export const POLICY_GROUP_LABELS: Record<PolicyGroup, string> = {
  preparation:   'Preparation',
  pricing:       'Pricing',
  inventory:     'Inventory',
  manufacturing: 'Manufacturing',
  order:         'Orders',
  logistics:     'Logistics',
  crm:           'CRM',
  marketing:     'Marketing',
  ai:            'AI Configuration',
  workflow:      'Workflow',
  notification:  'Notifications',
  integration:   'Integrations',
  security:      'Security',
  numbering:     'Numbering',
  approval:      'Approval',
};

// ── Delivery Geography ────────────────────────────────────────────────────────

export type DeliveryZone = {
  id: string;
  delivery_geography_id: string;
  brand_id: string;
  name: string;
  name_ar: string | null;
  sort_order: number;
  is_active: boolean;
  shipping_rule: BrandShippingRule | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryGeography = {
  id: string;
  brand_id: string;
  company_id: string;
  name: string;
  name_ar: string | null;
  code: string | null;
  sort_order: number;
  is_active: boolean;
  default_shipping_cost: number | null;
  zones: DeliveryZone[];
  created_at: string;
  updated_at: string;
};

export type DeliveryGeographyPayload = {
  name: string;
  name_ar?: string | null;
  code?: string | null;
  sort_order?: number;
  is_active?: boolean;
  default_shipping_cost?: number | null;
  master_governorate_id?: string | null;
};

// ── Coverage ──────────────────────────────────────────────────────────────────

export type CoverageStats = {
  enabled_governorates: number;
  total_governorates: number;
  coverage_percentage: number;
  active_zones: number;
  total_zones: number;
  avg_effective_shipping: number | null;
  uncovered_governorates: string[];
};

export type ConfigHealthScore = {
  score: number;
  passed: number;
  total: number;
  is_ready: boolean;
  checks: {
    channels: boolean;
    delivery_coverage: boolean;
    delivery_zones: boolean;
    delivery_windows: boolean;
    shipping_prices: boolean;
    pricing_policy: boolean;
    preparation_policy: boolean;
    inventory_policy: boolean;
    manufacturing_policy: boolean;
    workflow_policy: boolean;
    ai_configuration: boolean;
    integrations: boolean;
  };
};

export type CloneConfigOptions = {
  copy_geographies?: boolean;
  copy_zones?: boolean;
  copy_windows?: boolean;
};

export type CloneConfigResult = {
  cloned_governorates: number;
  cloned_zones: number;
  cloned_windows: number;
};

export type DeliveryZonePayload = {
  name?: string;
  name_ar?: string | null;
  sort_order?: number;
  is_active?: boolean;
  custom_shipping_cost?: number | null;
};

// ── Master Coverage Overlay ───────────────────────────────────────────────────

export type CoverageZone = {
  id: string;
  name: string;
  sort_order: number;
  is_enabled: boolean;
  custom_shipping_cost: number | null;
  zone_id: string | null;
};

export type CoverageGovernorate = {
  id: string;
  name: string;
  name_ar: string | null;
  code: string;
  sort_order: number;
  is_enabled: boolean;
  default_shipping_cost: number | null;
  geo_id: string | null;
  total_zones: number;
  enabled_zones: number;
  zones: CoverageZone[];
};

// ── Shipping Rules ────────────────────────────────────────────────────────────

export type BrandShippingRule = {
  id: string;
  brand_id: string;
  company_id: string;
  delivery_zone_id: string | null;
  delivery_geography_id: string | null;
  shipping_cost: number;
  is_enabled: boolean;
  effective_date: string | null;
  notes: string | null;
  delivery_window_id: string | null;
  zone: (DeliveryZone & { geography: DeliveryGeography | null }) | null;
  created_at: string;
  updated_at: string;
};

export type BrandShippingRulePayload = {
  delivery_zone_id?: string | null;
  delivery_geography_id?: string | null;
  shipping_cost: number;
  is_enabled?: boolean;
  effective_date?: string | null;
  notes?: string | null;
  delivery_window_id?: string | null;
};

// ── Brand Policies ────────────────────────────────────────────────────────────

export type BrandPolicySummary = {
  group: PolicyGroup;
  label: string;
  is_active: boolean;
  version: number;
  configured: boolean;
  updated_at: string | null;
};

export type BrandPolicyDetail = {
  group: PolicyGroup;
  settings: Record<string, unknown>;
  version: number;
  is_active: boolean;
  configured?: boolean;
  updated_at: string | null;
  updated_by: string | null;
};

export type BrandPolicyPayload = {
  settings: Record<string, unknown>;
  reason?: string;
};

// ── Preparation Policies ──────────────────────────────────────────────────────

export type PreparationPolicy = {
  id: string;
  company_id: string;
  warehouse_id: string | null;
  auto_create_time: string;
  freeze_time: string | null;
  auto_close_time: string | null;
  eligible_order_statuses: string[];
  auto_attach_orders: boolean;
  auto_recalculate_demand: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PreparationPolicyPayload = {
  warehouse_id?: string | null;
  auto_create_time: string;
  freeze_time?: string | null;
  auto_close_time?: string | null;
  eligible_order_statuses: string[];
  auto_attach_orders?: boolean;
  auto_recalculate_demand?: boolean;
  is_active?: boolean;
};

// ── Company Settings ──────────────────────────────────────────────────────────

export type CompanySettings = Record<string, Record<string, unknown>>;

// ── Master Geography ──────────────────────────────────────────────────────────

export type MasterGov = {
  id: string;
  name: string;
  name_ar: string | null;
  code: string;
  sort_order: number;
  is_active: boolean;
  is_archived: boolean;
  zones_count?: number;
  brand_geo_count?: number;
};

export type MasterGovPayload = {
  name: string;
  name_ar?: string | null;
  code?: string;
  sort_order?: number;
  is_active?: boolean;
};

export type MasterZoneDetail = {
  id: string;
  master_governorate_id: string;
  name: string;
  code: string | null;
  sort_order: number;
  is_active: boolean;
  is_archived: boolean;
  estimated_delivery_sla_hours: number | null;
  default_warehouse_id: string | null;
  default_logistics_hub: string | null;
  delivery_difficulty: 'easy' | 'medium' | 'hard' | null;
  priority: number | null;
  latitude: number | null;
  longitude: number | null;
  polygon_id: string | null;
  notes: string | null;
  dependency_count?: number;
};

export type MasterZonePayload = {
  name: string;
  is_active?: boolean;
  estimated_delivery_sla_hours?: number | null;
  default_warehouse_id?: string | null;
  default_logistics_hub?: string | null;
  delivery_difficulty?: 'easy' | 'medium' | 'hard' | null;
  priority?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  polygon_id?: string | null;
  notes?: string | null;
};

// ── Audit ─────────────────────────────────────────────────────────────────────

export type ConfigAuditEntry = {
  id: string;
  company_id: string;
  brand_id: string | null;
  module: string;
  category: string;
  config_key: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  action: 'create' | 'update' | 'delete';
  actor_id: string | null;
  actor_name: string | null;
  reason: string | null;
  occurred_at: string;
};
