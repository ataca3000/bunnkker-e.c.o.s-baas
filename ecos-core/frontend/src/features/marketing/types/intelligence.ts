// ── Filter DTO (mirrors IntelligenceFilterDto query params) ──────────────────

export type DatePreset =
  | 'today' | 'yesterday' | 'last_7d' | 'last_30d' | 'last_90d' | 'last_180d'
  | 'this_month' | 'last_month';

export interface IntelligenceFilters {
  connection_id?:   string;
  ad_account_id?:   string;
  campaign_id?:     string;
  status?:          string;
  date_preset?:     DatePreset | string;
  date_start?:      string;
  date_stop?:       string;
  sort_by?:         string;
  sort_direction?:  'asc' | 'desc';
  per_page?:        number;
  page?:            number;
}

export interface TrendsFilters extends IntelligenceFilters {
  granularity?: 'day' | 'week' | 'month';
  level?:       'campaign' | 'adset' | 'ad';
}

// ── Executive Dashboard ───────────────────────────────────────────────────────

export interface IntelligenceKpis {
  spend:         number | null;
  revenue:       number | null;
  roas:          number | null;
  cpa:           number | null;
  ctr:           number | null;
  ctr_pct:       number | null;
  cpc:           number | null;
  cpm:           number | null;
  purchases:     number | null;
  leads:         number | null;
  impressions:   number | null;
  clicks:        number | null;
  reach:         number | null;
  messages:      number | null;
  unique_clicks: number | null;
  engagement:    number | null;
}

export interface IntelligenceGrowth {
  spend_growth_pct?:     number | null;
  revenue_growth_pct?:   number | null;
  roas_growth_pct?:      number | null;
  purchases_growth_pct?: number | null;
  [key: string]: number | null | undefined;
}

export interface IntelligenceHealthScore {
  score:     number;
  label:     string;
  color:     string;
  breakdown: Record<string, number>;
}

export interface RankedEntity {
  entity_id:              string;
  name:                   string | null;
  marketing_campaign_id:  string;
  total_spend:            number;
  total_revenue:          number;
  total_purchases:        number;
  total_leads:            number;
  total_clicks:           number;
  total_impressions:      number;
  total_reach?:           number;
}

export interface CreativeRanked {
  creative_id:      string;
  name:             string | null;
  creative_type:    string | null;
  image_url:        string | null;
  video_url:        string | null;
  thumbnail_url:    string | null;
  headline:         string | null;
  call_to_action:   string | null;
  total_revenue:    number;
  total_spend:      number;
  total_purchases:  number;
  total_clicks:     number;
  total_impressions: number;
  total_leads:      number;
}

export interface IntelligencePeriod {
  date_from:   string;
  date_to:     string;
  days:        number;
  date_preset: string;
}

export interface ExecutiveDashboardResponse {
  period:           IntelligencePeriod;
  kpis:             IntelligenceKpis;
  growth:           IntelligenceGrowth;
  health:           IntelligenceHealthScore;
  top_campaigns:    RankedEntity[];
  worst_campaigns:  RankedEntity[];
  top_5_campaigns:  RankedEntity[];
  worst_5_campaigns: RankedEntity[];
  top_creative:     CreativeRanked | null;
  worst_creative:   CreativeRanked | null;
  top_5_creatives:  CreativeRanked[];
}

// ── Analytics (campaigns / ads / creatives) ───────────────────────────────────

export interface AnalyticsMeta {
  total:           number;
  per_page:        number;
  current_page:    number;
  last_page:       number;
  date_from:       string;
  date_to:         string;
  sort_by:         string;
  sort_direction:  string;
}

export interface CampaignAnalyticsRow {
  entity_id:             string;
  name:                  string | null;
  marketing_campaign_id: string;
  total_spend:           number;
  total_revenue:         number;
  total_purchases:       number;
  total_leads:           number;
  total_clicks:          number;
  total_impressions:     number;
  total_reach:           number;
}

export interface AdAnalyticsRow {
  entity_id:             string;
  name:                  string | null;
  marketing_campaign_id: string;
  total_spend:           number;
  total_revenue:         number;
  total_purchases:       number;
  total_leads:           number;
  total_clicks:          number;
  total_impressions:     number;
  total_reach:           number;
}

export interface CreativeAnalyticsRow {
  creative_id:       string;
  name:              string | null;
  creative_type:     string | null;
  image_url:         string | null;
  video_url:         string | null;
  thumbnail_url:     string | null;
  headline:          string | null;
  call_to_action:    string | null;
  total_revenue:     number;
  total_spend:       number;
  total_purchases:   number;
  total_clicks:      number;
  total_impressions: number;
  total_leads:       number;
}

export interface AnalyticsResponse<T> {
  data: T[];
  meta: AnalyticsMeta;
}

// ── Performance Trends ────────────────────────────────────────────────────────

export interface TrendDataPoint {
  period:      string;
  spend:       number;
  revenue:     number;
  roas:        number | null;
  cpa:         number | null;
  ctr:         number | null;
  cpc:         number | null;
  cpm:         number | null;
  purchases:   number;
  leads:       number;
  impressions: number;
  clicks:      number;
  reach:       number;
}

export interface TrendsSummary {
  total_spend:     number;
  total_revenue:   number;
  total_purchases: number;
  total_leads:     number;
  avg_roas:        number | null;
}

export interface TrendsResponse {
  data: TrendDataPoint[];
  meta: {
    granularity:  'day' | 'week' | 'month';
    level:        string;
    date_from:    string;
    date_to:      string;
    days:         number;
    data_points:  number;
    summary:      TrendsSummary;
  };
}

// ── Budget Analysis ───────────────────────────────────────────────────────────

export interface BudgetSummary {
  total_budget:       number;
  total_spend:        number;
  remaining_budget:   number;
  utilization_pct:    number;
  overspending_count: number;
  campaign_count:     number;
}

export interface BudgetCampaignRow {
  campaign_id:     string;
  campaign_name:   string | null;
  budget:          number;
  budget_type:     'LIFETIME' | 'DAILY' | 'NONE';
  spend:           number;
  remaining:       number | null;
  utilization_pct: number | null;
  spend_share_pct: number | null;
  is_overspending: boolean;
}

export interface BudgetAnalysisResponse {
  period:              { date_from: string; date_to: string; date_preset: string };
  summary:             BudgetSummary;
  campaigns:           BudgetCampaignRow[];
  ad_sets:             unknown[];
  overspending_alerts: BudgetCampaignRow[];
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface MarketingReport {
  id:           string;
  type:         string;
  status:       string;
  report_name:  string;
  filters:      Record<string, unknown>;
  row_count:    number | null;
  generated_at: string | null;
  expires_at:   string | null;
  is_expired:   boolean;
}

export interface ReportsListResponse {
  data: MarketingReport[];
  meta: {
    current_page: number;
    last_page:    number;
    total:        number;
    per_page:     number;
  };
  links?: unknown;
}
