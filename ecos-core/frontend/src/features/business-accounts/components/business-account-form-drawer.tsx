import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { uploadOrgImage } from '@/lib/media-upload';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  useCreateBusinessAccount,
  useUpdateBusinessAccount,
} from '@/features/business-accounts/hooks/use-business-accounts';
import type { BusinessAccount } from '@/features/business-accounts/types/business-account';
import { BusinessAccountFormFields } from './business-account-form';
import {
  businessAccountCreateSchema,
  businessAccountUpdateSchema,
  toCreateFormValues,
  toUpdateFormValues,
  toCreatePayload,
  toUpdatePayload,
  type BusinessAccountCreateFormValues,
  type BusinessAccountUpdateFormValues,
} from './business-account-form-schema';

const FORM_ID = 'business-account-form';

type BusinessAccountFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: BusinessAccount | null;
};

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

export function BusinessAccountFormDrawer({ open, onOpenChange, account }: BusinessAccountFormDrawerProps) {
  const isEdit = Boolean(account);
  const createAccount = useCreateBusinessAccount();
  const updateAccount = useUpdateBusinessAccount();
  const [serverError, setServerError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const createForm = useForm<BusinessAccountCreateFormValues>({
    resolver: zodResolver(businessAccountCreateSchema),
    defaultValues: toCreateFormValues(),
  });

  const updateForm = useForm<BusinessAccountUpdateFormValues>({
    resolver: zodResolver(businessAccountUpdateSchema),
    defaultValues: account ? toUpdateFormValues(account) : { name: '', provider: 'Custom', status: 'active' },
  });

  const isPending = createAccount.isPending || updateAccount.isPending;

  // `reset` is a stable reference in react-hook-form, so the effect depends on
  // the two reset functions rather than on the whole form objects — whose
  // identity changes each render and would re-reset the form continuously.
  const { reset: resetCreate } = createForm;
  const { reset: resetUpdate } = updateForm;

  useEffect(() => {
    if (open) {
      setImageFile(null);
      setServerError(null);
      if (isEdit && account) {
        resetUpdate(toUpdateFormValues(account));
      } else {
        resetCreate(toCreateFormValues());
      }
    }
  }, [open, account, isEdit, resetCreate, resetUpdate]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  async function resolveLogoPath(existingLogo?: string | null): Promise<string | null> {
    if (!imageFile) return existingLogo ?? null;
    try {
      const uploaded = await uploadOrgImage(imageFile, 'business-accounts');
      return uploaded.path;
    } catch {
      setServerError('Failed to upload image. Please try again.');
      return null;
    }
  }

  const handlers = {
    onSuccess: () => handleOpenChange(false),
    onError: (error: unknown) => setServerError(extractMessage(error)),
  };

  return (
    <EntityDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isEdit ? 'Edit Business Account' : 'New Business Account'}
      description={
        isEdit
          ? 'Update business account details.'
          : 'Create a new business account for your organization.'
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isPending}>
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Business Account'}
          </Button>
        </>
      }
    >
      {serverError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      {isEdit ? (
        <EntityForm
          form={updateForm}
          id={FORM_ID}
          onSubmit={async (values) => {
            setServerError(null);
            const logoPath = await resolveLogoPath(account?.logo);
            if (serverError) return;
            if (account) {
              const payload = toUpdatePayload(values);
              payload.logo = logoPath;
              updateAccount.mutate({ id: account.id, payload }, handlers);
            }
          }}
        >
          <BusinessAccountFormFields
            mode="edit"
            companyId={account?.company_id ?? null}
            existingLogoUrl={account?.logo ?? null}
            onImageChange={setImageFile}
          />
        </EntityForm>
      ) : (
        <EntityForm
          form={createForm}
          id={FORM_ID}
          onSubmit={async (values) => {
            setServerError(null);
            const logoPath = await resolveLogoPath();
            if (serverError) return;
            const payload = toCreatePayload(values);
            payload.logo = logoPath;
            createAccount.mutate(payload, handlers);
          }}
        >
          <BusinessAccountFormFields
            mode="create"
            existingLogoUrl={null}
            onImageChange={setImageFile}
          />
        </EntityForm>
      )}
    </EntityDrawer>
  );
}
