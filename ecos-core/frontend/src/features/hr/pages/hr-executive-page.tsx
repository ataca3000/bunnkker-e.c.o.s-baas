import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';

import { ErrorState, LoadingState, PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useHrExecutiveDashboardQuery } from '@/features/hr/hooks/use-recruitment';
import { ROUTES } from '@/router/routes';

const today = () => new Date().toISOString().slice(0, 10);

const money = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * The HR Executive Dashboard.
 *
 * Visualization only: every number here is owned by another context, which is
 * why the board's figure and the operator's figure are the same figure.
 */
export function HrExecutivePage() {
  const [date, setDate] = useState(today());
  const { data, isLoading, isError, refetch } = useHrExecutiveDashboardQuery({ date });

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const { workforce, attendance, compensation, performance, recruitment, operations } = data;
  const maxFunnel = Math.max(1, ...recruitment.funnel.map((f) => f.applications));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="HR Executive"
        subtitle="The workforce on one page — every figure owned by the context that produced it."
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            />
            <Button asChild size="sm" variant="outline">
              <Link to={ROUTES.hrAnalytics}>
                <TrendingUp className="size-4" />
                Analytics
              </Link>
            </Button>
          </div>
        }
      />

      {/* Headline */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total Employees" value={workforce.total_employees} />
        <Kpi label="Present Today" value={attendance.present} tone="text-emerald-600" />
        <Kpi label="Absent Today" value={attendance.absent} tone="text-red-600" />
        <Kpi label="On Leave" value={attendance.on_leave} tone="text-amber-600" />
        <Kpi label="Not Registered" value={attendance.unregistered} tone="text-slate-400" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Workforce breakdowns — each row drills down */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">Workforce</h2>

            <Breakdown title="By Department" rows={workforce.by_department} linkPrefix="/hr/executive/departments" />
            <Breakdown title="By Branch" rows={workforce.by_branch} linkPrefix="/hr/executive/branches" />
            <Breakdown title="By Position" rows={workforce.by_position.slice(0, 6)} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <h2 className="font-semibold">Compensation — {compensation.period_month}</h2>
              {!compensation.has_run ? (
                <p className="text-muted-foreground text-sm">Payroll has not been calculated for this month.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat label="Total Payroll" value={money(compensation.total_payroll)} />
                  <Stat label="Bonuses" value={money(compensation.total_bonuses)} />
                  <Stat label="Commissions" value={money(compensation.total_commissions)} />
                  <Stat label="Deductions" value={money(compensation.total_deductions)} />
                  <Stat label="Advances" value={money(compensation.total_advances_recovered)} />
                  <Stat label="Employees Paid" value={String(compensation.employees_paid)} />
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                Awaiting decision — bonuses {compensation.pending_approvals.bonuses}, deductions{' '}
                {compensation.pending_approvals.deductions}, advances {compensation.pending_approvals.advances}.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 pt-6">
              <h2 className="font-semibold">Performance — {performance.period_month}</h2>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Goals Measured" value={String(performance.goals_measured)} />
                <Stat label="Goals Met" value={String(performance.goals_met)} />
                <Stat label="Achievement" value={`${performance.average_achievement_percent}%`} />
              </div>

              {performance.top_employees.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Top Employees</span>
                  {performance.top_employees.slice(0, 5).map((e) => (
                    <Link
                      key={e.employee_id}
                      to={`/hr/performance/employees/${e.employee_id}`}
                      className="flex items-center justify-between text-sm hover:underline"
                    >
                      <span className="font-medium">{e.name}</span>
                      <span className="tabular-nums text-emerald-600">{e.achievement_percent}%</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">Recruitment — {recruitment.period_month}</h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Open Jobs" value={String(recruitment.open_jobs)} />
              <Stat label="Applications" value={String(recruitment.applications_this_month)} />
              <Stat label="Hires" value={String(recruitment.hires_this_month)} />
              <Stat label="Hiring Rate" value={`${recruitment.hiring_rate_percent}%`} />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">Funnel</span>
              {recruitment.funnel.map((stage) => (
                <div key={stage.stage} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 truncate">{stage.stage}</span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${(stage.applications / maxFunnel) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums">{stage.applications}</span>
                </div>
              ))}
            </div>

            <Button asChild size="sm" variant="outline" className="self-start">
              <Link to={ROUTES.hrRecruitment}>Open ATS</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">Operational Availability</h2>
            <p className="text-muted-foreground text-sm">
              Who can work today, by the kind of work they do — derived from HR&apos;s own people and attendance.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Group</th>
                    <th className="py-2 pr-4 text-right font-medium">Headcount</th>
                    <th className="py-2 pr-4 text-right font-medium">Available</th>
                    <th className="py-2 pr-4 text-right font-medium">Absent</th>
                    <th className="py-2 pr-4 text-right font-medium">Leave</th>
                    <th className="py-2 pr-4 text-right font-medium">Unknown</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.groups.map((group) => (
                    <tr key={group.group} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium capitalize">{group.group}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{group.headcount}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">{group.available}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-red-600">{group.absent}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-amber-600">{group.on_leave}</td>
                      <td className="text-muted-foreground py-2 pr-4 text-right tabular-nums">{group.unregistered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className={`text-2xl font-bold ${tone ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  linkPrefix,
}: {
  title: string;
  rows: Array<{ id: string | null; name: string; employees: number }>;
  linkPrefix?: string;
}) {
  if (rows.length === 0) return null;

  const max = Math.max(1, ...rows.map((r) => r.employees));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{title}</span>
      {rows.map((row) => (
        <div key={`${title}-${row.id ?? row.name}`} className="flex items-center gap-3 text-sm">
          <span className="w-32 shrink-0 truncate">
            {linkPrefix && row.id ? (
              <Link to={`${linkPrefix}/${row.id}`} className="hover:underline">
                {row.name}
              </Link>
            ) : (
              row.name
            )}
          </span>
          <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
            <div className="bg-primary h-full rounded-full" style={{ width: `${(row.employees / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right tabular-nums">{row.employees}</span>
        </div>
      ))}
    </div>
  );
}
