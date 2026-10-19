import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { UnitFormFields } from '@/features/units/components/unit-form';
import {
  unitSchema,
  toFormValues,
  toPayload,
  type UnitFormValues,
} from '@/features/units/components/unit-form-schema';
import { useCreateUnit, useUpdateUnit } from '@/features/units/hooks/use-units';
import type { Unit } from '@/features/units/types/unit';

const FORM_ID = 'unit-form';

type UnitFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: Unit | null;
};

function extractMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : fallback;
}

export function UnitFormDrawer({ open, onOpenChange, unit }: UnitFormDrawerProps) {
  const { t } = useTranslation('units');
  const { t: tCommon } = useTranslation('common');
  const isEdit = Boolean(unit);
  const createUnit = useCreateUnit();
  const updateUnit = useUpdateUnit();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: toFormValues(unit),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(unit));
    }
  }, [open, unit, form]);

  const isPending = createUnit.isPending || updateUnit.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const handleSubmit = (values: UnitFormValues) => {
    setServerError(null);
    const payload = toPayload(values);
    const handlers = {
      onSuccess: () => handleOpenChange(false),
      onError: (error: unknown) => setServerError(extractMessage(error, t($ => $.drawer.errorFallback))),
    };

    if (isEdit && unit) {
      updateUnit.mutate({ id: unit.id, payload }, handlers);
    } else {
      createUnit.mutate(payload, handlers);
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
        <UnitFormFields />
      </EntityForm>
    </EntityDrawer>
  );
}
