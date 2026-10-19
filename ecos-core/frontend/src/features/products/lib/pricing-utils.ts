/** Gross Profit % = (Regular Price − Cost) / Regular Price × 100 */
export function computeGrossProfit(
  regularPrice: number | null | undefined,
  cost: number | null | undefined,
): number | null {
  if (regularPrice == null || regularPrice <= 0 || cost == null) return null;
  return ((regularPrice - cost) / regularPrice) * 100;
}

/** Final Margin % — uses Sale Price if present, else Regular Price */
export function computeFinalMargin(
  regularPrice: number | null | undefined,
  salePrice: number | null | undefined,
  cost: number | null | undefined,
): number | null {
  const price = salePrice != null && salePrice > 0 ? salePrice : regularPrice;
  if (price == null || price <= 0 || cost == null) return null;
  return ((price - cost) / price) * 100;
}

/** Suggested Selling Price = Cost × (1 + Markup%) */
export function computeSuggestedPrice(
  cost: number | null | undefined,
  markupPct: number,
): number | null {
  if (cost == null) return null;
  return cost * (1 + markupPct / 100);
}

/** Derive current markup % from existing cost + regular price. */
export function deriveMarkupPct(
  cost: number | null | undefined,
  regularPrice: number | null | undefined,
): number {
  if (cost == null || cost <= 0 || regularPrice == null) return 30;
  return Math.round(((regularPrice - cost) / cost) * 100);
}

export type PriceHealthLabel = 'Excellent' | 'Good' | 'Low' | 'Critical';

export function getPriceHealth(marginPct: number | null): {
  label: PriceHealthLabel;
  emoji: string;
  cls: string;
} | null {
  if (marginPct == null) return null;
  if (marginPct >= 35)
    return {
      label: 'Excellent',
      emoji: '🟢',
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
    };
  if (marginPct >= 20)
    return {
      label: 'Good',
      emoji: '🟡',
      cls: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400',
    };
  if (marginPct >= 10)
    return {
      label: 'Low',
      emoji: '🟠',
      cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
    };
  return {
    label: 'Critical',
    emoji: '🔴',
    cls: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400',
  };
}

export function marginColorClass(pct: number): string {
  if (pct >= 30) return 'text-emerald-700 dark:text-emerald-400';
  if (pct >= 10) return 'text-amber-700 dark:text-amber-400';
  return 'text-red-700 dark:text-red-400';
}
