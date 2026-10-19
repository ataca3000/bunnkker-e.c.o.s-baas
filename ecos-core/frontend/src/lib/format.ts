/**
 * ECOS Formatting Utilities
 *
 * Pure functions — no React, no hooks. All formatters accept an explicit
 * `locale` parameter (BCP-47 tag, e.g. "en-EG", "ar-EG"). Passing undefined
 * falls back to the browser's environment locale, which is always better than
 * the previous hardcoded 'en-US'.
 *
 * In React components, use useFormatter() from @/hooks/use-formatter instead
 * of calling these functions directly — the hook binds the active locale and
 * company currency automatically.
 *
 * These functions remain useful for:
 *   • Non-React contexts (CSV exports, PDF generation, server-side rendering)
 *   • Utility scripts
 *   • Tests that verify raw formatting logic
 */

// ─── Money ────────────────────────────────────────────────────────────────────

/**
 * The single source of truth for the app's fallback currency (ISO 4217).
 * Used only when no company/record currency is available. Every other module
 * MUST resolve currency from Company Settings via useFormatter()/CompanyContext —
 * this constant exists so there is exactly one currency literal in the frontend.
 */
export const DEFAULT_CURRENCY = 'EGP';

/**
 * Format a monetary value using the Intl currency formatter.
 * Currency position (before/after amount) follows the locale's convention.
 */
export function formatMoney(
  amount: number,
  currency = DEFAULT_CURRENCY,
  locale?: string,
  fractionDigits = 2,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/**
 * Compact monetary format — abbreviates large values (1.5M, 250K).
 * Uses Intl compact notation when available (all modern browsers).
 */
export function formatMoneyCompact(
  amount: number,
  currency = DEFAULT_CURRENCY,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    compactDisplay: 'short',
    maximumSignificantDigits: 3,
  }).format(amount);
}

// ─── Numbers ─────────────────────────────────────────────────────────────────

/**
 * Format a plain number with locale-aware digit grouping.
 * Arabic locale (ar-EG) renders Arabic-Indic numerals automatically.
 */
export function formatNumber(
  value: number,
  decimals = 2,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a percentage value.
 * e.g. formatPercent(0.1234) → "12.34%"  |  formatPercent(12.34, false) → "12.34%"
 *
 * @param value        The value to format
 * @param asFraction   true (default) = value is 0–1; false = value is 0–100
 */
export function formatPercent(
  value: number,
  asFraction = true,
  locale?: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asFraction ? value : value / 100);
}

// ─── Dates ────────────────────────────────────────────────────────────────────

export type DateStyle = 'short' | 'medium' | 'long' | 'full';

/**
 * Format an ISO date string using Intl.DateTimeFormat.
 * Respects the locale's calendar and date ordering.
 *
 * @param isoDate   ISO 8601 date or datetime string, or null/undefined
 * @param style     Intl date style preset (default: 'medium')
 * @param locale    BCP-47 locale tag
 */
export function formatDate(
  isoDate: string | null | undefined,
  style: DateStyle = 'medium',
  locale?: string,
): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;

  return new Intl.DateTimeFormat(locale, { dateStyle: style }).format(d);
}

/**
 * Format an ISO date string using a token pattern (YYYY, MM, DD).
 * Use this only when a fixed layout is required (e.g. filenames, API params).
 * For display, prefer formatDate() which respects locale ordering.
 */
export function formatDatePattern(
  isoDate: string | null | undefined,
  pattern = 'YYYY-MM-DD',
): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;

  const yyyy = d.getFullYear().toString();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');

  return pattern.replace('YYYY', yyyy).replace('MM', mm).replace('DD', dd);
}

/**
 * Format an ISO datetime string with both date and time components.
 */
export function formatDateTime(
  isoDate: string | null | undefined,
  locale?: string,
): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Format a date as a relative time string ("3 days ago", "in 2 hours").
 * Falls back to the absolute date for intervals beyond 30 days.
 */
export function formatRelative(
  isoDate: string | null | undefined,
  locale?: string,
): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;

  const diffMs  = d.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1_000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr  = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffDay) > 30) return formatDate(isoDate, 'medium', locale);
  if (Math.abs(diffDay) >= 1)  return rtf.format(diffDay, 'day');
  if (Math.abs(diffHr)  >= 1)  return rtf.format(diffHr,  'hour');
  if (Math.abs(diffMin) >= 1)  return rtf.format(diffMin, 'minute');
  return rtf.format(diffSec, 'second');
}

// ─── Null-safe wrappers ───────────────────────────────────────────────────────

/** Returns '—' for null/undefined amounts instead of throwing. */
export function formatMoneySafe(
  amount: number | null | undefined,
  currency = DEFAULT_CURRENCY,
  locale?: string,
  fractionDigits = 2,
): string {
  if (amount === null || amount === undefined) return '—';
  return formatMoney(amount, currency, locale, fractionDigits);
}

/** Returns '—' for null/undefined values instead of throwing. */
export function formatNumberSafe(
  value: number | null | undefined,
  decimals = 2,
  locale?: string,
): string {
  if (value === null || value === undefined) return '—';
  return formatNumber(value, decimals, locale);
}
