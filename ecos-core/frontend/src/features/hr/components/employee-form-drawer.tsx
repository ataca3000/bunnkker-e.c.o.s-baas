import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EntityDrawer } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateEmployee,
  useDepartmentsQuery,
  useEmploymentTypesQuery,
  useJobGradesQuery,
  usePositionsQuery,
} from '@/features/hr/hooks/use-hr';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const EMPTY = {
  first_name: '',
  last_name: '',
  work_email: '',
  mobile: '',
  national_id: '',
  hire_date: new Date().toISOString().slice(0, 10),
  department_id: '',
  position_id: '',
  job_grade_id: '',
  employment_type_id: '',
};

/**
 * New employee. The employee number is left blank deliberately — the backend
 * issues the next one in sequence so two people can never be given the same.
 */
export function EmployeeFormDrawer({ open, onOpenChange }: Props) {
  const { t } = useTranslation('hr');
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);

  const { data: departments } = useDepartmentsQuery();
  const { data: positions } = usePositionsQuery();
  const { data: grades } = useJobGradesQuery();
  const { data: types } = useEmploymentTypesQuery();
  const create = useCreateEmployee();

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setError(null);

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError(t($ => $.employeeForm.errors.nameRequired));
      return;
    }

    try {
      await create.mutateAsync({
        ...form,
        // Empty selects mean "not set", not an empty id.
        department_id: form.department_id || undefined,
        position_id: form.position_id || undefined,
        job_grade_id: form.job_grade_id || undefined,
        employment_type_id: form.employment_type_id || undefined,
        work_email: form.work_email || undefined,
      } as never);

      setForm({ ...EMPTY });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t($ => $.employeeForm.errors.createFailed));
    }
  };

  return (
    <EntityDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t($ => $.employeeForm.title)}
      description={t($ => $.employeeForm.description)}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t($ => $.common.cancel)}
          </Button>
          <Button onClick={() => void submit()} disabled={create.isPending}>
            {create.isPending ? t($ => $.common.creating) : t($ => $.employeeForm.submit)}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="first_name">{t($ => $.employeeForm.fields.firstName)}</Label>
            <Input id="first_name" value={form.first_name} onChange={(e) => set('first_name')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="last_name">{t($ => $.employeeForm.fields.lastName)}</Label>
            <Input id="last_name" value={form.last_name} onChange={(e) => set('last_name')(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="work_email">{t($ => $.employeeForm.fields.workEmail)}</Label>
            <Input id="work_email" type="email" value={form.work_email} onChange={(e) => set('work_email')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mobile">{t($ => $.employeeForm.fields.mobile)}</Label>
            <Input id="mobile" value={form.mobile} onChange={(e) => set('mobile')(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="national_id">{t($ => $.employeeForm.fields.nationalId)}</Label>
            <Input id="national_id" value={form.national_id} onChange={(e) => set('national_id')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hire_date">{t($ => $.employeeForm.fields.hireDate)}</Label>
            <Input id="hire_date" type="date" value={form.hire_date} onChange={(e) => set('hire_date')(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="department_id">{t($ => $.employeeForm.fields.department)}</Label>
            <select
              id="department_id"
              value={form.department_id}
              onChange={(e) => set('department_id')(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">{t($ => $.common.notAssigned)}</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="position_id">{t($ => $.employeeForm.fields.position)}</Label>
            <select
              id="position_id"
              value={form.position_id}
              onChange={(e) => set('position_id')(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">{t($ => $.common.notAssigned)}</option>
              {(positions ?? []).map((p) => (
                <option key={p.id} value={p.id} disabled={!p.has_vacancy}>
                  {p.title}
                  {p.has_vacancy ? '' : ` ${t($ => $.employeeForm.positionFull)}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job_grade_id">{t($ => $.employeeForm.fields.jobGrade)}</Label>
            <select
              id="job_grade_id"
              value={form.job_grade_id}
              onChange={(e) => set('job_grade_id')(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">{t($ => $.common.notAssigned)}</option>
              {(grades ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employment_type_id">{t($ => $.employeeForm.fields.employmentType)}</Label>
            <select
              id="employment_type_id"
              value={form.employment_type_id}
              onChange={(e) => set('employment_type_id')(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              <option value="">{t($ => $.common.notAssigned)}</option>
              {(types ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </EntityDrawer>
  );
}
