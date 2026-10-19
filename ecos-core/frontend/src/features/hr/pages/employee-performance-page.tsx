import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { ErrorState, LoadingState, PageHeader } from '@/components/crud';
import { Card, CardContent } from '@/components/ui/card';
import { useEmployeePerformanceQuery } from '@/features/hr/hooks/use-compensation';
import type { PerformanceStatusKey } from '@/features/hr/types/compensation';
import { ROUTES } from '@/router/routes';

const currentMonth = () => new Date().toISOString().slice(0, 7);

const STATUS_COLOR: Record<PerformanceStatusKey, string> = {
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
 * Employee Performance Dashboard — target, actual, achievement and status.
 *
 * Every actual is collected from the operational modules, so the number on this
 * page is the same one the commission engine and the bonus recommendation read.
 */
export function EmployeePerformancePage() {
  const { employeeId = '' } = useParams();
  const [month, setMonth] = useState(currentMonth());

  const { data, isLoading, isError, refetch } = useEmployeePerformanceQuery(employeeId, month);

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const { employee, overall, goals, measured_metrics: measured, review, history } = data;
  const overallStatus = (overall.status as PerformanceStatusKey) ?? 'missed';
  const maxHistory = Math.max(100, ...history.map((h) => h.achievement_percent));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${employee.name} — Performance`}
        subtitle={`${employee.employee_number} · ${month}`}
        breadcrumbs={[
          { label: 'Workforce', to: ROUTES.hr },
          { label: 'Performance', to: ROUTES.hrPerformance },
          { label: employee.name },
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Overall Achievement</div>
            <div className={`text-2xl font-bold ${STATUS_COLOR[overallStatus] ?? ''}`}>
              {overall.achievement_percent}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Goals</div>
            <div className="text-2xl font-bold">{overall.goals}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Targets Met</div>
            <div className="text-2xl font-bold text-emerald-600">{overall.met_targets ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Manager Rating</div>
            <div className="text-2xl font-bold">{review ? `${review.overall_rating}/5` : '—'}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <h2 className="font-semibold">Goals</h2>
          {goals.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No goals set for {month}.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {goals.map((goal) => (
                <div key={goal.metric_key} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{goal.label}</span>
                    <span className={`tabular-nums ${STATUS_COLOR[goal.status]}`}>
                      {goal.achievement_percent}% · {goal.status_label}
                    </span>
                  </div>
                  <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full ${BAR_COLOR[goal.status]}`}
                      style={{ width: `${Math.min(100, goal.achievement_percent)}%` }}
                    />
                  </div>
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>
                      actual {goal.actual.toLocaleString()} of {goal.target.toLocaleString()}
                    </span>
                    <span>
                      {goal.facts} fact{goal.facts === 1 ? '' : 's'} from {goal.module ?? '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">Trend</h2>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-sm">No history yet.</p>
            ) : (
              <div className="flex h-40 items-end gap-2">
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

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">Measured This Month</h2>
            {/* What was collected, whether or not anyone set a target for it. */}
            {measured.length === 0 ? (
              <p className="text-muted-foreground text-sm">No operational facts collected yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {measured.map((metric) => (
                  <li key={metric.metric_key} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{metric.label}</span>
                      <span className="text-muted-foreground text-xs">from {metric.module ?? '—'}</span>
                    </div>
                    <span className="text-sm tabular-nums">{metric.actual.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {review ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="font-semibold">Manager Review</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-muted-foreground text-xs uppercase">Strengths</div>
                <p className="text-sm">{review.strengths ?? '—'}</p>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase">To Improve</div>
                <p className="text-sm">{review.improvement_notes ?? '—'}</p>
              </div>
              <div>
                <div className="text-muted-foreground text-xs uppercase">Comments</div>
                <p className="text-sm">{review.manager_comments ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
