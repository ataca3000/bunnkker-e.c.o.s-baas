import { useParams } from 'react-router-dom';
import { useFormatter } from '@/hooks/use-formatter';

import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/crud';
import type { StatusVariant } from '@/components/crud/types';
import { Card, CardContent } from '@/components/ui/card';
import { useCompensation360Query } from '@/features/hr/hooks/use-compensation';
import type { ApprovalStatus } from '@/features/hr/types/compensation';
import { ROUTES } from '@/router/routes';

const STATUS_TONE: Record<ApprovalStatus, StatusVariant> = {
  pending: 'pending',
  approved: 'active',
  rejected: 'inactive',
  cancelled: 'archived',
};


/**
 * Employee Compensation 360 — the whole picture of one person's pay.
 *
 * What they earn, what the commission rules would pay them this month, what they
 * owe and what has been deducted, plus the payslip history.
 */
export function Compensation360Page() {
  const { money } = useFormatter();
  const { employeeId = '' } = useParams();
  const { data, isLoading, isError, refetch } = useCompensation360Query(employeeId);

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;

  const { employee, salary, commission, advances, bonuses, deductions, payslips } = data;
  const mtd = commission.month_to_date.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${employee.name} — Compensation`}
        subtitle={`${employee.employee_number} · basic ${money(salary.basic_salary, salary.currency)}`}
        breadcrumbs={[
          { label: 'Workforce', to: ROUTES.hr },
          { label: 'Compensation', to: ROUTES.hrCompensation },
          { label: employee.name },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Basic Salary</div>
            <div className="text-2xl font-bold">{money(salary.basic_salary, salary.currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Commission (MTD)</div>
            <div className="text-2xl font-bold text-emerald-600">{money(mtd, salary.currency)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Advance Balance</div>
            <div className="text-2xl font-bold text-amber-600">
              {money(advances.remaining_balance, salary.currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Awaiting Decision</div>
            <div className="text-2xl font-bold">
              {data.pending_approvals.bonuses + data.pending_approvals.deductions}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">Commission Rules In Force</h2>
            {commission.rules.length === 0 ? (
              <p className="text-muted-foreground text-sm">No commission rule applies to this employee.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {commission.rules.map((rule) => (
                  <li key={rule.code} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{rule.name}</span>
                      <span className="text-muted-foreground font-mono text-xs">{rule.metric_key}</span>
                    </div>
                    <span className="text-sm tabular-nums">
                      {rule.method === 'percentage_of_value' ? `${rule.rate}%` : rule.rate.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {commission.month_to_date.length > 0 ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Earned this month</h3>
                {commission.month_to_date.map((entry) => (
                  <div key={entry.rule_code} className="rounded-md border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{entry.rule_name}</span>
                      <span className="text-sm font-medium tabular-nums">
                        {money(entry.amount, salary.currency)}
                      </span>
                    </div>
                    {/* Every commission figure carries the inputs that produced it. */}
                    <div className="text-muted-foreground mt-1 text-xs">
                      base {String(entry.explanation.base ?? '—')} · rate {String(entry.explanation.rate ?? '—')} ·{' '}
                      {String(entry.explanation.formula ?? '')}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">Advances</h2>
            {advances.open.length === 0 ? (
              <p className="text-muted-foreground text-sm">No outstanding advances.</p>
            ) : (
              advances.open.map((advance) => (
                <div key={advance.id} className="flex flex-col gap-2 rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{advance.reference}</span>
                    <span className="text-sm tabular-nums">
                      {money(advance.remaining_balance, salary.currency)} of{' '}
                      {money(advance.amount, salary.currency)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {advance.schedule.map((installment) => (
                      <span
                        key={installment.id}
                        className={`rounded px-2 py-0.5 text-xs tabular-nums ${
                          installment.status === 'recovered'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        #{installment.sequence} {installment.amount.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}

            <h2 className="mt-2 font-semibold">Salary History</h2>
            <ul className="flex flex-col gap-1">
              {salary.history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between text-sm">
                  <span className="tabular-nums">{money(entry.basic_salary, salary.currency)}</span>
                  <span className="text-muted-foreground text-xs">
                    {entry.effective_from} → {entry.effective_to ?? 'current'}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="font-semibold">Bonuses</h2>
            {bonuses.length === 0 ? (
              <p className="text-muted-foreground text-sm">No bonuses recorded.</p>
            ) : (
              bonuses.map((bonus) => (
                <div key={bonus.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{bonus.reason}</span>
                    <span className="text-muted-foreground text-xs">
                      {bonus.awarded_on} · {bonus.source === 'performance_recommendation' ? 'from performance' : 'manual'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">{money(bonus.amount, salary.currency)}</span>
                    <StatusBadge status={STATUS_TONE[bonus.status]} label={bonus.status} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <h2 className="font-semibold">Deductions</h2>
            {deductions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deductions recorded.</p>
            ) : (
              deductions.map((deduction) => (
                <div key={deduction.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{deduction.type_label}</span>
                    <span className="text-muted-foreground text-xs">
                      {deduction.reason}
                      {deduction.source_reference ? ` · ${deduction.source_module}/${deduction.source_reference}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums">{money(deduction.amount, salary.currency)}</span>
                    <StatusBadge status={STATUS_TONE[deduction.status]} label={deduction.status} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <h2 className="font-semibold">Payslip History</h2>
          {payslips.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payslips yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Period</th>
                    <th className="py-2 pr-4 text-right font-medium">Basic</th>
                    <th className="py-2 pr-4 text-right font-medium">Bonus</th>
                    <th className="py-2 pr-4 text-right font-medium">Commission</th>
                    <th className="py-2 pr-4 text-right font-medium">Advances</th>
                    <th className="py-2 pr-4 text-right font-medium">Deductions</th>
                    <th className="py-2 pr-4 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((slip) => (
                    <tr key={slip.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{slip.period ?? '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{slip.basic_salary.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{slip.bonus_total.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{slip.commission_total.toFixed(2)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-red-600">
                        {slip.advance_total.toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-red-600">
                        {slip.deduction_total.toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 text-right font-medium tabular-nums">{slip.net_salary.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
