import { api } from '@/lib/axios';

export type TrendPct = number | null;

export interface SalesKpis {
  revenue_today:        number;
  revenue_yesterday:    number;
  revenue_this_month:   number;
  revenue_trend_pct:    TrendPct;
  orders_today:         number;
  orders_yesterday:     number;
  orders_this_month:    number;
  orders_trend_pct:     TrendPct;
  orders_shipped_today: number;
  value_shipped_today:  number;
  aov:                  number;
  gross_profit_today:   number;
  gross_profit_month:   number;
  pending_count:        number;
  confirmed_count:      number;
  preparing_count:      number;
  out_for_delivery:     number;
  delivered_count:      number;
  cancelled_today:      number;
}

export interface MarketingKpis {
  spend_today:          number;
  spend_yesterday:      number;
  spend_this_month:     number;
  spend_trend_pct:      TrendPct;
  campaign_revenue:     number;
  roas:                 number | null;
  cac:                  number | null;
  conversion_rate:      number | null;
  purchases_month:      number;
  impressions_month:    number;
  new_customers:        number;
  returning_customers:  number;
}

export interface ShippingKpis {
  shipments_today:            number;
  delivered_today:            number;
  failed_today:               number;
  returns_today:              number;
  shipping_revenue_today:     number;
  shipping_revenue_yesterday: number;
  cod_collected_today:        number;
  cod_pending:                number;
  avg_delivery_minutes:       number | null;
}

export interface MonthlyPerformance {
  monthly_revenue:     number;
  monthly_revenue_net: number;
  monthly_orders:      number;
  revenue_target:      number | null;
  progress_pct:        number | null;
}

export interface OperationsSnapshot {
  active_waves: number;
  active_trips: number;
}

export interface ExecutiveDashboardData {
  sales:      SalesKpis;
  marketing:  MarketingKpis;
  shipping:   ShippingKpis;
  monthly:    MonthlyPerformance;
  operations: OperationsSnapshot;
}

export const executiveDashboardService = {
  async get(): Promise<ExecutiveDashboardData> {
    const { data } = await api.get<ExecutiveDashboardData>('/admin/executive-dashboard');
    return data;
  },
};
