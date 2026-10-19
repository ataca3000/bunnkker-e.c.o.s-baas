// ── Enums ────────────────────────────────────────────────────────────────────

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'closed' | 'snoozed';
export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type CommunicationProvider = 'whatsapp' | 'messenger' | 'instagram_direct' | 'email' | 'sms';
export type ConversationIntent = 'lead' | 'opportunity' | 'quote' | 'order' | 'support' | 'general';
export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'template' | 'sticker' | 'location';
export type MessageDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MacroCategory = 'welcome' | 'order_confirmation' | 'shipping_update' | 'payment_reminder' | 'refund' | 'complaint' | 'support' | 'custom';
export type RoutingType = 'auto' | 'round_robin' | 'skill_based' | 'manual';
export type ChannelProviderStatus = 'active' | 'inactive' | 'error';
export type LinkedEntityType = 'order' | 'quote' | 'lead' | 'invoice';

// ── Core Models ───────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  provider: CommunicationProvider;
  external_conversation_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  company_id: string;
  brand_id: string | null;
  channel_id: string | null;
  status: ConversationStatus;
  priority: ConversationPriority;
  intent: ConversationIntent;
  is_vip: boolean;
  attribution_captured: boolean;
  order_id: string | null;
  quote_id: string | null;
  assigned_employee_id: number | null;
  assigned_team_id: string | null;
  tags: string[];
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  external_message_id: string | null;
  direction: MessageDirection;
  message_type: MessageType;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  media_size: number | null;
  sender_type: 'customer' | 'agent' | 'system';
  sender_id: string | null;
  sender_name: string | null;
  is_read: boolean;
  delivery_status: MessageDeliveryStatus;
  reply_to_message_id: string | null;
  template_name: string | null;
  reaction_emoji: string | null;
  provider_error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ChannelProvider {
  id: string;
  channel: CommunicationProvider;
  display_name: string;
  status: ChannelProviderStatus;
  phone_number: string | null;
  page_id: string | null;
  last_verified_at: string | null;
  last_error: string | null;
}

export interface ConversationMacro {
  id: string;
  name: string;
  shortcut: string | null;
  category: MacroCategory;
  content: string;
  variables: string[];
  applies_to_channels: CommunicationProvider[];
  usage_count: number;
  is_shared: boolean;
}

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  routing_type: RoutingType;
  conditions: RoutingCondition[];
  assign_to_user_id: number | null;
  assign_to_team_id: string | null;
  apply_sla_policy: boolean;
  sla_policy_id: string | null;
  set_priority: ConversationPriority | null;
  is_active: boolean;
}

export interface RoutingCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in';
  value: string | string[];
}

export interface ConversationAttribution {
  id: string;
  conversation_id: string;
  source_provider: string | null;
  ad_id: string | null;
  ad_set_id: string | null;
  campaign_id_external: string | null;
  click_id: string | null;
  ecos_campaign_id: string | null;
  ecos_initiative_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_page: string | null;
  captured_at: string;
}

export interface ConversationTask {
  id: string;
  conversation_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  assigned_to: number | null;
  completed_at: string | null;
  completed_by: number | null;
  is_done: boolean;
  is_overdue: boolean;
}

export interface LinkedEntity {
  id: string;
  conversation_id: string;
  entity_type: LinkedEntityType;
  entity_id: string;
  entity_code: string;
  created_by: number;
  created_at: string;
}

export interface ProductSearchResult {
  id: string;
  sku: string;
  name: string;
  brand_name: string | null;
  final_price: number | null;
  currency: string;
  available_qty: number;
  thumbnail: string | null;
}

export interface ConversationKpis {
  total_open: number;
  unread: number;
  resolved_today: number;
  avg_response_time_min: number;
  orders_created: number;
  revenue_attributed: number;
}

// ── Paginated response wrapper ────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

// ── Form payloads ─────────────────────────────────────────────────────────────

export interface SendMessagePayload {
  message_type: MessageType;
  content?: string;
  media_url?: string;
  media_type?: string;
  reply_to_message_id?: string;
  template_name?: string;
  template_params?: Record<string, string>[];
  language_code?: string;
}

export interface CreateMacroPayload {
  name: string;
  shortcut?: string;
  category: MacroCategory;
  content: string;
  variables?: string[];
  applies_to_channels?: CommunicationProvider[];
  is_shared?: boolean;
  company_id: string;
}

export interface CreateRoutingRulePayload {
  company_id: string;
  name: string;
  priority?: number;
  routing_type: RoutingType;
  conditions: RoutingCondition[];
  assign_to_user_id?: number;
  assign_to_team_id?: string;
  apply_sla_policy?: boolean;
  sla_policy_id?: string;
  set_priority?: ConversationPriority;
  is_active?: boolean;
}

export interface CreateChannelProviderPayload {
  company_id: string;
  brand_id?: string;
  channel: CommunicationProvider;
  display_name: string;
  credentials: Record<string, string>;
  webhook_secret?: string;
  phone_number?: string;
  business_account_id?: string;
  page_id?: string;
}
