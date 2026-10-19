/**
 * useLocale — derives the active formatting locale from the union of:
 *   • The UI language  (from LanguageContext  — controls script/numerals)
 *   • The company region (from CompanyContext — controls regional conventions)
 *
 * Why two contexts?
 *   LanguageContext holds the user's display language ('en' | 'ar').
 *   CompanyContext holds the company's configured locale ('en-EG', 'ar-EG' …).
 *
 *   The formatter locale is always derived as:
 *     {uiLanguage}-{companyRegion}
 *
 *   Examples:
 *     UI=en + company=en-EG  →  en-EG  (English with Egypt conventions)
 *     UI=ar + company=en-EG  →  ar-EG  (Arabic-Indic numerals, Egypt calendar)
 *     UI=en + company=en-US  →  en-US  (English with US conventions)
 *
 *   This ensures:
 *     • Switching the UI to Arabic renders Arabic-Indic numerals everywhere.
 *     • The company's regional date/number conventions are always respected.
 */
import { useLanguage } from '@/providers/language-context';
import { useCompany } from '@/features/organization/context/company-context';
import type { Dir } from '@/providers/language-context';

export type LocaleInfo = {
  /** BCP-47 locale used for Intl formatters, e.g. "ar-EG", "en-EG" */
  locale: string;
  /** ISO 4217 currency code from company settings, e.g. "EGP" */
  currency: string;
  /** Currency display symbol from company settings, e.g. "E£" */
  currencySymbol: string;
  /** Display token for date formatting, e.g. "DD/MM/YYYY" */
  dateFormat: string;
  /** Current text direction */
  dir: Dir;
  /** Whether the company context has been loaded from the server */
  isLoaded: boolean;
};

function deriveLocale(language: string, companyLocale: string): string {
  const region = companyLocale.includes('-')
    ? companyLocale.split('-').slice(1).join('-')
    : 'EG';
  return `${language}-${region}`;
}

export function useLocale(): LocaleInfo {
  const { language, dir } = useLanguage();
  const {
    locale: companyLocale,
    currency,
    currencySymbol,
    dateFormat,
    isLoaded,
  } = useCompany();

  return {
    locale: deriveLocale(language, companyLocale),
    currency,
    currencySymbol,
    dateFormat,
    dir,
    isLoaded,
  };
}
