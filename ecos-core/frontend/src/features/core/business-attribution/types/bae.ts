// Business Attribution Engine — Core Platform Type System
// NEVER depends on Marketing types. Marketing imports from here.

// ─── Enums ────────────────────────────────────────────────────────────────────

export type EventCategory =
  | 'marketing' | 'sales' | 'crm' | 'inventory' | 'manufacturing'
  | 'preparation' | 'packing' | 'shipping' | 'accounting' | 'finance'
  | 'support' | 'customer' | 'automation' | 'system';

export type DnaEntityType =
  | 'lead' | 'conversation' | 'customer' | 'order' | 'invoice'
  | 'payment' | 'shipment' | 'return' | 'manufacturing_order'
  | 'preparation_batch' | 'packing_batch';

export type JourneyStage =
  | 'ad_impression' | 'ad_click' | 'landing' | 'conversation' | 'lead'
  | 'lead_assignment' | 'quote' | 'order' | 'payment'
  | 'inventory_reservation' | 'manufacturing' | 'preparation' | 'packing'
  | 'shipment' | 'delivery' | 'customer_review' | 'repeat_purchase' | 'vip_customer';

export type AttributionModelType =
  | 'first_touch' | 'last_touch' | 'linear' | 'position_based' | 'time_decay';

export type NodeType =
  | 'customer' | 'order' | 'campaign' | 'initiative' | 'conversation'
  | 'shipment' | 'invoice' | 'warehouse' | 'company' | 'brand'
  | 'channel' | 'marketing_user' | 'sales_user' | 'lead' | 'payment';

export type RelationshipType =
  | 'GENERATED' | 'CREATED' | 'ASSIGNED_TO' | 'PURCHASED' | 'PROMOTED_BY'
  | 'SHIPPED_BY' | 'BELONGS_TO' | 'CONVERTED_TO' | 'OWNED_BY' | 'INFLUENCED_BY';

// ─── Labels ───────────────────────────────────────────────────────────────────

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  marketing: 'Marketing', sales: 'Sales', crm: 'CRM', inventory: 'Inventory',
  manufacturing: 'Manufacturing', preparation: 'Preparation', packing: 'Packing',
  shipping: 'Shipping', accounting: 'Accounting', finance: 'Finance',
  support: 'Support', customer: 'Customer', automation: 'Automation', system: 'System',
};

export const DNA_ENTITY_LABELS: Record<DnaEntityType, string> = {
  lead: 'Lead', conversation: 'Conversation', customer: 'Customer',
  order: 'Order', invoice: 'Invoice', payment: 'Payment', shipment: 'Shipment',
  return: 'Return', manufacturing_order: 'Manufacturing Order',
  preparation_batch: 'Preparation Batch', packing_batch: 'Packing Batch',
};

export const JOURNEY_STAGE_LABELS: Record<JourneyStage, string> = {
  ad_impression: 'Ad Impression', ad_click: 'Ad Click', landing: 'Landing',
  conversation: 'Conversation', lead: 'Lead', lead_assignment: 'Lead Assignment',
  quote: 'Quote', order: 'Order', payment: 'Payment',
  inventory_reservation: 'Inventory Reservation', manufacturing: 'Manufacturing',
  preparation: 'Preparation', packing: 'Packing', shipment: 'Shipment',
  delivery: 'Delivery', customer_review: 'Customer Review',
  repeat_purchase: 'Repeat Purchase', vip_customer: 'VIP Customer',
};

export const JOURNEY_STAGE_ORDINALS: Record<JourneyStage, number> = {
  ad_impression: 1, ad_click: 2, landing: 3, conversation: 4, lead: 5,
  lead_assignment: 6, quote: 7, order: 8, payment: 9,
  inventory_reservation: 10, manufacturing: 11, preparation: 12, packing: 13,
  shipment: 14, delivery: 15, customer_review: 16, repeat_purchase: 17, vip_customer: 18,
};

export const ATTRIBUTION_MODEL_LABELS: Record<AttributionModelType, string> = {
  first_touch: 'First Touch', last_touch: 'Last Touch', linear: 'Linear',
  position_based: 'Position Based', time_decay: 'Time Decay',
};

// ─── Models ───────────────────────────────────────────────────────────────────

export interface BusinessEvent {
  id: string;
  event_uuid: string;
  event_name: string;
  category: EventCategory;
  category_label: string;
  producer_module: string;
  producer_entity: string;
  entity_id: string | null;
  entity_type: string | null;
  company_id: string | null;
  brand_id: string | null;
  channel_id: string | null;
  actor_id: string | null;
  actor_type: string | null;
  occurred_at: string;
  correlation_id: string | null;
  business_dna_id: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  version: string;
  created_at: string;
}

export interface JourneyStep {
  id: string;
  business_dna_id: string;
  journey_stage: JourneyStage;
  journey_stage_label: string;
  ordinal: number;
  event_id: string | null;
  actor_id: string | null;
  actor_type: string | null;
  occurred_at: string;
  duration_seconds: number | null;
  previous_step_id: string | null;
  related_entity_id: string | null;
  related_entity_type: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface BusinessMetric {
  id: string;
  business_dna_id: string;
  time_to_first_contact_s: number | null;
  lead_to_quote_s: number | null;
  quote_to_order_s: number | null;
  order_to_payment_s: number | null;
  payment_to_preparation_s: number | null;
  preparation_to_packing_s: number | null;
  packing_to_shipment_s: number | null;
  shipment_to_delivery_s: number | null;
  delivery_to_repeat_s: number | null;
  customer_lifetime_duration_s: number | null;
  total_journey_time_s: number | null;
  calculated_at: string;
}

export interface BusinessDna {
  id: string;
  entity_type: DnaEntityType;
  entity_type_label: string;
  entity_id: string;
  origin_provider: string | null;
  origin_platform: string | null;
  initiative_id: string | null;
  campaign_id: string | null;
  ad_set_id: string | null;
  ad_id: string | null;
  creative_id: string | null;
  landing_page: string | null;
  conversation_source: string | null;
  lead_source: string | null;
  sales_rep_id: string | null;
  marketing_team: string | null;
  company_id: string | null;
  brand_id: string | null;
  channel_id: string | null;
  cost_center: string | null;
  business_unit: string | null;
  first_touch: Record<string, unknown> | null;
  last_touch: Record<string, unknown> | null;
  acquisition_timestamp: string | null;
  conversion_timestamp: string | null;
  repeat_purchase_timestamp: string | null;
  customer_lifetime_stage: string | null;
  attribution_model: AttributionModelType | null;
  is_converted: boolean;
  has_repeat_purchase: boolean;
  journey_steps?: JourneyStep[];
  metrics?: BusinessMetric | null;
  created_at: string;
  updated_at: string;
}

export interface TouchpointCredit {
  event_id: string;
  event_name: string;
  occurred_at: string;
  credit: number;
}

export interface AttributionResult {
  model: AttributionModelType;
  touchpoints: TouchpointCredit[];
  total_touchpoints: number;
}

export interface JourneyData {
  dna_id: string;
  entity_type: string;
  entity_id: string;
  steps: JourneyStep[];
  total_steps: number;
  first_at: string | null;
  last_at: string | null;
  stages_reached: string[];
}

export interface EntityNode {
  id: string;
  node_type: NodeType;
  node_label: string;
  entity_id: string;
  entity_type: string;
  company_id: string | null;
  label: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
}

export interface ReplayResult {
  total_events: number;
  events: BusinessEvent[];
  replayed_at: string;
  entity_type?: string;
  entity_id?: string;
  dna_id?: string;
  correlation_id?: string;
  campaign_id?: string;
}

// ─── API Response wrappers ────────────────────────────────────────────────────

export interface PaginatedBaeResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
