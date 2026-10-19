import { useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileText, Loader2, Upload, X } from 'lucide-react';

import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import { FormField } from '@/components/crud';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ManualOrderFormValues } from '@/features/orders/components/order-form-schema';
import { getMediaUrl } from '@/lib/media';

const PAYMENT_METHOD_VALUES = ['cod', 'instapay', 'mobile_wallet', 'bank_transfer', 'credit_card'] as const;

const ACCEPTED = 'image/jpeg,image/jpg,image/png,image/webp,image/gif,application/pdf';
const MAX_MB = 10;

type OrderPaymentSectionProps = {
  paymentProofPolicy?: Record<string, 'none' | 'required' | 'optional'>;
  paymentMethods?: ReadonlyArray<{ value: string; label: string }>;
};

export function OrderPaymentSection({ paymentProofPolicy, paymentMethods }: OrderPaymentSectionProps = {}) {
  const { t } = useTranslation('orders');
  const defaultMethods = PAYMENT_METHOD_VALUES.map((v) => ({
    value: v,
    label: t($ => $.workspace.paymentMethodLabels[v], { defaultValue: v }),
  }));
  const methods = paymentMethods && paymentMethods.length > 0 ? paymentMethods : defaultMethods;
  const { control, watch, setValue, formState: { errors } } = useFormContext<ManualOrderFormValues>();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const paymentMethod = watch('payment_method_manual');
  const proofPath = watch('payment_proof_path');

  // When a policy is provided, unknown methods default to 'none' (not required).
  // The 'required' fallback only applies when no policy is loaded at all (legacy/edit mode).
  const proofRequirement = paymentMethod
    ? (paymentProofPolicy
        ? (paymentProofPolicy[paymentMethod] ?? 'none')
        : (paymentMethod !== 'cod' ? 'required' : 'none'))
    : 'none';
  const requiresProof = proofRequirement === 'required' || proofRequirement === 'optional';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_MB * 1024 * 1024) {
      setUploadError(t($ => $.workspace.paymentSection.fileTooLarge, { max: MAX_MB }));
      return;
    }

    setUploadError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('context', 'order-proof');

    try {
      const { data } = await api.post<ApiResponse<{ path: string; url: string }>>(
        '/media/upload',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setValue('payment_proof_path', data.data.path, { shouldValidate: true });
    } catch {
      setUploadError(t($ => $.workspace.paymentSection.uploadFailed));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleClear = () => {
    setValue('payment_proof_path', undefined);
    setUploadError(null);
  };

  const proofUrl = proofPath ? getMediaUrl(proofPath) : null;
  const isPdf = proofPath?.toLowerCase().endsWith('.pdf');

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormField name="payment_method_manual" label={t($ => $.workspace.paymentSection.methodLabel)}>
          <Controller
            control={control}
            name="payment_method_manual"
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={(v) => field.onChange(v || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t($ => $.workspace.paymentSection.selectMethod)} />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>

      {requiresProof && (
        <div className="sm:col-span-2">
          <FormField name="payment_proof_path" label={(proofRequirement === 'optional'
                ? t($ => $.workspace.paymentSection.proofOptional)
                : t($ => $.workspace.paymentSection.proofLabel))} required={proofRequirement === 'required'}>
            {proofPath ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 bg-muted/40">
                {isPdf ? (
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                ) : (
                  proofUrl && (
                    <img src={proofUrl} alt="proof" className="size-8 rounded object-cover shrink-0" />
                  )
                )}
                <span className="flex-1 truncate text-sm text-muted-foreground">{proofPath.split('/').pop()}</span>
                {proofUrl && (
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <ExternalLink className="size-4 text-muted-foreground hover:text-foreground" />
                  </a>
                )}
                <Button type="button" variant="ghost" size="icon" className="size-6 shrink-0" onClick={handleClear}>
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-6 text-center hover:bg-muted/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="size-5 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground">
                  {uploading ? t($ => $.workspace.paymentSection.uploading) : t($ => $.workspace.paymentSection.uploadCta)}
                </p>
                <p className="text-xs text-muted-foreground">{t($ => $.workspace.paymentSection.uploadMax, { max: MAX_MB })}</p>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              onChange={handleFileChange}
              disabled={uploading}
            />
            {uploadError && <p className="mt-1 text-xs text-destructive">{uploadError}</p>}
            {errors.payment_proof_path && (
              <p className="mt-1 text-xs text-destructive">{errors.payment_proof_path.message}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {proofRequirement === 'required'
                ? t($ => $.workspace.paymentSection.proofRequired)
                : proofRequirement === 'optional'
                ? t($ => $.workspace.paymentSection.proofOptionalNote)
                : t($ => $.workspace.paymentSection.proofNotRequired)}
            </p>
          </FormField>
        </div>
      )}
    </div>
  );
}
