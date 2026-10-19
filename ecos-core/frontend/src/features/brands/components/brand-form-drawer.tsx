import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { type Resolver, useForm } from 'react-hook-form';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateBrand, useUpdateBrand, useTransferBrand, useAnalyzeTransferBrand } from '@/features/brands/hooks/use-brands';
import type { Brand, BrandTransferResult, TransferImpactReport } from '@/features/brands/types/brand';
import { uploadOrgImage } from '@/lib/media-upload';
import { BrandFormFields } from './brand-form';
import {
  brandCreateSchema,
  brandUpdateSchema,
  toCreateFormValues,
  toUpdateFormValues,
  toCreatePayload,
  toUpdatePayload,
  type BrandCreateFormValues,
  type BrandUpdateFormValues,
} from './brand-form-schema';

const FORM_ID = 'brand-form';

type BrandFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: Brand | null;
};

type TransferDialogState = {
  targetCompanyId: string;
  pendingValues: BrandUpdateFormValues;
  pendingLogoPath: string | undefined;
};

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

function ImpactCountRow({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant="secondary" className="tabular-nums">{value.toLocaleString()}</Badge>
    </div>
  );
}

function TransferImpactPanel({
  report,
  isAnalyzing,
  analyzeError,
}: {
  report: TransferImpactReport | null;
  isAnalyzing: boolean;
  analyzeError: string | null;
}) {
  if (isAnalyzing) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin shrink-0" />
        Analyzing impact…
      </div>
    );
  }

  if (analyzeError) {
    return (
      <Alert variant="destructive">
        <XCircle className="size-4" />
        <AlertTitle>Analysis failed</AlertTitle>
        <AlertDescription>{analyzeError}</AlertDescription>
      </Alert>
    );
  }

  if (!report) return null;

  const { counts, warnings, blockers } = report;

  const hasWarnings =
    warnings.slug_conflict ||
    warnings.locked_snapshots > 0;

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-4 text-sm">
      {/* Blocker */}
      {blockers.code_conflict && (
        <Alert variant="destructive" className="py-2">
          <ShieldAlert className="size-4" />
          <AlertTitle className="text-sm">Transfer blocked — code conflict</AlertTitle>
          <AlertDescription className="text-xs">
            Brand code <strong>{report.brand_code}</strong> already exists in the target company.
            Codes are permanent identifiers and cannot be auto-renamed. Rename this brand's code first.
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {hasWarnings && !blockers.code_conflict && (
        <Alert className="border-amber-200 bg-amber-50 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="size-4" />
          <AlertTitle className="text-sm">Warnings</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            {warnings.slug_conflict && (
              <div>Slug conflict — will be renamed to <strong>{warnings.resolved_slug}</strong></div>
            )}
            {warnings.locked_snapshots > 0 && (
              <div>{warnings.locked_snapshots} locked financial snapshot(s) will be re-stamped</div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Entity counts */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Records affected
        </p>
        <ImpactCountRow label="Sales channels" value={counts.channels} />
        <ImpactCountRow label="Orders" value={counts.orders} />
        <ImpactCountRow label="Products" value={counts.products} />
        <ImpactCountRow label="Business accounts" value={counts.business_accounts} />
        <ImpactCountRow label="Marketing campaigns" value={counts.marketing_campaigns} />
        <ImpactCountRow label="Automation workflows" value={counts.automation_workflows} />
        <ImpactCountRow label="AI contexts" value={counts.ai_contexts} />
        <ImpactCountRow label="CEP conversations" value={counts.cep_conversations} />
        <ImpactCountRow label="Config policies" value={counts.policies} />
      </div>

      {counts.total_records > 0 && (
        <div className="flex items-center justify-between border-t pt-2 font-medium">
          <span>Total records</span>
          <span className="tabular-nums">{counts.total_records.toLocaleString()}</span>
        </div>
      )}

      {counts.total_records === 0 && !blockers.code_conflict && (
        <p className="text-xs text-muted-foreground italic">No records will be affected.</p>
      )}
    </div>
  );
}

export function BrandFormDrawer({ open, onOpenChange, brand }: BrandFormDrawerProps) {
  const isEdit = Boolean(brand);
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const transferBrand = useTransferBrand();
  const analyzeTransfer = useAnalyzeTransferBrand();
  const [serverError, setServerError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [transferDialog, setTransferDialog] = useState<TransferDialogState | null>(null);
  const [transferResult, setTransferResult] = useState<BrandTransferResult['transfer'] | null>(null);
  const [impactReport, setImpactReport] = useState<TransferImpactReport | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const createForm = useForm<BrandCreateFormValues>({
    resolver: zodResolver(brandCreateSchema) as unknown as Resolver<BrandCreateFormValues>,
    defaultValues: toCreateFormValues(),
  });

  const updateForm = useForm<BrandUpdateFormValues>({
    resolver: zodResolver(brandUpdateSchema) as unknown as Resolver<BrandUpdateFormValues>,
    defaultValues: brand ? toUpdateFormValues(brand) : { name: '', is_active: true },
  });

  const isPending = createBrand.isPending || updateBrand.isPending || transferBrand.isPending;

  // `reset` and `mutate` are stable references (react-hook-form / TanStack Query),
  // so the effects below depend on those rather than on the whole form and
  // mutation objects, whose identity changes on every render.
  const { reset: resetCreate } = createForm;
  const { reset: resetUpdate } = updateForm;
  const { mutate: analyzeTransferMutate } = analyzeTransfer;
  const brandId = brand?.id;

  useEffect(() => {
    if (open) {
      setImageFile(null);
      setServerError(null);
      setTransferResult(null);
      if (isEdit && brand) {
        resetUpdate(toUpdateFormValues(brand));
      } else {
        resetCreate(toCreateFormValues());
      }
    }
  }, [open, brand, isEdit, resetCreate, resetUpdate]);

  // Auto-trigger analysis when the transfer dialog opens
  useEffect(() => {
    if (!transferDialog || !brandId) return;
    setImpactReport(null);
    setAnalyzeError(null);
    analyzeTransferMutate(
      { id: brandId, payload: { target_company_id: transferDialog.targetCompanyId } },
      {
        onSuccess: (report) => setImpactReport(report),
        onError: (error) => setAnalyzeError(extractMessage(error)),
      },
    );
    // `analyzeTransfer` is a mutation object whose identity changes each render,
    // so the effect keys off the brand id and the dialog that opened it.
  }, [transferDialog, brandId, analyzeTransferMutate]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setServerError(null);
      setTransferDialog(null);
      setImpactReport(null);
      setAnalyzeError(null);
    }
    onOpenChange(next);
  };

  const handlers = {
    onSuccess: () => handleOpenChange(false),
    onError: (error: unknown) => setServerError(extractMessage(error)),
  };

  const handleTransferConfirm = () => {
    if (!transferDialog || !brand) return;
    setServerError(null);

    transferBrand.mutate(
      { id: brand.id, payload: { target_company_id: transferDialog.targetCompanyId } },
      {
        onSuccess: (result) => {
          setTransferDialog(null);
          setImpactReport(null);
          // If there are other field changes, apply them now against the new brand state
          const payload = toUpdatePayload(transferDialog.pendingValues);
          payload.logo = transferDialog.pendingLogoPath;
          updateBrand.mutate(
            { id: brand.id, payload },
            {
              onSuccess: () => {
                setTransferResult(result.transfer);
                setTimeout(() => handleOpenChange(false), 2000);
              },
              onError: (error) => setServerError(extractMessage(error)),
            },
          );
        },
        onError: (error) => {
          setTransferDialog(null);
          setImpactReport(null);
          setServerError(extractMessage(error));
        },
      },
    );
  };

  const header = serverError ? (
    <Alert variant="destructive" className="mb-4">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{serverError}</AlertDescription>
    </Alert>
  ) : transferResult ? (
    <Alert className="mb-4 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
      <AlertTitle>Transfer complete</AlertTitle>
      <AlertDescription>
        Brand moved to new company.
        {transferResult.slug_changed && ` Slug updated to "${transferResult.slug}".`}
        {' '}
        {Object.values(transferResult.cascade).reduce((a, b) => a + b, 0)} records re-stamped across {Object.values(transferResult.cascade).filter(v => v > 0).length} tables.
      </AlertDescription>
    </Alert>
  ) : null;

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
        Cancel
      </Button>
      <Button type="submit" form={FORM_ID} disabled={isPending}>
        {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Brand'}
      </Button>
    </>
  );

  const canExecuteTransfer =
    !analyzeTransfer.isPending &&
    impactReport !== null &&
    !impactReport.has_blockers;

  return (
    <>
      <EntityDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title={isEdit ? 'Edit Brand' : 'New Brand'}
        description={isEdit ? 'Update brand details.' : 'Create a new brand for your organization.'}
        footer={footer}
      >
        {header}
        {isEdit ? (
          <EntityForm
            form={updateForm}
            id={FORM_ID}
            onSubmit={async (values) => {
              setServerError(null);
              let logoPath: string | undefined = brand?.logo ?? undefined;
              if (imageFile) {
                try {
                  const uploaded = await uploadOrgImage(imageFile, 'brands');
                  logoPath = uploaded.path;
                } catch {
                  setServerError('Failed to upload image. Please try again.');
                  return;
                }
              }

              // Detect company change → show transfer confirmation before proceeding
              if (brand && values.company_id && values.company_id !== brand.company_id) {
                setTransferDialog({
                  targetCompanyId: values.company_id,
                  pendingValues: values,
                  pendingLogoPath: logoPath,
                });
                return;
              }

              const payload = toUpdatePayload(values);
              payload.logo = logoPath;
              if (brand) updateBrand.mutate({ id: brand.id, payload }, handlers);
            }}
          >
            <BrandFormFields
              mode="edit"
              existingLogoUrl={brand?.logo ?? null}
              onImageChange={setImageFile}
            />
          </EntityForm>
        ) : (
          <EntityForm
            form={createForm}
            id={FORM_ID}
            onSubmit={async (values) => {
              setServerError(null);
              let logoPath: string | undefined;
              if (imageFile) {
                try {
                  const uploaded = await uploadOrgImage(imageFile, 'brands');
                  logoPath = uploaded.path;
                } catch {
                  setServerError('Failed to upload image. Please try again.');
                  return;
                }
              }
              const payload = toCreatePayload(values);
              payload.logo = logoPath;
              createBrand.mutate(payload, handlers);
            }}
          >
            <BrandFormFields
              mode="create"
              existingLogoUrl={null}
              onImageChange={setImageFile}
            />
          </EntityForm>
        )}
      </EntityDrawer>

      <Dialog open={!!transferDialog} onOpenChange={(v) => { if (!v) { setTransferDialog(null); setImpactReport(null); setAnalyzeError(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Brand Ownership?</DialogTitle>
            <DialogDescription>
              Moving <strong>{brand?.name}</strong> to a different company will re-stamp all linked records
              in a single atomic transaction. Review the impact below before confirming.
            </DialogDescription>
          </DialogHeader>

          <TransferImpactPanel
            report={impactReport}
            isAnalyzing={analyzeTransfer.isPending}
            analyzeError={analyzeError}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setTransferDialog(null); setImpactReport(null); setAnalyzeError(null); }}
              disabled={transferBrand.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleTransferConfirm}
              disabled={!canExecuteTransfer || transferBrand.isPending}
            >
              {transferBrand.isPending ? 'Transferring…' : 'Execute Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
