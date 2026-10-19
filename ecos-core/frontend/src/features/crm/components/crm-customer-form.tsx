import type { ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EntityForm, FormField } from '@/components/crud/entity-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  crmCustomerCreateSchema,
  crmCustomerUpdateSchema,
  type CrmCustomerCreateValues,
  type CrmCustomerUpdateValues,
} from '@/features/crm/components/crm-customer-form-schema';
import type { CrmCustomer } from '@/features/crm/types/crm-customer';

/**
 * Create / edit form for a CRM customer.
 *
 * The two modes are genuinely different, not one form with fields disabled:
 * POST /crm/customers accepts type, status, phone and email; PATCH does not.
 * Showing those on edit would invite changes the API silently discards, so in
 * edit mode they are absent and the reason is stated on screen.
 *
 * Every sub-component lives at module scope. Declared inside the parent they
 * would be a new component type on every render, so React would unmount and
 * remount each field — losing focus on every keystroke.
 */

// ── Layout pieces ────────────────────────────────────────────────────────────

/** One column on mobile, two from small up — the rhythm used by other ERP forms. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <legend className="mb-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function NotesField({ register, label }: { register: UseFormRegisterReturn; label: string }) {
  return (
    <FormField name="notes" label={label} optional>
      <Textarea {...register} rows={3} />
    </FormField>
  );
}

function Actions({
  onCancel,
  isSaving,
  cancelLabel,
  saveLabel,
  savingLabel,
}: {
  onCancel: () => void;
  isSaving?: boolean;
  cancelLabel: string;
  saveLabel: string;
  savingLabel: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="submit" disabled={isSaving}>
        {isSaving ? savingLabel : saveLabel}
      </Button>
    </div>
  );
}

// ── Create ───────────────────────────────────────────────────────────────────

type CreateProps = {
  mode: 'create';
  onSubmit: (values: CrmCustomerCreateValues) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

function CreateCustomerForm({ onSubmit, onCancel, isSaving }: Omit<CreateProps, 'mode'>) {
  const { t } = useTranslation('crm');
  const form = useForm<CrmCustomerCreateValues>({
    resolver: zodResolver(crmCustomerCreateSchema),
    defaultValues: { type: 'individual' },
  });
  const type = useWatch({ control: form.control, name: 'type' });

  return (
    <EntityForm form={form} onSubmit={onSubmit} className="flex flex-col gap-5">
      <Section title={t(($) => $.form.sectionIdentity)}>
        <FormField name="type" label={t(($) => $.form.fields.type)} required>
          <select
            {...form.register('type')}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="individual">{t(($) => $.type.individual)}</option>
            <option value="business">{t(($) => $.type.business)}</option>
          </select>
        </FormField>

        {/* Which name identifies the customer depends on the type. */}
        {type === 'business' ? (
          <FormField name="business_name" label={t(($) => $.form.fields.businessName)} required>
            <Input {...form.register('business_name')} />
          </FormField>
        ) : (
          <>
            <FormField name="first_name" label={t(($) => $.form.fields.firstName)} required>
              <Input {...form.register('first_name')} />
            </FormField>
            <FormField name="last_name" label={t(($) => $.form.fields.lastName)} optional>
              <Input {...form.register('last_name')} />
            </FormField>
          </>
        )}

        <FormField
          name="tax_registration_number"
          label={t(($) => $.form.fields.taxNumber)}
          optional
        >
          <Input {...form.register('tax_registration_number')} />
        </FormField>
        <FormField name="contact_person" label={t(($) => $.form.fields.contactPerson)} optional>
          <Input {...form.register('contact_person')} />
        </FormField>
      </Section>

      <Section title={t(($) => $.form.sectionContact)}>
        <FormField name="phone" label={t(($) => $.form.fields.phone)} optional>
          <Input {...form.register('phone')} inputMode="tel" />
        </FormField>
        <FormField name="email" label={t(($) => $.form.fields.email)} optional>
          <Input {...form.register('email')} type="email" inputMode="email" />
        </FormField>
        <FormField name="country" label={t(($) => $.form.fields.country)} optional>
          <Input {...form.register('country')} />
        </FormField>
        <FormField name="city" label={t(($) => $.form.fields.city)} optional>
          <Input {...form.register('city')} />
        </FormField>
      </Section>

      <Section title={t(($) => $.form.sectionPreferences)}>
        <FormField name="preferred_language" label={t(($) => $.form.fields.language)} optional>
          <Input {...form.register('preferred_language')} />
        </FormField>
        <FormField
          name="preferred_contact_method"
          label={t(($) => $.form.fields.contactMethod)}
          optional
        >
          <Input {...form.register('preferred_contact_method')} />
        </FormField>
      </Section>

      <NotesField register={form.register('notes')} label={t(($) => $.form.fields.notes)} />

      <Actions
        onCancel={onCancel}
        isSaving={isSaving}
        cancelLabel={t(($) => $.form.cancel)}
        saveLabel={t(($) => $.form.save)}
        savingLabel={t(($) => $.form.saving)}
      />
    </EntityForm>
  );
}

// ── Edit ─────────────────────────────────────────────────────────────────────

type EditProps = {
  mode: 'edit';
  customer: CrmCustomer;
  onSubmit: (values: CrmCustomerUpdateValues) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

function EditCustomerForm({
  customer,
  onSubmit,
  onCancel,
  isSaving,
}: Omit<EditProps, 'mode'>) {
  const { t } = useTranslation('crm');
  const form = useForm<CrmCustomerUpdateValues>({
    resolver: zodResolver(crmCustomerUpdateSchema),
    defaultValues: {
      first_name: customer.first_name ?? undefined,
      last_name: customer.last_name ?? undefined,
      business_name: customer.business_name ?? undefined,
      tax_registration_number: customer.tax_registration_number ?? undefined,
      preferred_language: customer.preferred_language ?? undefined,
      preferred_contact_method: customer.preferred_contact_method ?? undefined,
    },
  });

  return (
    <EntityForm form={form} onSubmit={onSubmit} className="flex flex-col gap-5">
      <Section title={t(($) => $.form.sectionIdentity)}>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {t(($) => $.form.identityLocked)}
        </p>
        <FormField name="first_name" label={t(($) => $.form.fields.firstName)} optional>
          <Input {...form.register('first_name')} />
        </FormField>
        <FormField name="last_name" label={t(($) => $.form.fields.lastName)} optional>
          <Input {...form.register('last_name')} />
        </FormField>
        <FormField name="business_name" label={t(($) => $.form.fields.businessName)} optional>
          <Input {...form.register('business_name')} />
        </FormField>
        <FormField
          name="tax_registration_number"
          label={t(($) => $.form.fields.taxNumber)}
          optional
        >
          <Input {...form.register('tax_registration_number')} />
        </FormField>
        <FormField name="contact_person" label={t(($) => $.form.fields.contactPerson)} optional>
          <Input {...form.register('contact_person')} />
        </FormField>
      </Section>

      <Section title={t(($) => $.form.sectionContact)}>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          {t(($) => $.form.contactLocked)}
        </p>
        <FormField name="country" label={t(($) => $.form.fields.country)} optional>
          <Input {...form.register('country')} />
        </FormField>
        <FormField name="city" label={t(($) => $.form.fields.city)} optional>
          <Input {...form.register('city')} />
        </FormField>
      </Section>

      <Section title={t(($) => $.form.sectionPreferences)}>
        <FormField name="preferred_language" label={t(($) => $.form.fields.language)} optional>
          <Input {...form.register('preferred_language')} />
        </FormField>
        <FormField
          name="preferred_contact_method"
          label={t(($) => $.form.fields.contactMethod)}
          optional
        >
          <Input {...form.register('preferred_contact_method')} />
        </FormField>
      </Section>

      <NotesField register={form.register('notes')} label={t(($) => $.form.fields.notes)} />

      <Actions
        onCancel={onCancel}
        isSaving={isSaving}
        cancelLabel={t(($) => $.form.cancel)}
        saveLabel={t(($) => $.form.save)}
        savingLabel={t(($) => $.form.saving)}
      />
    </EntityForm>
  );
}

// ── Entry point ──────────────────────────────────────────────────────────────

export type CrmCustomerFormProps = CreateProps | EditProps;

export function CrmCustomerForm(props: CrmCustomerFormProps) {
  return props.mode === 'edit' ? (
    <EditCustomerForm
      customer={props.customer}
      onSubmit={props.onSubmit}
      onCancel={props.onCancel}
      isSaving={props.isSaving}
    />
  ) : (
    <CreateCustomerForm
      onSubmit={props.onSubmit}
      onCancel={props.onCancel}
      isSaving={props.isSaving}
    />
  );
}
