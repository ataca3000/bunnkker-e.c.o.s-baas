/**
 * CRM executive types — mirror the /crm/executive payloads.
 *
 * The period contract is validated server-side by ResolvesExecutivePeriod:
 * period + year/month/quarter, or start/end when period is 'custom'. Company is
 * taken from the authenticated user and is NOT a parameter, and there is no
 * branch filter — those dimensions are not offered by these endpoints.
 */

export type CrmPeriodKind = 'monthly' | 'quarterly' | 'annual' | 'custom';

export type CrmExecutiveQuery = {
  period?: CrmPeriodKind;
  year?: number;
  month?: number;
  quarter?: number;
  start?: string;
  end?: string;
};

/** Metric::compare() — a value with its previous period and the delta. */
export type CrmMetric = {
  value: number;
  previous: number | null;
  change: number | null;
  change_percent: number | null;
  trend: string;
};

export type CrmExecutiveKpis = {
  total_customers: number;
  active_customers: number;
  prospects: number;
  inactive_customers: number;
  archived_customers: number;
  new_customers: CrmMetric;
  by_status: Record<string, number>;
};

export type CrmGrowthPoint = {
  label: string;
  start: string;
  customers_acquired: number;
};

export type CrmExecutiveGrowth = {
  opening_customers: number;
  closing_customers: number;
  acquired: number;
  growth_rate_percent: number;
  series: CrmGrowthPoint[];
};

export type CrmExecutiveRetention = {
  customers_analysed: number;
  retention_rate_percent: number;
  churn_rate_percent: number;
  repeat_purchase_rate_percent: number;
  repeat_customers: number;
  single_purchase_customers: number;
  at_risk_customers: number;
};

export type CrmLifetimeValueCustomer = {
  customer_id: string;
  name: string;
  lifetime_value: number | string;
  predicted_lifetime_value: number | string;
  segment: string | null;
};

export type CrmExecutiveLifetimeValue = {
  customers_valued: number;
  total_lifetime_value: number | string;
  average_lifetime_value: number | string;
  top?: CrmLifetimeValueCustomer[];
};

export type CrmExecutiveSatisfaction = {
  responses: number;
  response_rate_percent: number;
  csat_percent: number;
  average_rating: number;
  nps: number;
  promoters: number;
  passives: number;
  detractors: number;
};
