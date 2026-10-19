import { Controller, useFormContext } from 'react-hook-form';

import { FormField } from '@/components/crud';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CompanySelect } from '@/features/branches/components/company-select';
import type { TeamCreateFormValues, TeamUpdateFormValues } from './team-form-schema';

type TeamFormFieldsProps = {
  mode: 'create' | 'edit';
};

export function TeamFormFields({ mode }: TeamFormFieldsProps) {
  const { register, control } = useFormContext<TeamCreateFormValues & TeamUpdateFormValues>();

  return (
    <div className="flex flex-col gap-4">
      {mode === 'create' && (
        <FormField name="company_id" label="Company" required>
          <Controller
            control={control}
            name="company_id"
            render={({ field }) => (
              <CompanySelect value={field.value || null} onChange={field.onChange} />
            )}
          />
        </FormField>
      )}

      <FormField name="name" label="Name" required>
        <Input placeholder="e.g. Sales Team Cairo" {...register('name')} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="code" label="Code" description="Auto-generated if blank">
          <Input placeholder="TM-000001" {...register('code')} />
        </FormField>
        <FormField name="leader_name" label="Leader Name">
          <Input placeholder="e.g. Ahmed Hassan" {...register('leader_name')} />
        </FormField>
      </div>

      <FormField name="description" label="Description">
        <Textarea
          placeholder="Brief description of this team…"
          rows={3}
          {...register('description')}
        />
      </FormField>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="border-input size-4 rounded" {...register('is_active')} />
        Active
      </label>
    </div>
  );
}
