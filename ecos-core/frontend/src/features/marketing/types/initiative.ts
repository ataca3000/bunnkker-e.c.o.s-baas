import type { PaginatedResponse } from './marketing';
import type { Season, BusinessGoal } from './campaign';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type InitiativeStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'
  | 'cancelled';

// ─── Labels ───────────────────────────────────────────────────────────────────

export const INITIATIVE_STATUS_LABELS: Record<InitiativeStatus, string> = {
  draft:     'Draft',
  active:    'Active',
  paused:    'Paused',
  completed: 'Completed',
  archived:  'Archived',
  cancelled: 'Cancelled',
};

export const INITIATIVE_STATUS_COLORS: Record<InitiativeStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  active:    'bg-green-100 text-green-800',
  paused:    'bg-yellow-100 text-yellow-800',
  completed: 'bg-blue-100 text-blue-800',
  archived:  'bg-gray-200 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

export const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  launch:    'Launch',
  awareness: 'Awareness',
  growth:    'Growth',
  retention: 'Retention',
  seasonal:  'Seasonal',
};

// ─── Models ───────────────────────────────────────────────────────────────────

export interface MarketingInitiative {
  id: string;
  company_id: string | null;
  brand_id: string | null;
  channel_id: string | null;
  template_id: string | null;
  name: string;
  description: string | null;
  status: InitiativeStatus;
  status_label: string;
  business_unit: string | null;
  season: Season | null;
  business_goal: BusinessGoal | null;
  cost_center: string | null;
  budget: number | null;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  owner_id: string | null;
  marketing_team: string | null;
  internal_notes: string | null;
  tags: string[] | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Computed
  days_remaining: number | null;
  progress_percent: number | null;
  is_on_schedule: boolean;
  // Counts
  campaigns_count?: number;
  // Loaded
  template?: { id: string; name: string; slug: string } | null;
}

export interface InitiativeTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  defaults: Record<string, unknown> | null;
  is_system: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface InitiativeKpis {
  campaign_count: number;
  active_campaigns: number;
  paused_campaigns: number;
  status_breakdown: Record<string, number>;
  budget: number | null;
  total_spend: number | null;
  budget_utilization: number | null;
  total_reach: number | null;
  total_impressions: number | null;
  total_clicks: number | null;
  avg_ctr: number | null;
  avg_cpc: number | null;
  avg_cpm: number | null;
  total_purchases: number | null;
  total_leads: number | null;
  total_messages: number | null;
  // Placeholders
  estimated_revenue: null;
  estimated_profit: null;
  roas: null;
  // Timeline
  days_remaining: number | null;
  progress_percent: number | null;
  period: { preset: string; date_from?: string; date_to?: string };
}

export interface InitiativeDashboard {
  aggregate: {
    total_initiatives: number;
    active_initiatives: number;
    total_spend: number | null;
    total_reach: number | null;
    total_impressions: number | null;
    avg_ctr: number | null;
    total_purchases: number | null;
    total_leads: number | null;
  };
  status_distribution: Record<string, number>;
  goal_distribution: Record<string, number>;
  owner_distribution: Record<string, number>;
  upcoming_deadlines: Array<{
    id: string;
    name: string;
    status: string;
    end_date: string;
    days_remaining: number;
    campaigns_count: number;
  }>;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export type InitiativeListResponse = PaginatedResponse<MarketingInitiative>;
