/**
 * useFormatter — Locale-aware formatting for React components.
 *
 * This is the primary API for formatting money, numbers, and dates.
 * Components should use this hook instead of calling format.ts functions
 * directly, because the hook automatically binds:
 *   • The active display locale  (derived from UI language + company region)
 *   • The company's currency     (from CompanyContext)
 *
 * Usage
 * ─────
 *   const fmt = useFormatter();
 *
 *   fmt.money(1234.56)                // "EGP 1,234.56"  (en-EG)
 *   fmt.money(1234.56)                // "١٬٢٣٤٫٥٦ ج.م.‏"  (ar-EG)
 *   fmt.moneyCompact(1_500_000)       // "EGP 1.5M"
 *   fmt.number(9876.5, 1)             // "9,876.5"
 *   fmt.percent(0.1234)               // "12.34%"
 *   fmt.date("2026-07-19")            // "Jul 19, 2026"  (en-EG)
 *   fmt.date("2026-07-19", "short")   // "7/19/26"
 *   fmt.dateTime("2026-07-19T10:30")  // "Jul 19, 2026, 10:30 AM"
 *   fmt.relative("2026-07-18T10:00")  // "yesterday"  /  "أمس"
 *
 * The returned object is memoized — it only changes when the locale or
 * currency changes, so it is stable across unrelated re-renders.
 */
import { useMemo } from 'react';

import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
  formatRelative,
  type DateStyle,
} from '@/lib/format';
import { useLocale } from '@/hooks/use-locale';

export type Formatters = {
  /**
   * Format money using the company's currency.
   * Pass currencyOverride to format in a different currency (e.g. USD invoice).
   */
  money: (
    amount: number | null | undefined,
    currencyOverride?: string,
    fractionDigits?: number,
  ) => string;

  /** Compact format for large amounts (K / M abbreviations). */
  moneyCompact: (amount: number | null | undefined) => string;

  /** Locale-aware number with configurable decimal places. */
  number: (value: number | null | undefined, decimals?: number) => string;

  /** Locale-aware percentage. Value is 0–1 by default (asFraction=true). */
  percent: (value: number | null | undefined, asFraction?: boolean) => string;

  /** Date from ISO string with Intl style preset. */
  date: (isoDate: string | null | undefined, style?: DateStyle) => string;

  /** Date + time from ISO string. */
  dateTime: (isoDate: string | null | undefined) => string;

  /** Relative time ("3 days ago", "أمس") with 30-day absolute fallback. */
  relative: (isoDate: string | null | undefined) => string;

  /** The resolved BCP-47 locale tag (read-only, useful for Intl overrides). */
  locale: string;

  /** The active ISO 4217 currency code (read-only). */
  currency: string;
};

export function useFormatter(): Formatters {
  const { locale, currency } = useLocale();

  return useMemo<Formatters>(
    () => ({
      locale,
      currency,

      money(amount, currencyOverride, fractionDigits) {
        if (amount === null || amount === undefined) return '—';
        return formatMoney(amount, currencyOverride ?? currency, locale, fractionDigits);
      },

      moneyCompact(amount) {
        if (amount === null || amount === undefined) return '—';
        return formatMoneyCompact(amount, currency, locale);
      },

      number(value, decimals = 2) {
        if (value === null || value === undefined) return '—';
        return formatNumber(value, decimals, locale);
      },

      percent(value, asFraction = true) {
        if (value === null || value === undefined) return '—';
        return formatPercent(value, asFraction, locale);
      },

      date(isoDate, style = 'medium') {
        return formatDate(isoDate, style, locale);
      },

      dateTime(isoDate) {
        return formatDateTime(isoDate, locale);
      },

      relative(isoDate) {
        return formatRelative(isoDate, locale);
      },
    }),
    [locale, currency],
  );
}
