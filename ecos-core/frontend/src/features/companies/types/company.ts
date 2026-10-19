/**
 * Companies feature types and constants.
 */

export type Company = {
  id: string;
  code: string;
  name: string;
  legal_name: string | null;
  tax_number: string | null;
  commercial_registration: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  currency: string | null;
  timezone: string | null;
  language: string | null;
  locale: string | null;
  date_format: string | null;
  number_format: string | null;
  week_start: string | null;
  fiscal_year_start: string | null;
  fiscal_year_end: string | null;
  description: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  logo: string | null;
  is_active: boolean;
  brands_count: number;
  warehouses_count: number;
  teams_count: number;
  channels_count: number;
  business_accounts_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type CompanyPayload = {
  code?: string;
  name: string;
  legal_name?: string;
  tax_number?: string;
  commercial_registration?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  currency?: string;
  timezone?: string;
  language?: string;
  locale?: string;
  date_format?: string;
  number_format?: string;
  week_start?: string;
  fiscal_year_start?: string;
  fiscal_year_end?: string;
  description?: string;
  country?: string;
  city?: string;
  address?: string;
  postal_code?: string;
  logo?: string;
  is_active: boolean;
};

export type CompanySortField =
  | 'code'
  | 'name'
  | 'currency'
  | 'timezone'
  | 'country'
  | 'is_active'
  | 'created_at'
  | 'updated_at';

export type SortDirection = 'asc' | 'desc';
export type CompanyStatusFilter = 'all' | 'active' | 'inactive';

export type CompaniesQuery = {
  search?: string;
  page?: number;
  per_page?: number;
  sort_by?: CompanySortField;
  sort_dir?: SortDirection;
  status?: CompanyStatusFilter;
};

export type PaginationMeta = {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
};

export type CompaniesResult = {
  items: Company[];
  meta: PaginationMeta;
};

// ─── Dropdown constants ───────────────────────────────────────────────────────

export const COMPANY_CURRENCIES = [
  { value: 'EGP', label: 'EGP — Egyptian Pound' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'AED', label: 'AED — UAE Dirham' },
] as const;

export const COMPANY_TIMEZONES = [
  { value: 'Africa/Cairo', label: 'Africa/Cairo (UTC+2)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (UTC+3)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1)' },
  { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (UTC+8)' },
  { value: 'UTC', label: 'UTC (UTC+0)' },
] as const;

