import { useTranslation } from 'react-i18next';

import { EntityDrawer } from '@/components/crud/entity-drawer';
import { useToast } from '@/components/ds';
import { CrmCustomerForm } from '@/features/crm/components/crm-customer-form';
import type {
  CrmCustomerCreateValues,
  CrmCustomerUpdateValues,
} from '@/features/crm/components/crm-customer-form-schema';
import {
  useCreateCrmCustomer,
  useUpdateCrmCustomer,
} from '@/features/crm/hooks/use-crm-customers';
import type { CrmCustomer } from '@/features/crm/types/crm-customer';

/**
 * The shared host for create and edit.
 *
 * One drawer, two modes: the form underneath is already split by mode because
 * the API accepts different fields for POST and PATCH, so this only owns the
 * panel, the mutation and the toast. Keeping the host single means the CRM
 * module has one place where a customer is written.
 */

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Absent for create; present for edit. */
  customer?: CrmCustomer;
  onSaved?: () => void;
};

export function CrmCustomerFormDrawer({ open, onOpenChange, customer, onSaved }: Props) {
  const { t } = useTranslation('crm');
  const { toast } = useToast();

  const create = useCreateCrmCustomer();
  const update = useUpdateCrmCustomer();

  const isEdit = Boolean(customer);
  const isSaving = create.isPending || update.isPending;

  function finish(message: string) {
    toast({ title: message });
    onOpenChange(false);
    onSaved?.();
  }

  function fail() {
    toast({ title: t(($) => $.form.failedToast), variant: 'destructive' });
  }

  function handleCreate(values: CrmCustomerCreateValues) {
    create.mutate(values, {
      onSuccess: () => finish(t(($) => $.form.createdToast)),
      onError: fail,
    });
  }

  function handleUpdate(values: CrmCustomerUpdateValues) {
    if (!customer) return;

    update.mutate(
      { id: customer.id, values },
      { onSuccess: () => finish(t(($) => $.form.updatedToast)), onError: fail },
    );
  }

  return (
    <EntityDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t(($) => $.form.editTitle) : t(($) => $.form.createTitle)}
      description={isEdit ? t(($) => $.form.editSubtitle) : t(($) => $.form.createSubtitle)}
    >
      {customer ? (
        <CrmCustomerForm
          mode="edit"
          customer={customer}
          onSubmit={handleUpdate}
          onCancel={() => onOpenChange(false)}
          isSaving={isSaving}
        />
      ) : (
        <CrmCustomerForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => onOpenChange(false)}
          isSaving={isSaving}
        />
      )}
    </EntityDrawer>
  );
}
