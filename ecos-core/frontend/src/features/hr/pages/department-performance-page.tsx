import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ErrorState, LoadingState, PageHeader } from '@/components/crud';
import { Card, CardContent } from '@/components/ui/card';
import { useDepartmentPerformanceQuery } from '@/features/hr/hooks/use-compensation';
import type { PerformanceStatusKey } from '@/features/hr/types/compensation';
import { ROUTES } from '@/router/routes';

const currentMonth = () => new Date().toISOString().slice(0, 7);

const STATUS_COLOR: Record<string, string> = {
  exceeded: 'text-emerald-600',
  achieved: 'text-emerald-600',
  on_track: 'text-sky-600',
  at_risk: 'text-amber-600',
  missed: 'text-red-600',
};

const BAR_COLOR: Record<PerformanceStatusKey, string> = {
  exceeded: 'bg-emerald-500',
  achieved: 'bg-emerald-500',
  on_track: 'bg-sky-500',
  at_risk: 'bg-amber-500',
  missed: 'bg-red-500',
};

/**
 * Department Performance Dashboard — team performance, goal achievement, rankings.
 *
 * The ranking is built from each member's own snapshots, so it agrees with every
 * individual dashboard by construction rather than by coincidence.
 */
export function DepartmentPerformancePage() {
  const { departmentId = '' } = useParams();
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading, isError, refetch } = useDepartmentPerformanceQuery(departmentId, month);

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const { team, rankings, department_goals: goals, history } = data;
  const maxHistory = Math.max(100, ...history.map((h) => h.achievement_percent));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Department Performance"
        subtitle={`Team results for ${month}`}
        breadcrumbs={[
          { label: 'Workforce', to: ROUTES.hr },
          { label: 'Performance', to: ROUTES.hrPerformance },
          { label: 'Department' },
        ]}
        actions={
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Headcount</div>
            <div className="text-2xl font-bold">{team.headcount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">With Goals</div>
            <div className="text-2xl font-bold">{team.with_goals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Team Average</div>
            <div className={`text-2xl font-bold ${STATUS_COLOR[team.status] ?? ''}`}>
              {team.average_achievement_percent}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Meeting Target</div>
            <div className="text-2xl font-bold text-emerald-600">{team.meeting_target}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Needing Attention</div>
            <div className="text-2xl font-bold text-amber-600">{team.needing_attention}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">Rankings</h2>
            {rankings.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Nobody in this department yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                    <tr>
                      <th className="py-2 pr-4 font-medium">#</th>
                      <th className="py-2 pr-4 font-medium">Employee</th>
                      <th className="py-2 pr-4 text-right font-medium">Goals</th>
                      <th className="py-2 pr-4 text-right font-medium">Achievement</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((row) => (
                      <tr key={row.employee_id} className="border-b last:border-0">
                        <td className="py-2 pr-4 tabular-nums">{row.rank}</td>
                        <td className="py-2 pr-4 font-medium">
                          <Link to={`/hr/performance/employees/${row.employee_id}`} className="hover:underline">
                            {row.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">{row.goals}</td>
                        <td className={`py-2 pr-4 text-right tabular-nums ${STATUS_COLOR[row.status] ?? ''}`}>
                          {row.achievement_percent}%
                        </td>
                        <td className="text-muted-foreground py-2 pr-4">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <h2 className="font-semibold">Department Goals</h2>
              {goals.length === 0 ? (
                <p className="text-muted-foreground text-sm">No department-level goals set.</p>
              ) : (
                goals.map((goal) => (
                  <div key={goal.metric_key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{goal.label}</span>
                      <span className={STATUS_COLOR[goal.status] ?? ''}>{goal.achievement_percent}%</span>
                    </div>
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${BAR_COLOR[goal.status]}`}
                        style={{ width: `${Math.min(100, goal.achievement_percent)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {goal.actual.toLocaleString()} of {goal.target.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <h2 className="font-semibold">Trend</h2>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-sm">No history yet.</p>
              ) : (
                <div className="flex h-28 items-end gap-2">
                  {history.map((point) => (
                    <div key={point.period_month} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t ${BAR_COLOR[point.status]}`}
                        style={{ height: `${Math.max(4, (point.achievement_percent / maxHistory) * 100)}%` }}
                        title={`${point.achievement_percent}%`}
                      />
                      <span className="text-muted-foreground text-[10px]">{point.period_month.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
