import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BranchFormFields } from '@/features/branches/components/branch-form';
import {
  branchSchema,
  toFormValues,
  toPayload,
  type BranchFormValues,
} from '@/features/branches/components/branch-form-schema';
import { useCreateBranch, useUpdateBranch } from '@/features/branches/hooks/use-branches';
import type { Branch } from '@/features/branches/types/branch';

const FORM_ID = 'branch-form';

type BranchFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: Branch | null;
  defaultCompanyId?: string;
};

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

export function BranchFormDrawer({ open, onOpenChange, branch, defaultCompanyId }: BranchFormDrawerProps) {
  const { t } = useTranslation('branches');
  const { t: tCommon } = useTranslation('common');
  const isEdit = Boolean(branch);
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: toFormValues(branch, defaultCompanyId),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(branch, defaultCompanyId));
    }
  }, [open, branch, defaultCompanyId, form]);

  const isPending = createBranch.isPending || updateBranch.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const handleSubmit = (values: BranchFormValues) => {
    setServerError(null);
    const payload = toPayload(values);
    const handlers = {
      onSuccess: () => handleOpenChange(false),
      onError: (error: unknown) => setServerError(extractMessage(error)),
    };

    if (isEdit && branch) {
      updateBranch.mutate({ id: branch.id, payload }, handlers);
    } else {
      createBranch.mutate(payload, handlers);
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
        <BranchFormFields showCompanyField={!defaultCompanyId} />
      </EntityForm>
    </EntityDrawer>
  );
}
