import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatter } from '@/hooks/use-formatter';
import type { ExecutiveKpi } from '../types/executive';

/**
 * One executive KPI.
 *
 * A metric the payload did not carry renders as an em dash, never as zero — an
 * executive board must be able to distinguish "nothing happened" from "we do
 * not have this number", and a confident 0 erases that difference.
 *
 * Direction colour follows `higherIsBetter`, so a rise in expenses or open
 * exceptions reads as bad rather than green.
 */
export function ExecutiveKpiCard({
  kpi,
  label,
  isLoading = false,
}: {
  kpi: ExecutiveKpi;
  /**
   * Already translated by the caller.
   *
   * i18next runs in SELECTOR mode here, which validates a selector path rather
   * than a string key — so a dynamic `t(kpi.labelKey)` would not typecheck. The
   * page owns the selector and hands the resolved text down.
   */
  label: string;
  isLoading?: boolean;
}) {
  const { money, number, percent } = useFormatter();

  const rendered = (() => {
    if (kpi.value === null || kpi.value === undefined) return '—';

    if (typeof kpi.value === 'string') return kpi.value;

    switch (kpi.format) {
      case 'currency':
        return money(kpi.value);
      case 'percent':
        return percent(kpi.value);
      case 'number':
        return number(kpi.value);
      default:
        return String(kpi.value);
    }
  })();

  const delta = kpi.delta ?? null;
  const improving = delta === null ? null : (kpi.higherIsBetter ?? true) === delta > 0;

  const DeltaIcon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 pt-6">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {label}
        </span>

        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <span className="text-2xl font-semibold tabular-nums">{rendered}</span>
        )}

        {delta !== null && !isLoading ? (
          <span
            className={`flex items-center gap-1 text-xs ${
              improving ? 'text-emerald-600' : 'text-destructive'
            }`}
          >
            <DeltaIcon className="size-3.5" />
            {percent(Math.abs(delta))}
          </span>
        ) : null}

        {kpi.hint && !isLoading ? (
          <span className="text-muted-foreground text-xs">{kpi.hint}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}
