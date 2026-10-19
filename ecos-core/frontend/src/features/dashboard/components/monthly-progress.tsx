import { useTranslation } from 'react-i18next';
import { useFormatter } from '@/hooks/use-formatter';
import { Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MonthlyPerformance } from '@/features/dashboard/services/executive-dashboard.service';

interface Props {
  data?:    MonthlyPerformance;
  loading?: boolean;
}

export function MonthlyProgress({ data, loading }: Props) {
  const { moneyCompact } = useFormatter();
  const { t, i18n } = useTranslation('dashboard');

  const monthLabel = new Date().toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });

  const pct    = data?.progress_pct ?? null;
  const target = data?.revenue_target ?? null;

  // Derive progress if target exists
  const progress = pct !== null
    ? Math.min(pct, 100)
    : target !== null && data && target > 0
      ? Math.min((data.monthly_revenue / target) * 100, 100)
      : null;

  const barPct = progress ?? 0;

  const color =
    barPct >= 100 ? 'bg-emerald-500' :
    barPct >= 75  ? 'bg-indigo-500'  :
    barPct >= 50  ? 'bg-amber-500'   :
                    'bg-rose-500';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-indigo-500" />
            {t($ => $.monthly.title)} — {monthLabel}
          </CardTitle>
          {progress !== null && (
            <span className="text-sm font-bold text-foreground">
              {barPct.toFixed(1)}%
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-2.5 w-full rounded-full bg-muted" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 rounded bg-muted" />)}
            </div>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>{moneyCompact(data?.monthly_revenue ?? 0)} {t($ => $.monthly.actual)}</span>
                {target !== null
                  ? <span>{moneyCompact(target)} {t($ => $.monthly.target)}</span>
                  : <span className="italic">{t($ => $.monthly.noTarget)}</span>
                }
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${color}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </div>

            {/* 3 stat tiles */}
            <div className="grid grid-cols-3 gap-3">
              <StatTile label={t($ => $.monthly.revenue)} value={moneyCompact(data?.monthly_revenue ?? 0)} />
              <StatTile label={t($ => $.monthly.netRevenue)} value={moneyCompact(data?.monthly_revenue_net ?? 0)} />
              <StatTile label={t($ => $.monthly.orders)} value={(data?.monthly_orders ?? 0).toLocaleString()} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  );
}
