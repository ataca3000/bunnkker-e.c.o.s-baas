import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus, X } from 'lucide-react';

import { ConfirmDialog, EntityDrawer, PageHeader, StatusBadge } from '@/components/crud';
import type { StatusVariant } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDecideLeave, useEmployeesQuery, useLeaveRequestsQuery, useSubmitLeave } from '@/features/hr/hooks/use-hr';
import type { LeavePayrollFlag, LeaveRequest, LeaveStatus } from '@/features/hr/types/hr';

const STATUS_TONE: Record<LeaveStatus, StatusVariant> = {
  pending: 'pending',
  approved: 'active',
  rejected: 'inactive',
  cancelled: 'archived',
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Leave Requests — submission and manager approval.
 *
 * Approving writes the covered days onto the attendance record, so the
 * availability dashboard reflects the decision immediately. The payroll flag
 * travels with the request: HR states whether the days are deducted, Payroll
 * works out what that costs.
 */
export function LeaveRequestsPage() {
  const { t } = useTranslation('hr');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [formOpen, setFormOpen] = useState(false);
  const [deciding, setDeciding] = useState<{ request: LeaveRequest; decision: 'approve' | 'reject' } | null>(null);

  const [form, setForm] = useState({
    employee_id: '',
    start_date: today(),
    end_date: today(),
    payroll_flag: 'deduct_salary' as LeavePayrollFlag,
    reason: '',
  });
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => ({ status: statusFilter || undefined }), [statusFilter]);
  const { data: requests, isLoading } = useLeaveRequestsQuery(params);
  const { data: employees } = useEmployeesQuery({ per_page: 100, status: 'active' });
  const submit = useSubmitLeave();
  const decide = useDecideLeave();

  const rows = requests ?? [];
  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  const submitRequest = async () => {
    setError(null);

    if (!form.employee_id) {
      setError(t($ => $.leave.errors.employeeRequired));
      return;
    }

    try {
      await submit.mutateAsync({ ...form, reason: form.reason || undefined });
      setForm({ ...form, reason: '', employee_id: '' });
      setFormOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t($ => $.leave.errors.submitFailed));
    }
  };

  const confirmDecision = async () => {
    if (!deciding) return;
    await decide.mutateAsync({ id: deciding.request.id, decision: deciding.decision });
    setDeciding(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.leave.title)}
        subtitle={t($ => $.leave.subtitle)}
        actions={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            {t($ => $.leave.newRequest)}
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.leave.stats.showing)}</div>
            <div className="text-2xl font-bold">{isLoading ? '—' : rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.leave.stats.awaitingApproval)}</div>
            <div className="text-2xl font-bold text-amber-600">{isLoading ? '—' : pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm">{t($ => $.leave.stats.daysRequested)}</div>
            <div className="text-2xl font-bold">
              {isLoading ? '—' : rows.reduce((sum, r) => sum + r.days_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t($ => $.common.status)}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">{t($ => $.leave.status.all)}</option>
              <option value="pending">{t($ => $.leave.status.pending)}</option>
              <option value="approved">{t($ => $.leave.status.approved)}</option>
              <option value="rejected">{t($ => $.leave.status.rejected)}</option>
              <option value="cancelled">{t($ => $.leave.status.cancelled)}</option>
            </select>
          </div>

          {rows.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">{t($ => $.leave.empty)}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-start text-xs uppercase">
                  <tr>
                    <th className="py-2 pe-4 font-medium">{t($ => $.leave.table.number)}</th>
                    <th className="py-2 pe-4 font-medium">{t($ => $.leave.table.employee)}</th>
                    <th className="py-2 pe-4 font-medium">{t($ => $.leave.table.dates)}</th>
                    <th className="py-2 pe-4 text-end font-medium">{t($ => $.leave.table.days)}</th>
                    <th className="py-2 pe-4 font-medium">{t($ => $.leave.table.payroll)}</th>
                    <th className="py-2 pe-4 font-medium">{t($ => $.leave.table.status)}</th>
                    <th className="py-2 pe-4 font-medium">{t($ => $.leave.table.decision)}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((request) => (
                    <tr key={request.id} className="border-b last:border-0">
                      <td className="py-2 pe-4 font-mono text-xs">{request.request_number}</td>
                      <td className="py-2 pe-4 font-medium">{request.employee?.name ?? '—'}</td>
                      <td className="text-muted-foreground py-2 pe-4 tabular-nums">
                        {request.start_date} → {request.end_date}
                      </td>
                      <td className="py-2 pe-4 text-end tabular-nums">{request.days_count}</td>
                      <td className="py-2 pe-4">
                        <span className={request.deducts_salary ? 'text-red-600' : 'text-emerald-600'}>
                          {request.payroll_flag_label}
                        </span>
                      </td>
                      <td className="py-2 pe-4">
                        <StatusBadge status={STATUS_TONE[request.status]} label={request.status_label} />
                      </td>
                      <td className="py-2 pe-4">
                        {request.status === 'pending' ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeciding({ request, decision: 'approve' })}
                            >
                              <Check className="size-3.5" />
                              {t($ => $.leave.approve)}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeciding({ request, decision: 'reject' })}
                            >
                              <X className="size-3.5" />
                              {t($ => $.leave.reject)}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {request.decided_at ?? '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <EntityDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        title={t($ => $.leave.form.title)}
        description={t($ => $.leave.form.description)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t($ => $.common.cancel)}
            </Button>
            <Button onClick={() => void submitRequest()} disabled={submit.isPending}>
              {submit.isPending ? t($ => $.leave.form.submitting) : t($ => $.leave.form.submit)}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employee_id">{t($ => $.common.employee)}</Label>
            <select
              id="employee_id"
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">{t($ => $.leave.form.chooseEmployee)}</option>
              {(employees?.items ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} ({employee.employee_number})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start_date">{t($ => $.leave.form.from)}</Label>
              <Input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end_date">{t($ => $.leave.form.to)}</Label>
              <Input
                id="end_date"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payroll_flag">{t($ => $.leave.form.payrollTreatment)}</Label>
            <select
              id="payroll_flag"
              value={form.payroll_flag}
              onChange={(e) => setForm({ ...form, payroll_flag: e.target.value as LeavePayrollFlag })}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="deduct_salary">{t($ => $.leave.form.deductSalary)}</option>
              <option value="do_not_deduct_salary">{t($ => $.leave.form.doNotDeductSalary)}</option>
            </select>
            <span className="text-muted-foreground text-xs">{t($ => $.leave.form.payrollHint)}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">{t($ => $.leave.form.reason)}</Label>
            <Input
              id="reason"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder={t($ => $.leave.form.optional)}
            />
          </div>
        </div>
      </EntityDrawer>

      <ConfirmDialog
        open={deciding !== null}
        onOpenChange={(open) => {
          if (!open) setDeciding(null);
        }}
        title={deciding?.decision === 'approve' ? t($ => $.leave.decide.approveTitle) : t($ => $.leave.decide.rejectTitle)}
        description={
          deciding?.decision === 'approve'
            ? t($ => $.leave.decide.approveDescription, {
                count: deciding.request.days_count,
                name: deciding.request.employee?.name ?? t($ => $.leave.decide.thisEmployee),
              })
            : t($ => $.leave.decide.rejectDescription, {
                name: deciding?.request.employee?.name ?? t($ => $.leave.decide.thisEmployee),
              })
        }
        confirmLabel={deciding?.decision === 'approve' ? t($ => $.leave.approve) : t($ => $.leave.reject)}
        variant={deciding?.decision === 'reject' ? 'destructive' : 'default'}
        loading={decide.isPending}
        onConfirm={confirmDecision}
      />
    </div>
  );
}
