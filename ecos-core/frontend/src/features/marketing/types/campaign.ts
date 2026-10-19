import type { ConnectorType, PaginatedResponse } from './marketing';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type CampaignStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'DELETED'
  | 'ARCHIVED'
  | 'IN_PROCESS'
  | 'WITH_ISSUES';

export type CampaignObjective =
  | 'outcome_awareness'
  | 'outcome_traffic'
  | 'outcome_engagement'
  | 'outcome_leads'
  | 'outcome_app_promotion'
  | 'outcome_sales'
  | 'outcome_store_traffic'
  | 'reach'
  | 'link_clicks'
  | 'post_engagement'
  | 'video_views'
  | 'lead_generation'
  | 'messages'
  | 'conversions'
  | 'catalog_sales'
  | 'store_visits'
  | 'brand_awareness'
  | 'app_installs'
  | 'page_likes'
  | 'event_responses'
  | 'local_awareness';

export type CampaignLevel = 'campaign' | 'adset' | 'ad';

export type Season =
  | 'ramadan' | 'summer' | 'black_friday' | 'winter'
  | 'mothers_day' | 'eid_al_fitr' | 'eid_al_adha'
  | 'new_year' | 'back_to_school' | 'custom';

export type BusinessGoal =
  | 'customer_acquisition' | 'customer_retention' | 'product_launch'
  | 'brand_awareness' | 'sales_growth' | 'market_expansion'
  | 'churn_reduction' | 'seasonal_push' | 'other';

export type CreativeType =
  | 'image' | 'video' | 'carousel' | 'collection' | 'story' | 'reel' | 'other';

// ─── Labels ───────────────────────────────────────────────────────────────────

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  ACTIVE:      'Active',
  PAUSED:      'Paused',
  DELETED:     'Deleted',
  ARCHIVED:    'Archived',
  IN_PROCESS:  'In Process',
  WITH_ISSUES: 'With Issues',
};

export const CAMPAIGN_OBJECTIVE_LABELS: Partial<Record<string, string>> = {
  outcome_awareness:  'Awareness',
  outcome_traffic:    'Traffic',
  outcome_engagement: 'Engagement',
  outcome_leads:      'Lead Generation',
  outcome_sales:      'Sales',
  outcome_app_promotion: 'App Promotion',
  outcome_store_traffic: 'Store Traffic',
  conversions:        'Conversions',
  messages:           'Messages',
  video_views:        'Video Views',
  brand_awareness:    'Brand Awareness',
  reach:              'Reach',
  link_clicks:        'Link Clicks',
  post_engagement:    'Post Engagement',
  catalog_sales:      'Catalog Sales',
};

export const SEASON_LABELS: Record<Season, string> = {
  ramadan:        'Ramadan',
  summer:         'Summer',
  black_friday:   'Black Friday',
  winter:         'Winter',
  mothers_day:    "Mother's Day",
  eid_al_fitr:    'Eid Al-Fitr',
  eid_al_adha:    'Eid Al-Adha',
  new_year:       'New Year',
  back_to_school: 'Back to School',
  custom:         'Custom',
};

export const BUSINESS_GOAL_LABELS: Record<BusinessGoal, string> = {
  customer_acquisition: 'Customer Acquisition',
  customer_retention:   'Customer Retention',
  product_launch:       'Product Launch',
  brand_awareness:      'Brand Awareness',
  sales_growth:         'Sales Growth',
  market_expansion:     'Market Expansion',
  churn_reduction:      'Churn Reduction',
  seasonal_push:        'Seasonal Push',
  other:                'Other',
};

// ─── Models ───────────────────────────────────────────────────────────────────

export interface CampaignInsightSummary {
  date_start: string;
  date_stop: string;
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  reach: number | null;
  purchases: number | null;
  leads: number | null;
  messages: number | null;
  synced_at: string;
}

export interface CampaignBusinessContext {
  company_id: string | null;
  brand_id: string | null;
  channel_id: string | null;
  season: Season | null;
  business_goal: BusinessGoal | null;
  internal_priority: 'low' | 'medium' | 'high' | 'critical' | null;
  internal_status: string | null;
  internal_notes: string | null;
  internal_tags: string[] | null;
  marketing_owner_id: string | null;
  cost_center: string | null;
  marketing_team: string | null;
  business_unit: string | null;
  custom_season: string | null;
  updated_by: string | null;
}

export interface Campaign {
  id: string;
  marketing_connection_id: string | null;
  company_id: string | null;
  connector_type: ConnectorType;
  external_campaign_id: string;
  external_account_id: string | null;
  name: string;
  status: CampaignStatus;
  objective: CampaignObjective | null;
  buying_type: string | null;
  bid_strategy: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  budget_remaining: number | null;
  budget_display: string;
  start_time: string | null;
  stop_time: string | null;
  health_status: string | null;
  last_synced_at: string | null;
  next_sync_at: string | null;
  provider_created_at: string | null;
  provider_updated_at: string | null;
  created_at: string | null;
  latest_insight: CampaignInsightSummary | null;
  business_context?: CampaignBusinessContext | null;
  ad_sets_count?: number;
  ads_count?: number;
}

export interface CampaignAdSet {
  id: string;
  marketing_campaign_id: string;
  marketing_connection_id: string;
  external_ad_set_id: string;
  external_campaign_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  bid_amount: number | null;
  bid_strategy: string | null;
  optimization_goal: string | null;
  billing_event: string | null;
  targeting: Record<string, unknown> | null;
  start_time: string | null;
  end_time: string | null;
  last_synced_at: string | null;
  created_at: string | null;
  ads_count?: number;
}

export interface CampaignAd {
  id: string;
  marketing_campaign_id: string;
  marketing_campaign_ad_set_id: string;
  marketing_connection_id: string;
  external_ad_id: string;
  external_ad_set_id: string;
  external_campaign_id: string;
  name: string;
  status: string;
  creative_id: string | null;
  last_synced_at: string | null;
  created_at: string | null;
  creative?: CampaignCreative | null;
}

export interface CampaignCreative {
  id: string;
  marketing_connection_id: string;
  marketing_campaign_id: string;
  marketing_campaign_ad_id: string;
  external_creative_id: string;
  name: string;
  creative_type: CreativeType;
  headline: string | null;
  primary_text: string | null;
  call_to_action: string | null;
  image_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  link_url: string | null;
  asset_feed: Record<string, unknown> | null;
  has_media: boolean;
  last_synced_at: string | null;
  created_at: string | null;
}

export interface CampaignInsight {
  id: string;
  marketing_campaign_id: string;
  marketing_campaign_ad_set_id: string | null;
  marketing_campaign_ad_id: string | null;
  connector_type: ConnectorType;
  level: CampaignLevel;
  date_start: string;
  date_stop: string;
  spend: number | null;
  reach: number | null;
  impressions: number | null;
  frequency: number | null;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
  clicks: number | null;
  outbound_clicks: number | null;
  landing_page_views: number | null;
  video_views: number | null;
  messages: number | null;
  leads: number | null;
  purchases: number | null;
  add_to_cart: number | null;
  initiate_checkout: number | null;
  conversions: number | null;
  cost_per_result: number | null;
  synced_at: string;
  created_at: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export type CampaignListResponse = PaginatedResponse<Campaign>;
export type CampaignAdSetListResponse = PaginatedResponse<CampaignAdSet>;
export type CampaignAdListResponse = PaginatedResponse<CampaignAd>;
export type CampaignInsightListResponse = PaginatedResponse<CampaignInsight>;
export type CampaignCreativeListResponse = PaginatedResponse<CampaignCreative>;

export interface CampaignDashboardResponse {
  kpis: {
    total_spend: number | null;
    total_impressions: number | null;
    total_clicks: number | null;
    total_reach: number | null;
    total_purchases: number | null;
    total_leads: number | null;
    total_messages: number | null;
    avg_ctr: number | null;
    avg_cpc: number | null;
    avg_cpm: number | null;
    campaign_count: number;
  };
  campaigns: { total: number; active: number };
  status_distribution: Record<string, number>;
  daily_trend: Array<{
    date_start: string;
    spend: number | null;
    impressions: number | null;
    ctr: number | null;
    cpc: number | null;
  }>;
  period: { days: number; date_from: string; date_to: string };
}
