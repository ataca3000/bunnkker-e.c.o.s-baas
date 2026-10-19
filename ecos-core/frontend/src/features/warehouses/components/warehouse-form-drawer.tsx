import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { WarehouseFormFields } from '@/features/warehouses/components/warehouse-form';
import {
  warehouseSchema,
  toFormValues,
  toPayload,
  type WarehouseFormValues,
} from '@/features/warehouses/components/warehouse-form-schema';
import { useCreateWarehouse, useUpdateWarehouse } from '@/features/warehouses/hooks/use-warehouses';
import type { Warehouse } from '@/features/warehouses/types/warehouse';

const FORM_ID = 'warehouse-form';

type WarehouseFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: Warehouse | null;
};

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

export function WarehouseFormDrawer({ open, onOpenChange, warehouse }: WarehouseFormDrawerProps) {
  const { t } = useTranslation('warehouses');
  const { t: tCommon } = useTranslation('common');
  const isEdit = Boolean(warehouse);
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: toFormValues(warehouse),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(warehouse));
    }
  }, [open, warehouse, form]);

  const isPending = createWarehouse.isPending || updateWarehouse.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const handleSubmit = (values: WarehouseFormValues) => {
    setServerError(null);
    const payload = toPayload(values);
    const handlers = {
      onSuccess: () => handleOpenChange(false),
      onError: (error: unknown) => setServerError(extractMessage(error)),
    };

    if (isEdit && warehouse) {
      updateWarehouse.mutate({ id: warehouse.id, payload }, handlers);
    } else {
      createWarehouse.mutate(payload, handlers);
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
        <WarehouseFormFields />
      </EntityForm>
    </EntityDrawer>
  );
}
