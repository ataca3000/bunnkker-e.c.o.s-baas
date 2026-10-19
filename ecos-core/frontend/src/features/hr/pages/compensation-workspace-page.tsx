import { useMemo, useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { Calculator, Check, Plus, ShieldCheck, X } from 'lucide-react';

import { ConfirmDialog, PageHeader, StatusBadge } from '@/components/crud';
import type { StatusVariant } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useAdvancesQuery,
  useApproveRun,
  useBonusesQuery,
  useCalculatePayroll,
  useCreatePeriod,
  useDecideAdvance,
  useDecideBonus,
  useDecideDeduction,
  useDeductionsQuery,
  useOpenPeriod,
  usePayrollPeriodsQuery,
  usePayrollRunsQuery,
  usePayslipsQuery,
} from '@/features/hr/hooks/use-compensation';
import type { ApprovalStatus, PayrollPeriod } from '@/features/hr/types/compensation';

const STATUS_TONE: Record<ApprovalStatus, StatusVariant> = {
  pending: 'pending',
  approved: 'active',
  rejected: 'inactive',
  cancelled: 'archived',
};


type Tab = 'periods' | 'bonuses' | 'deductions' | 'advances';

/**
 * Compensation Workspace — run payroll, and decide the adjustments that feed it.
 *
 * Approving a run is the one-way door: it freezes the payslips and announces the
 * totals for Finance, which posts the entries and pays the salaries.
 */
export function CompensationWorkspacePage() {
  const { money } = useFormatter();
  const [tab, setTab] = useState<Tab>('periods');
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [approving, setApproving] = useState<{ id: string; reference: string; net: number } | null>(null);

  const { data: periods, isLoading } = usePayrollPeriodsQuery();
  const { data: runs } = usePayrollRunsQuery(selectedPeriod ? { period_id: selectedPeriod } : {});
  const { data: payslips } = usePayslipsQuery(selectedPeriod ? { period_id: selectedPeriod } : {});
  const { data: bonuses } = useBonusesQuery({ status: 'pending' });
  const { data: deductions } = useDeductionsQuery({ status: 'pending' });
  const { data: advances } = useAdvancesQuery({ status: 'pending' });

  const createPeriod = useCreatePeriod();
  const openPeriod = useOpenPeriod();
  const calculate = useCalculatePayroll();
  const approveRun = useApproveRun();
  const decideBonus = useDecideBonus();
  const decideDeduction = useDecideDeduction();
  const decideAdvance = useDecideAdvance();

  const activePeriod = useMemo(
    () => (periods ?? []).find((p) => p.id === selectedPeriod) ?? null,
    [periods, selectedPeriod],
  );

  const currentRun = (runs ?? [])[0] ?? null;
  const pendingCount = (bonuses?.length ?? 0) + (deductions?.length ?? 0) + (advances?.length ?? 0);

  const startPeriod = async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const period = await createPeriod.mutateAsync({ start_date: start, end_date: end });
    await openPeriod.mutateAsync(period.id);
    setSelectedPeriod(period.id);
  };

  const confirmApprove = async () => {
    if (!approving) return;
    await approveRun.mutateAsync(approving.id);
    setApproving(null);
  };

  const periodTone = (period: PayrollPeriod): StatusVariant =>
    period.status === 'approved' || period.status === 'closed'
      ? 'active'
      : period.status === 'calculated'
        ? 'pending'
        : 'inactive';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compensation"
        subtitle="Payroll calculates what is owed. Finance posts the entries and pays the salaries."
        actions={
          <Button size="sm" onClick={() => void startPeriod()} disabled={createPeriod.isPending}>
            <Plus className="size-4" />
            New Period
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Periods</div>
            <div className="text-2xl font-bold">{isLoading ? '—' : (periods?.length ?? 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Awaiting Decision</div>
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Current Run Net</div>
            <div className="text-2xl font-bold">
              {currentRun ? money(currentRun.total_net, currentRun.currency) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">Payslips</div>
            <div className="text-2xl font-bold">{payslips?.length ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['periods', 'Payroll Periods'],
          ['bonuses', `Bonuses (${bonuses?.length ?? 0})`],
          ['deductions', `Deductions (${deductions?.length ?? 0})`],
          ['advances', `Advances (${advances?.length ?? 0})`],
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <Button key={key} size="sm" variant={tab === key ? 'default' : 'outline'} onClick={() => setTab(key)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === 'periods' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="flex flex-col gap-3 pt-6">
              <h2 className="font-semibold">Periods</h2>
              {(periods ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">No payroll periods yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(periods ?? []).map((period) => (
                    <li key={period.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPeriod(period.id)}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                          selectedPeriod === period.id ? 'border-primary' : ''
                        }`}
                      >
                        <span className="font-medium">{period.name}</span>
                        <StatusBadge status={periodTone(period)} label={period.status_label} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardContent className="flex flex-col gap-4 pt-6">
              {activePeriod === null ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Choose a period to calculate and approve it.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{activePeriod.name}</h2>
                      <p className="text-muted-foreground text-sm">
                        {activePeriod.start_date} → {activePeriod.end_date}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!activePeriod.accepts_adjustments || calculate.isPending}
                        onClick={() => void calculate.mutateAsync(activePeriod.id)}
                      >
                        <Calculator className="size-4" />
                        {calculate.isPending ? 'Calculating…' : 'Calculate'}
                      </Button>
                      <Button
                        size="sm"
                        disabled={currentRun === null || currentRun.status === 'approved'}
                        onClick={() =>
                          currentRun &&
                          setApproving({
                            id: currentRun.id,
                            reference: currentRun.reference,
                            net: currentRun.total_net,
                          })
                        }
                      >
                        <ShieldCheck className="size-4" />
                        Approve
                      </Button>
                    </div>
                  </div>

                  {currentRun ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {([
                        ['Basic', currentRun.total_basic],
                        ['Bonus', currentRun.total_bonus],
                        ['Commission', currentRun.total_commission],
                        ['Advances', -currentRun.total_advances],
                        ['Deductions', -currentRun.total_deductions],
                        ['Gross', currentRun.total_gross],
                        ['Net', currentRun.total_net],
                        ['Employees', currentRun.employees_count],
                      ] as Array<[string, number]>).map(([label, value]) => (
                        <div key={label} className="rounded-md border px-3 py-2">
                          <div className="text-muted-foreground text-xs">{label}</div>
                          <div className="text-sm font-medium tabular-nums">
                            {label === 'Employees' ? value : money(value, currentRun.currency)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Not calculated yet — recalculating is safe until the run is approved.
                    </p>
                  )}

                  {(payslips ?? []).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                          <tr>
                            <th className="py-2 pr-4 font-medium">Employee</th>
                            <th className="py-2 pr-4 text-right font-medium">Basic</th>
                            <th className="py-2 pr-4 text-right font-medium">Bonus</th>
                            <th className="py-2 pr-4 text-right font-medium">Commission</th>
                            <th className="py-2 pr-4 text-right font-medium">Deductions</th>
                            <th className="py-2 pr-4 text-right font-medium">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(payslips ?? []).map((slip) => (
                            <tr key={slip.id} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium">{slip.employee?.name ?? '—'}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{slip.basic_salary.toFixed(2)}</td>
                              <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">
                                {slip.bonus_total.toFixed(2)}
                              </td>
                              <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">
                                {slip.commission_total.toFixed(2)}
                              </td>
                              <td className="py-2 pr-4 text-right tabular-nums text-red-600">
                                {(slip.deduction_total + slip.advance_total).toFixed(2)}
                              </td>
                              <td className="py-2 pr-4 text-right font-medium tabular-nums">
                                {slip.net_salary.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab !== 'periods' ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h2 className="font-semibold">
              {tab === 'bonuses' ? 'Bonuses' : tab === 'deductions' ? 'Deductions' : 'Advances'} awaiting a decision
            </h2>
            <p className="text-muted-foreground text-sm">
              Only approved items reach a payslip — nothing here is applied automatically.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Employee</th>
                    <th className="py-2 pr-4 font-medium">{tab === 'advances' ? 'Type' : 'Reason'}</th>
                    <th className="py-2 pr-4 text-right font-medium">Amount</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {(tab === 'bonuses' ? bonuses : tab === 'deductions' ? deductions : advances)?.map((item) => {
                    const anyItem = item as unknown as {
                      id: string;
                      employee: { name: string } | null;
                      reason?: string;
                      type_label?: string;
                      amount: number;
                      currency: string;
                      status: string;
                    };

                    return (
                      <tr key={anyItem.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{anyItem.employee?.name ?? '—'}</td>
                        <td className="text-muted-foreground py-2 pr-4">
                          {tab === 'advances' ? anyItem.type_label : anyItem.reason}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {money(anyItem.amount, anyItem.currency)}
                        </td>
                        <td className="py-2 pr-4">
                          <StatusBadge status={STATUS_TONE[anyItem.status as ApprovalStatus] ?? 'pending'} label={anyItem.status} />
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (tab === 'bonuses') void decideBonus.mutateAsync({ id: anyItem.id, decision: 'approve' });
                                else if (tab === 'deductions') void decideDeduction.mutateAsync({ id: anyItem.id, decision: 'approve' });
                                else void decideAdvance.mutateAsync({ id: anyItem.id, decision: 'approve' });
                              }}
                            >
                              <Check className="size-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (tab === 'bonuses') void decideBonus.mutateAsync({ id: anyItem.id, decision: 'reject' });
                                else if (tab === 'deductions') void decideDeduction.mutateAsync({ id: anyItem.id, decision: 'reject' });
                                else void decideAdvance.mutateAsync({ id: anyItem.id, decision: 'cancel' });
                              }}
                            >
                              <X className="size-3.5" />
                              {tab === 'advances' ? 'Cancel' : 'Reject'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={approving !== null}
        onOpenChange={(open) => {
          if (!open) setApproving(null);
        }}
        title="Approve Payroll"
        description={`Approve run ${approving?.reference ?? ''} with a net of ${money(approving?.net ?? 0)}? This freezes the payslips, recovers the advance installments they took, and hands the totals to Finance. A correction after this is a new run.`}
        confirmLabel="Approve Payroll"
        loading={approveRun.isPending}
        onConfirm={confirmApprove}
      />
    </div>
  );
}
