import { useState } from 'react';

import { ErrorState, LoadingState, PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useHrTrendsQuery } from '@/features/hr/hooks/use-recruitment';

type SeriesKey = 'hiring' | 'turnover' | 'attendance' | 'payroll' | 'performance' | 'recruitment';

const SERIES: Array<{ key: SeriesKey; label: string }> = [
  { key: 'hiring', label: 'Hiring' },
  { key: 'turnover', label: 'Turnover' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'performance', label: 'Performance' },
  { key: 'recruitment', label: 'Recruitment' },
];

/**
 * Workforce analytics.
 *
 * Every series is a plain count or average per month. Nothing is smoothed or
 * forecast — a point here is what happened, and it can be checked against the
 * records underneath it.
 */
export function HrAnalyticsPage() {
  const [months, setMonths] = useState(12);
  const [series, setSeries] = useState<SeriesKey>('hiring');

  const { data, isLoading, isError, refetch } = useHrTrendsQuery(months);

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const points = buildPoints(data, series);
  const max = Math.max(1, ...points.map((p) => p.value));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Workforce Analytics"
        subtitle="Counted, not modelled — a month with no activity reads as zero, never as a gap."
        actions={
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        }
      />

      <div className="flex flex-wrap gap-2">
        {SERIES.map((option) => (
          <Button
            key={option.key}
            size="sm"
            variant={series === option.key ? 'default' : 'outline'}
            onClick={() => setSeries(option.key)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <h2 className="font-semibold">{SERIES.find((s) => s.key === series)?.label}</h2>

          <div className="flex h-56 items-end gap-1.5 overflow-x-auto">
            {points.map((point) => (
              <div key={point.month} className="flex min-w-[2rem] flex-1 flex-col items-center gap-1">
                <span className="text-muted-foreground text-[10px] tabular-nums">{point.value}</span>
                <div
                  className="bg-primary w-full rounded-t"
                  style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
                  title={`${point.month}: ${point.value}`}
                />
                <span className="text-muted-foreground text-[10px]">{point.month.slice(2)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="font-semibold">Turnover</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Month</th>
                    <th className="py-2 pr-4 text-right font-medium">Joiners</th>
                    <th className="py-2 pr-4 text-right font-medium">Leavers</th>
                    <th className="py-2 pr-4 text-right font-medium">Net</th>
                    <th className="py-2 pr-4 text-right font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.turnover.slice(-6).map((row) => (
                    <tr key={row.month} className="border-b last:border-0">
                      <td className="py-2 pr-4">{row.month}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">{row.joiners}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-red-600">{row.leavers}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.net_change}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{row.turnover_rate_percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="font-semibold">Department Growth</h2>
            {data.department_growth.length === 0 ? (
              <p className="text-muted-foreground text-sm">No departments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Department</th>
                      <th className="py-2 pr-4 text-right font-medium">Headcount</th>
                      <th className="py-2 pr-4 text-right font-medium">Joiners</th>
                      <th className="py-2 pr-4 text-right font-medium">Leavers</th>
                      <th className="py-2 pr-4 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.department_growth.map((row) => (
                      <tr key={row.department_id ?? row.name} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{row.name}</td>
                        <td className="py-2 pr-4 text-right tabular-nums">{row.headcount}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">{row.joiners}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-red-600">{row.leavers}</td>
                        <td
                          className={`py-2 pr-4 text-right tabular-nums ${
                            row.net_change > 0 ? 'text-emerald-600' : row.net_change < 0 ? 'text-red-600' : ''
                          }`}
                        >
                          {row.net_change > 0 ? '+' : ''}
                          {row.net_change}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Reduce whichever series is selected to a single plottable value per month. */
function buildPoints(
  data: ReturnType<typeof useHrTrendsQuery>['data'],
  series: SeriesKey,
): Array<{ month: string; value: number }> {
  if (!data) return [];

  switch (series) {
    case 'hiring':
      return data.hiring.map((p) => ({ month: p.month, value: p.hires }));
    case 'turnover':
      return data.turnover.map((p) => ({ month: p.month, value: p.leavers }));
    case 'attendance':
      return data.attendance.map((p) => ({ month: p.month, value: p.attendance_rate_percent }));
    case 'payroll':
      return data.payroll.map((p) => ({ month: p.month, value: Math.round(p.total_net) }));
    case 'performance':
      return data.performance.map((p) => ({ month: p.month, value: p.achievement_percent }));
    case 'recruitment':
      return data.recruitment.map((p) => ({ month: p.month, value: p.applications }));
    default:
      return [];
  }
}
