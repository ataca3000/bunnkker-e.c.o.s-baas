import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ProductMappingFormFields } from '@/features/product-mappings/components/product-mapping-form';
import {
  productMappingSchema,
  toFormValues,
  toPayload,
  type ProductMappingFormValues,
} from '@/features/product-mappings/components/product-mapping-form-schema';
import {
  useCreateProductMapping,
  useUpdateProductMapping,
} from '@/features/product-mappings/hooks/use-product-mappings';
import type { ProductMapping } from '@/features/product-mappings/types/product-mapping';

const FORM_ID = 'product-mapping-form';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapping?: ProductMapping | null;
};

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

export function ProductMappingFormDrawer({ open, onOpenChange, mapping }: Props) {
  const { t } = useTranslation('product-mappings');
  const { t: tCommon } = useTranslation('common');
  const isEdit = Boolean(mapping);
  const createMapping = useCreateProductMapping();
  const updateMapping = useUpdateProductMapping();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ProductMappingFormValues>({
    resolver: zodResolver(productMappingSchema),
    defaultValues: toFormValues(mapping),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(mapping));
    }
  }, [open, mapping, form]);

  const isPending = createMapping.isPending || updateMapping.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const handleSubmit = (values: ProductMappingFormValues) => {
    setServerError(null);
    const payload = toPayload(values);
    const handlers = {
      onSuccess: () => handleOpenChange(false),
      onError: (error: unknown) => setServerError(extractMessage(error)),
    };

    if (isEdit && mapping) {
      updateMapping.mutate({ id: mapping.id, payload }, handlers);
    } else {
      createMapping.mutate(payload, handlers);
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
        <ProductMappingFormFields />
      </EntityForm>
    </EntityDrawer>
  );
}
