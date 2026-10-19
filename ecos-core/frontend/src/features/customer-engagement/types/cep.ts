// Customer Engagement Platform — Type System

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ConversationStatus =
  | 'open' | 'pending' | 'waiting_customer' | 'waiting_agent' | 'resolved' | 'closed';

export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type CommunicationProvider =
  | 'whatsapp' | 'messenger' | 'instagram' | 'email' | 'live_chat' | 'telegram' | 'sms';

export type MessageDirection = 'inbound' | 'outbound';

export type MessageType =
  | 'text' | 'image' | 'video' | 'audio' | 'document' | 'template' | 'location' | 'sticker' | 'system';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted' | 'lost';

export type AssignmentType =
  | 'manual' | 'round_robin' | 'department' | 'language' | 'brand' | 'channel' | 'campaign' | 'ai_routing';

// ─── Labels ───────────────────────────────────────────────────────────────────

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  open:             'Open',
  pending:          'Pending',
  waiting_customer: 'Waiting Customer',
  waiting_agent:    'Waiting Agent',
  resolved:         'Resolved',
  closed:           'Closed',
};

export const PRIORITY_LABELS: Record<ConversationPriority, string> = {
  low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
};

export const PROVIDER_LABELS: Record<CommunicationProvider, string> = {
  whatsapp:  'WhatsApp',
  messenger: 'Facebook Messenger',
  instagram: 'Instagram Direct',
  email:     'Email',
  live_chat: 'Live Chat',
  telegram:  'Telegram',
  sms:       'SMS',
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified',
  unqualified: 'Unqualified', converted: 'Converted', lost: 'Lost',
};

// ─── Provider Colors (Tailwind bg + text) ─────────────────────────────────────

export const PROVIDER_COLORS: Record<CommunicationProvider, string> = {
  whatsapp:  'bg-green-100 text-green-800',
  messenger: 'bg-blue-100 text-blue-800',
  instagram: 'bg-pink-100 text-pink-800',
  email:     'bg-gray-100 text-gray-700',
  live_chat: 'bg-indigo-100 text-indigo-800',
  telegram:  'bg-sky-100 text-sky-800',
  sms:       'bg-yellow-100 text-yellow-800',
};

export const STATUS_COLORS: Record<ConversationStatus, string> = {
  open:             'bg-green-100 text-green-800',
  pending:          'bg-yellow-100 text-yellow-800',
  waiting_customer: 'bg-orange-100 text-orange-800',
  waiting_agent:    'bg-blue-100 text-blue-800',
  resolved:         'bg-gray-100 text-gray-600',
  closed:           'bg-red-100 text-red-700',
};

// ─── Models ───────────────────────────────────────────────────────────────────

export interface Message {
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
  is_deleted: boolean;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface SlaViolation {
  id: string;
  conversation_id: string;
  sla_policy_id: string;
  violation_type: 'first_response' | 'resolution';
  status: 'pending' | 'breached' | 'resolved';
  is_breached: boolean;
  due_at: string;
  breached_at: string | null;
  resolved_at: string | null;
}

export interface Lead {
  id: string;
  conversation_id: string | null;
  business_dna_id: string | null;
  company_id: string | null;
  brand_id: string | null;
  channel_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  status: LeadStatus;
  status_label: string;
  priority: ConversationPriority;
  score: number | null;
  assigned_to: string | null;
  source: string | null;
  qualification_notes: string | null;
  converted_entity_type: string | null;
  converted_entity_id: string | null;
  tags: string[];
  qualified_at: string | null;
  converted_at: string | null;
  lost_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentLog {
  id: string;
  conversation_id: string;
  assignee_type: 'agent' | 'team';
  assignee_id: string;
  assigned_by: string | null;
  assignment_type: AssignmentType;
  notes: string | null;
  unassigned_at: string | null;
  created_at: string;
}

export interface PrivateNote {
  id: string;
  conversation_id: string;
  author_id: string;
  author_type: string;
  content: string;
  mentioned_user_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  conversation_uuid: string;
  provider: CommunicationProvider;
  provider_label: string;
  external_conversation_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  business_dna_id: string | null;
  company_id: string | null;
  brand_id: string | null;
  channel_id: string | null;
  initiative_id: string | null;
  campaign_id: string | null;
  assigned_team_id: string | null;
  assigned_employee_id: string | null;
  sla_policy_id: string | null;
  status: ConversationStatus;
  status_label: string;
  priority: ConversationPriority;
  priority_label: string;
  source: string | null;
  language: string | null;
  tags: string[];
  messages_count: number;
  unread_count: number;
  internal_notes_count: number;
  first_response_at: string | null;
  last_message_at: string | null;
  started_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  messages?: Message[];
  sla_violations?: SlaViolation[];
  lead?: Lead | null;
}

export interface SlaPolicy {
  id: string;
  company_id: string | null;
  name: string;
  first_response_minutes: number;
  resolution_minutes: number;
  business_hours_only: boolean;
  is_default: boolean;
}

export interface DashboardKpis {
  conversations: {
    total: number;
    open: number;
    pending: number;
    resolved: number;
    unread: number;
    resolvedToday: number;
    avgFirstResponse: number | null;
  };
  sla: {
    total: number;
    breached: number;
    resolved: number;
    pending: number;
    rate: number;
  };
  leads: {
    total: number;
    new: number;
    qualified: number;
    converted: number;
  };
}

// ─── API Wrappers ─────────────────────────────────────────────────────────────

export interface PaginatedCepResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
