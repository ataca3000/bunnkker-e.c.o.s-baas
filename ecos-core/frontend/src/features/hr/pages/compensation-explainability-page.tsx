import { useState } from 'react';

import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useAdjustmentDecisionMutation,
  useCommissionPreviewQuery,
  usePendingAdjustmentsQuery,
} from '@/features/hr/hooks/use-hr-enhancements';
import { usePayrollPeriodsQuery } from '@/features/hr/hooks/use-compensation';
import type { CommissionPreviewEmployee } from '@/features/hr/types/recruitment-enhancements';

/**
 * Commission preview and post-approval adjustments.
 *
 * The preview runs the same engine payroll runs, so what is shown here and what
 * lands on the payslip cannot disagree. Nothing on this screen writes to a
 * payslip — the only writes are decisions on adjustments, which exist precisely
 * because approved pay can no longer be edited.
 */
export function CompensationExplainabilityPage() {
  const [periodId, setPeriodId] = useState<string | undefined>(undefined);

  const { data: periods } = usePayrollPeriodsQuery();
  const activePeriodId = periodId ?? periods?.[0]?.id;

  const { data: preview, isLoading, isError, refetch } = useCommissionPreviewQuery(activePeriodId);
  const { data: adjustments } = usePendingAdjustmentsQuery();
  const decide = useAdjustmentDecisionMutation();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compensation Explainability"
        subtitle="What every commission figure is made of, before anyone approves it — and how approved pay gets corrected."
        actions={
          <select
            value={activePeriodId ?? ''}
            onChange={(e) => setPeriodId(e.target.value || undefined)}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
          >
            {(periods ?? []).map((period) => (
              <option key={period.id} value={period.id}>
                {period.name ?? period.code}
              </option>
            ))}
          </select>
        }
      />

      {/* ── Commission preview ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Commission Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading && <LoadingState />}
          {isError && <ErrorState onRetry={() => void refetch()} />}

          {preview && (
            <>
              <div className="flex flex-wrap items-baseline gap-4 text-sm">
                <span>
                  <span className="text-muted-foreground">Period </span>
                  <span className="font-medium">{preview.period.code}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Employees earning </span>
                  <span className="font-medium tabular-nums">{preview.employees_with_commission}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Total </span>
                  <span className="font-medium tabular-nums">
                    {preview.total_commission.toLocaleString()} {preview.currency}
                  </span>
                </span>
              </div>

              <p className="text-muted-foreground text-xs">{preview.note}</p>

              {preview.employees.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No commission is earned in this period. Nothing matched a rule, or no facts were received.
                </p>
              )}

              {preview.employees.map((row) => (
                <EmployeeCommission key={row.employee.id} row={row} currency={preview.currency} />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Adjustments ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Adjustments awaiting approval</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            Raised against payroll that has already been approved. The original stays exactly as it was; the correction
            is carried by an open period, with its own reason and approver.
          </p>

          {(adjustments ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">Nothing is waiting for a decision.</p>
          )}

          {(adjustments ?? []).map((adjustment) => (
            <div
              key={adjustment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
            >
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{adjustment.reference}</span>
                  <span className="font-medium">{adjustment.employee_name ?? adjustment.employee_number}</span>
                  <StatusBadge status="warning" label={adjustment.component_label} />
                </div>
                <span className="text-muted-foreground text-xs">{adjustment.reason}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="tabular-nums font-medium">
                  {adjustment.amount > 0 ? '+' : ''}
                  {adjustment.amount.toLocaleString()} {adjustment.currency}
                  <span className="text-muted-foreground ml-1 text-xs">({adjustment.direction})</span>
                </span>
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: adjustment.id, action: 'approve' })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: adjustment.id, action: 'reject' })}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** Employee → Metric → Rule → Calculation → Commission, in that order. */
function EmployeeCommission({ row, currency }: { row: CommissionPreviewEmployee; currency: string }) {
  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b p-3">
        <div>
          <span className="font-medium">{row.employee.name}</span>
          <span className="text-muted-foreground ml-2 font-mono text-xs">{row.employee.employee_number}</span>
        </div>
        <span className="tabular-nums font-medium">
          {row.total.toLocaleString()} {currency}
        </span>
      </div>

      <div className="divide-y">
        {row.lines.map((line) => (
          <div key={line.rule.id} className="grid gap-2 p-3 text-sm lg:grid-cols-[1fr_1fr_1fr_auto]">
            <div>
              <p className="text-muted-foreground text-xs uppercase">Metric</p>
              <p>{line.metric.label}</p>
              <p className="text-muted-foreground text-xs">
                {line.metric.measured_value.toLocaleString()} from {line.metric.facts_counted} fact(s)
                {line.metric.source_module ? ` · ${line.metric.source_module}` : ''}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs uppercase">Rule</p>
              <p>{line.rule.name}</p>
              <p className="text-muted-foreground text-xs">
                {line.rule.code} · {line.rule.method}
                {line.rule.version !== null ? ` · v${line.rule.version}` : ''}
                {line.rule.effective_from ? ` · from ${line.rule.effective_from}` : ''}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs uppercase">Calculation</p>
              <p className="font-mono text-xs">{line.calculation.worked}</p>
              <p className="text-muted-foreground text-xs">{line.calculation.formula}</p>
              {line.calculation.note && <p className="text-muted-foreground text-xs">{line.calculation.note}</p>}
            </div>

            <div className="lg:text-right">
              <p className="text-muted-foreground text-xs uppercase">Commission</p>
              <p className="tabular-nums font-medium">{line.commission.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
