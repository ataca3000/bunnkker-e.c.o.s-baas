import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SupplierFormFields } from '@/features/suppliers/components/supplier-form';
import {
  supplierSchema,
  toFormValues,
  toPayload,
  type SupplierFormValues,
} from '@/features/suppliers/components/supplier-form-schema';
import { useCreateSupplier, useUpdateSupplier } from '@/features/suppliers/hooks/use-suppliers';
import type { Supplier } from '@/features/suppliers/types/supplier';

const FORM_ID = 'supplier-form';

type SupplierFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
};

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

export function SupplierFormDrawer({ open, onOpenChange, supplier }: SupplierFormDrawerProps) {
  const { t } = useTranslation('suppliers');
  const { t: tCommon } = useTranslation('common');
  const isEdit = Boolean(supplier);
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: toFormValues(supplier),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(supplier));
  }, [open, supplier, form]);

  const isPending = createSupplier.isPending || updateSupplier.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const handleSubmit = (values: SupplierFormValues) => {
    setServerError(null);
    const payload = toPayload(values);
    const handlers = {
      onSuccess: () => handleOpenChange(false),
      onError: (error: unknown) => setServerError(extractMessage(error)),
    };

    if (isEdit && supplier) {
      updateSupplier.mutate({ id: supplier.id, payload }, handlers);
    } else {
      createSupplier.mutate(payload, handlers);
    }
  };

  return (
    <EntityDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isEdit ? t($ => $.drawer.editTitle) : t($ => $.drawer.createTitle)}
      description={isEdit ? t($ => $.drawer.editSubtitle) : t($ => $.drawer.createSubtitle)}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {tCommon($ => $.common.cancel)}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isPending}>
            {isPending
              ? t($ => $.drawer.saving)
              : isEdit
                ? t($ => $.drawer.submitEdit)
                : t($ => $.drawer.submitCreate)}
          </Button>
        </>
      }
    >
      {serverError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>{t($ => $.drawer.errorTitle)}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <EntityForm form={form} id={FORM_ID} onSubmit={handleSubmit}>
        <SupplierFormFields />
      </EntityForm>
    </EntityDrawer>
  );
}
