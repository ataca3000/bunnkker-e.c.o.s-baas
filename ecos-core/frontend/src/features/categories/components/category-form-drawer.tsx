import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CategoryFormFields } from '@/features/categories/components/category-form';
import {
  categorySchema,
  toFormValues,
  toPayload,
  type CategoryFormValues,
} from '@/features/categories/components/category-form-schema';
import { useCreateCategory, useUpdateCategory } from '@/features/categories/hooks/use-categories';
import type { Category, CategoryScope } from '@/features/categories/types/category';

const FORM_ID = 'category-form';

type CategoryFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category | null;
  defaultScope?: CategoryScope;
};

function extractMessage(error: unknown, fallback: string): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : fallback;
}

export function CategoryFormDrawer({ open, onOpenChange, category, defaultScope }: CategoryFormDrawerProps) {
  const { t } = useTranslation('categories');
  const { t: tCommon } = useTranslation('common');
  const isEdit = Boolean(category);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: toFormValues(category, defaultScope),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(category, defaultScope));
    }
  }, [open, category, defaultScope, form]);

  const isPending = createCategory.isPending || updateCategory.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const handleSubmit = (values: CategoryFormValues) => {
    setServerError(null);
    const payload = toPayload(values);
    const handlers = {
      onSuccess: () => handleOpenChange(false),
      onError: (error: unknown) => setServerError(extractMessage(error, t($ => $.drawer.errorFallback))),
    };

    if (isEdit && category) {
      updateCategory.mutate({ id: category.id, payload }, handlers);
    } else {
      createCategory.mutate(payload, handlers);
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
        <CategoryFormFields currentId={category?.id} />
      </EntityForm>
    </EntityDrawer>
  );
}
