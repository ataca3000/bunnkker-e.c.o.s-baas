/**
 * CompanyContext — single source of truth for the active company's settings.
 *
 * Loaded once after the active company changes. All currency, locale,
 * timezone and fiscal settings are consumed from here — never hardcoded.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '@/lib/axios';
import { DEFAULT_CURRENCY } from '@/lib/format';
import { useOrganizationContext } from './organization-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompanyContextValue = {
  /** ISO 4217 currency code, e.g. "EGP" */
  currency: string;
  /** Display symbol, e.g. "E£" */
  currencySymbol: string;
  /** IANA timezone, e.g. "Africa/Cairo" */
  timezone: string;
  /** BCP-47 language tag, e.g. "ar" */
  language: string;
  /** BCP-47 locale tag, e.g. "en-EG" */
  locale: string;
  /** Display token, e.g. "DD/MM/YYYY" */
  dateFormat: string;
  /** Display label, e.g. "1,234.56" */
  numberFormat: string;
  /** First day of business week */
  weekStart: string;
  /** ISO date string for fiscal year start */
  fiscalYearStart: string | null;
  /** ISO date string for fiscal year end */
  fiscalYearEnd: string | null;
  /** Whether context has been loaded at least once */
  isLoaded: boolean;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONTEXT: CompanyContextValue = {
  currency: DEFAULT_CURRENCY,
  currencySymbol: 'E£',
  timezone: 'Africa/Cairo',
  language: 'en',
  locale: 'en-EG',
  dateFormat: 'YYYY-MM-DD',
  numberFormat: '1,234.56',
  weekStart: 'Saturday',
  fiscalYearStart: null,
  fiscalYearEnd: null,
  isLoaded: false,
};

// ─── Context ──────────────────────────────────────────────────────────────────

const CompanyCtx = createContext<CompanyContextValue>(DEFAULT_CONTEXT);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { activeCompanyId } = useOrganizationContext();
  const [ctx, setCtx] = useState<CompanyContextValue>(DEFAULT_CONTEXT);

  const load = useCallback(async (companyId: string) => {
    try {
      const { data } = await api.get<{ data: Record<string, string | null> }>(
        `/context/company?company_id=${companyId}`,
      );
      const d = data.data;
      if (!d) return;
      setCtx({
        currency:        (d.currency        as string) ?? DEFAULT_CURRENCY,
        currencySymbol:  (d.currency_symbol as string) ?? 'E£',
        timezone:        (d.timezone        as string) ?? 'Africa/Cairo',
        language:        (d.language        as string) ?? 'en',
        locale:          (d.locale          as string) ?? 'en-EG',
        dateFormat:      (d.date_format     as string) ?? 'YYYY-MM-DD',
        numberFormat:    (d.number_format   as string) ?? '1,234.56',
        weekStart:       (d.week_start      as string) ?? 'Saturday',
        fiscalYearStart: d.fiscal_year_start ?? null,
        fiscalYearEnd:   d.fiscal_year_end   ?? null,
        isLoaded: true,
      });
    } catch {
      // Keep defaults — context still renders; UI degrades gracefully
      setCtx(prev => ({ ...prev, isLoaded: true }));
    }
  }, []);

  useEffect(() => {
    if (activeCompanyId) {
      load(activeCompanyId);
    } else {
      setCtx(DEFAULT_CONTEXT);
    }
  }, [activeCompanyId, load]);

  const value = useMemo(() => ctx, [ctx]);

  return <CompanyCtx.Provider value={value}>{children}</CompanyCtx.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the active company's formatting context.
 * Safe to call anywhere inside <CompanyProvider>.
 */
export function useCompany(): CompanyContextValue {
  return useContext(CompanyCtx);
}
