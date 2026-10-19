import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatter } from '@/hooks/use-formatter';
import type { ExecutiveTrendSeries } from '../types/executive';

/**
 * Executive Trends.
 *
 * ┌─ EVERY NUMBER HERE CAME FROM THE SERVER ────────────────────────────────┐
 * │ last / change_pct / direction / explanation are rendered exactly as       │
 * │ `GET /finance/intelligence/trends` returned them. The sparkline is drawn  │
 * │ from the same `series` points — it is a projection of the payload onto a  │
 * │ viewBox, not a computed or smoothed curve, and it interpolates nothing    │
 * │ between the months the server supplied.                                    │
 * │                                                                            │
 * │ Direction colour follows `higherIsBetter` per series: rising EXPENSE is    │
 * │ not good news, so it must not render green.                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Expense is the one series where a rise is bad. */
const HIGHER_IS_BETTER: Record<string, boolean> = {
  revenue: true,
  expense: false,
  profit: true,
  margin: true,
};

/**
 * Project the points onto a 100×32 viewBox.
 *
 * A flat series (max === min) is drawn on the centre line rather than dividing
 * by a zero range, and a single point is drawn as a full-width flat line so the
 * series is still visible.
 */
function sparklinePath(points: ExecutiveTrendSeries['points']): string {
  if (points.length === 0) return '';

  const values = points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;

  const x = (index: number) => (points.length === 1 ? 50 : (index / (points.length - 1)) * 100);
  const y = (value: number) => (range === 0 ? 16 : 32 - ((value - min) / range) * 28 - 2);

  if (points.length === 1) return `M 0 ${y(values[0])} L 100 ${y(values[0])}`;

  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
}

/**
 * `label` is resolved by the page: i18next runs in selector mode, so a dynamic
 * `t(series.labelKey)` would not typecheck.
 */
type TranslatedSeries = ExecutiveTrendSeries & { label: string };

function TrendRow({ series }: { series: TranslatedSeries }) {
  const { number, percent } = useFormatter();
  const higherIsBetter = HIGHER_IS_BETTER[series.id] ?? true;

  const format = (value: number | null) =>
    value === null ? '—' : series.format === 'percent' ? percent(value) : number(value);

  const DirectionIcon =
    series.direction === 'up' ? ArrowUpRight : series.direction === 'down' ? ArrowDownRight : Minus;

  // 'flat' and an absent direction are both neutral — neither is an improvement
  // nor a regression, so neither earns a colour.
  const tone =
    series.direction === 'up' || series.direction === 'down'
      ? (series.direction === 'up') === higherIsBetter
        ? 'text-emerald-600'
        : 'text-destructive'
      : 'text-muted-foreground';

  const stroke =
    tone === 'text-emerald-600'
      ? 'stroke-emerald-600'
      : tone === 'text-destructive'
        ? 'stroke-destructive'
        : 'stroke-muted-foreground';

  const first = series.points[0];
  const last = series.points[series.points.length - 1];

  return (
    <li className="flex flex-col gap-2 border-b pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {series.label}
        </span>
        <span className={`flex items-center gap-1 text-xs tabular-nums ${tone}`}>
          <DirectionIcon className="size-3.5 shrink-0" />
          {series.changePct === null ? '—' : percent(series.changePct)}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xl font-semibold tabular-nums">{format(series.last)}</span>

        <svg
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          className="h-8 flex-1"
          role="img"
          aria-label={series.explanation ?? series.label}
        >
          <path
            d={sparklinePath(series.points)}
            fill="none"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            className={stroke}
          />
        </svg>
      </div>

      {/* The month range the server actually returned — so a short or padded
          series is visible rather than silently implied to be the full window. */}
      {first && last ? (
        <div className="text-muted-foreground flex justify-between text-[0.6875rem] tabular-nums">
          <span>{first.label}</span>
          <span>{last.label}</span>
        </div>
      ) : null}

      {series.explanation ? (
        <p className="text-muted-foreground text-xs">{series.explanation}</p>
      ) : null}
    </li>
  );
}

export function ExecutiveTrendPanel({
  title,
  empty,
  restricted,
  unavailable,
  series,
  isLoading = false,
  isRestricted = false,
  isError = false,
}: {
  title: string;
  empty: string;
  restricted: string;
  unavailable: string;
  /** Each series carries its already-translated `label`. */
  series: TranslatedSeries[];
  isLoading?: boolean;
  isRestricted?: boolean;
  isError?: boolean;
}) {
  const body = () => {
    if (isRestricted) return <p className="text-muted-foreground text-sm">{restricted}</p>;
    if (isError) return <p className="text-muted-foreground text-sm">{unavailable}</p>;

    if (isLoading) {
      return (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      );
    }

    if (series.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;

    return (
      <ul className="flex flex-col gap-4">
        {series.map((s) => (
          <TrendRow key={s.id} series={s} />
        ))}
      </ul>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{body()}</CardContent>
    </Card>
  );
}
