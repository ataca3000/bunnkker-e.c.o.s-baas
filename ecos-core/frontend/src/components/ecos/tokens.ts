/**
 * ECOS Design Tokens
 *
 * Semantic constants that document the design system values used across
 * the application. These are references — the actual values live in the
 * Tailwind/CSS-variable layer. Use these tokens to document *intent* and
 * to make intent-driven decisions in component logic (e.g. status colors).
 */

// ── Status semantic colors ────────────────────────────────────────────────────
// Maps to Tailwind utility classes; duplicated here for discoverability.

export const STATUS_COLORS = {
  success: 'emerald',
  warning: 'amber',
  error:   'red',
  info:    'blue',
  neutral: 'muted',
} as const;

// ── Badge variants ────────────────────────────────────────────────────────────

export const BADGE_VARIANTS = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-800',
  warning: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-800',
  error:   'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-800',
  info:    'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-800',
  neutral: 'text-muted-foreground bg-muted border-border',
} as const;

export type BadgeVariant = keyof typeof BADGE_VARIANTS;

// ── Layout constants ──────────────────────────────────────────────────────────

export const LAYOUT = {
  /** Height of the sticky page header bar (px). */
  headerHeight: 56,
  /** Height of the sticky status-tabs bar (px). */
  tabsHeight: 40,
  /** Height of the toolbar strip below status tabs (px). */
  toolbarHeight: 40,
  /** Standard table row height (px). */
  rowHeight: 44,
  /** Minimum drawer width at tablet breakpoint (px). */
  drawerMinWidth: 480,
  /** Full-width drawer at mobile breakpoint (px). */
  drawerMobileBreakpoint: 640,
} as const;

// ── Animation durations ───────────────────────────────────────────────────────

export const DURATION = {
  /** Tooltip/popover open delay (ms). */
  tooltipDelay: 300,
  /** "Copied!" feedback reset (ms). */
  copiedReset: 1500,
  /** Debounce for search inputs (ms). */
  searchDebounce: 300,
  /** Skeleton shimmer cycle (ms). */
  skeleton: 1500,
} as const;

// ── Pagination ────────────────────────────────────────────────────────────────

export const PAGINATION = {
  defaultPageSize: 20,
  pageSizeOptions: [20, 50, 100] as const,
} as const;

// ── localStorage key namespacing ──────────────────────────────────────────────

export const LS_PREFIX = 'ecos_';

export function lsKey(...parts: string[]): string {
  return `${LS_PREFIX}${parts.join('_')}`;
}
