import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CompanyFormFields } from '@/features/companies/components/company-form';
import {
  companySchema,
  toFormValues,
  toPayload,
  type CompanyFormValues,
} from '@/features/companies/components/company-form-schema';
import { useCreateCompany, useUpdateCompany } from '@/features/companies/hooks/use-companies';
import type { Company } from '@/features/companies/types/company';
import { uploadOrgImage } from '@/lib/media-upload';

const FORM_ID = 'company-form';

type CompanyFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
};

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

export function CompanyFormDrawer({ open, onOpenChange, company }: CompanyFormDrawerProps) {
  const isEdit = Boolean(company);
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const [serverError, setServerError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: toFormValues(company),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(company));
      setServerError(null);
      setImageFile(null);
    }
  }, [open, company, form]);

  const isPending = createCompany.isPending || updateCompany.isPending;

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const handleSubmit = async (values: CompanyFormValues) => {
    setServerError(null);

    let logoPath: string | undefined = isEdit ? (company?.logo ?? undefined) : undefined;
    if (imageFile) {
      try {
        const uploaded = await uploadOrgImage(imageFile, 'companies');
        logoPath = uploaded.path;
      } catch {
        setServerError('Failed to upload image. Please try again.');
        return;
      }
    }

    const payload = toPayload(values);
    payload.logo = logoPath;

    const handlers = {
      onSuccess: () => handleOpenChange(false),
      onError: (error: unknown) => setServerError(extractMessage(error)),
    };

    if (isEdit && company) {
      updateCompany.mutate({ id: company.id, payload }, handlers);
    } else {
      createCompany.mutate(payload, handlers);
    }
  };

  return (
    <EntityDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isEdit ? 'Edit Company' : 'New Company'}
      description={
        isEdit
          ? 'Update company details.'
          : 'Create a new company. Code is auto-generated if left blank.'
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isPending}>
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Company'}
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

      <EntityForm form={form} id={FORM_ID} onSubmit={handleSubmit}>
        <CompanyFormFields
          existingLogoUrl={isEdit ? company?.logo : null}
          onImageChange={setImageFile}
        />
      </EntityForm>
    </EntityDrawer>
  );
}
