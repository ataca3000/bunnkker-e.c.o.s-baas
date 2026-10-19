import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of
 * key strings can never type-check. The selector is the same expression
 * the compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CheckCircle,
  Clock,
  Download,
  FileText,
  History,
  Loader2,
  Paperclip,
  Trash2,
  Truck,
  Upload,
  XCircle,
} from 'lucide-react';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ecos-select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ds/use-toast';

import { useShippingCompanies } from '@/features/logistics/shipping-companies/hooks/use-shipping-companies';
import {
  useAssignVehicle,
  useCreateDriver,
  useDeleteDriverDocument,
  useDriver,
  useNextDriverCode,
  useReleaseVehicle,
  useSetDriverStatus,
  useUpdateDriver,
  useUploadDriverDocument,
  useVehicles,
} from '../hooks/use-drivers';
import { driverService } from '../services/driver-service';
import type {
  Driver,
  DriverDocument,
  DriverDocumentType,
  DriverPayload,
} from '../types/driver';
import { LicenseStatusBadge } from './license-status-badge';

// ── Helpers ────────────────────────────────────────────────────────────────────

function apiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const res = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;
    const firstFieldError = res?.data?.errors ? Object.values(res.data.errors)[0]?.[0] : undefined;
    return firstFieldError ?? res?.data?.message ?? fallback;
  }
  return fallback;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const DOCUMENT_TYPES: { value: DriverDocumentType; labelKey: LogisticsLabel }[] = [
  { value: 'license', labelKey: ($) => $.drivers.documents.types.license },
  { value: 'national_id', labelKey: ($) => $.drivers.documents.types.nationalId },
  { value: 'employment_contract', labelKey: ($) => $.drivers.documents.types.employmentContract },
  { value: 'medical_certificate', labelKey: ($) => $.drivers.documents.types.medicalCertificate },
  { value: 'other', labelKey: ($) => $.drivers.documents.types.other },
];

const DOCUMENT_TYPE_LABEL_KEY = Object.fromEntries(
  DOCUMENT_TYPES.map((d) => [d.value, d.labelKey]),
) as Record<DriverDocumentType, LogisticsLabel>;

// ── Form state ─────────────────────────────────────────────────────────────────

type DriverFormState = {
  driver_code: string;
  full_name: string;
  mobile: string;
  national_id: string;
  date_of_birth: string;
  address: string;
  employment_date: string;
  shipping_company_id: string;
  license_number: string;
  license_type: string;
  license_issue_date: string;
  license_expiry_date: string;
  license_issuing_authority: string;
  notes: string;
};

const EMPTY_FORM: DriverFormState = {
  driver_code: '',
  full_name: '',
  mobile: '',
  national_id: '',
  date_of_birth: '',
  address: '',
  employment_date: '',
  shipping_company_id: '',
  license_number: '',
  license_type: '',
  license_issue_date: '',
  license_expiry_date: '',
  license_issuing_authority: '',
  notes: '',
};

function toPayload(form: DriverFormState): DriverPayload {
  const blankToNull = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    driver_code: form.driver_code.trim(),
    full_name: form.full_name.trim(),
    mobile: form.mobile.trim(),
    national_id: form.national_id.trim(),
    date_of_birth: blankToNull(form.date_of_birth),
    address: blankToNull(form.address),
    employment_date: blankToNull(form.employment_date),
    shipping_company_id: form.shipping_company_id ? Number(form.shipping_company_id) : null,
    license_number: blankToNull(form.license_number),
    license_type: blankToNull(form.license_type),
    license_issue_date: blankToNull(form.license_issue_date),
    license_expiry_date: blankToNull(form.license_expiry_date),
    license_issuing_authority: blankToNull(form.license_issuing_authority),
    notes: blankToNull(form.notes),
  };
}

// ── Details tab ────────────────────────────────────────────────────────────────

function DetailsFields({
  form,
  setForm,
  disabled,
}: {
  form: DriverFormState;
  setForm: (fn: (prev: DriverFormState) => DriverFormState) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('logistics');
  const { data: carriers } = useShippingCompanies({ status: 'active', per_page: 100 });
  const set = (k: keyof DriverFormState) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dv-code">{t($ => $.drivers.fields.driverCode)} *</Label>
          <Input
            id="dv-code"
            value={form.driver_code}
            disabled={disabled}
            className="font-mono"
            placeholder="DRV-001"
            onChange={(e) => set('driver_code')(e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dv-name">{t($ => $.drivers.fields.fullName)} *</Label>
          <Input
            id="dv-name"
            value={form.full_name}
            disabled={disabled}
            onChange={(e) => set('full_name')(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dv-mobile">{t($ => $.drivers.fields.mobileNumber)} *</Label>
          <Input
            id="dv-mobile"
            value={form.mobile}
            disabled={disabled}
            placeholder="01xxxxxxxxx"
            onChange={(e) => set('mobile')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dv-nid">{t($ => $.drivers.fields.nationalId)} *</Label>
          <Input
            id="dv-nid"
            value={form.national_id}
            disabled={disabled}
            className="font-mono"
            onChange={(e) => set('national_id')(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dv-dob">{t($ => $.drivers.fields.dateOfBirth)}</Label>
          <Input
            id="dv-dob"
            type="date"
            value={form.date_of_birth}
            disabled={disabled}
            onChange={(e) => set('date_of_birth')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dv-emp">{t($ => $.drivers.fields.employmentDate)}</Label>
          <Input
            id="dv-emp"
            type="date"
            value={form.employment_date}
            disabled={disabled}
            onChange={(e) => set('employment_date')(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t($ => $.drivers.fields.shippingCompany)}</Label>
        <Select
          value={form.shipping_company_id}
          onValueChange={(v) => set('shipping_company_id')(v)}
        >
          <SelectTrigger disabled={disabled}>
            <SelectValue placeholder={t($ => $.drivers.fields.shippingCompanyPlaceholder)} />
          </SelectTrigger>
          <SelectContent>
            {(carriers?.data ?? []).map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name} ({c.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dv-address">{t($ => $.common.address)}</Label>
        <Input
          id="dv-address"
          value={form.address}
          disabled={disabled}
          onChange={(e) => set('address')(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dv-notes">{t($ => $.common.notes)}</Label>
        <Textarea
          id="dv-notes"
          rows={3}
          value={form.notes}
          disabled={disabled}
          onChange={(e) => set('notes')(e.target.value)}
        />
      </div>
    </div>
  );
}

// ── Licence tab ────────────────────────────────────────────────────────────────

function LicenseFields({
  form,
  setForm,
  driver,
  disabled,
}: {
  form: DriverFormState;
  setForm: (fn: (prev: DriverFormState) => DriverFormState) => void;
  driver: Driver | null;
  disabled?: boolean;
}) {
  const { t } = useTranslation('logistics');
  const set = (k: keyof DriverFormState) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const status = driver?.license_status;

  return (
    <div className="space-y-4">
      {driver && status && status !== 'valid' && (
        <Alert
          className={
            status === 'expired'
              ? 'border-destructive/40 bg-destructive/5'
              : status === 'expiring_soon'
                ? 'border-amber-500/40 bg-amber-500/5'
                : undefined
          }
        >
          <AlertTriangle className="size-4" />
          <AlertDescription className="text-sm">
            {status === 'expired' &&
              t($ => $.drivers.license.alert.expired, { date: formatDate(driver.license_expiry_date) })}
            {status === 'expiring_soon' &&
              (driver.license_days_remaining == null
                ? t($ => $.drivers.license.alert.expiringSoon, {
                    date: formatDate(driver.license_expiry_date),
                  })
                : driver.license_days_remaining === 0
                  ? t($ => $.drivers.license.alert.expiringToday, {
                      date: formatDate(driver.license_expiry_date),
                    })
                  : t($ => $.drivers.license.alert.expiringInDays, {
                      date: formatDate(driver.license_expiry_date),
                      count: driver.license_days_remaining,
                    }))}
            {status === 'missing' && t($ => $.drivers.license.alert.missing)}
          </AlertDescription>
        </Alert>
      )}

      {driver && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t($ => $.drivers.license.currentStatus)}</span>
          <LicenseStatusBadge
            status={driver.license_status}
            daysRemaining={driver.license_days_remaining}
            showCountdown
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lic-no">{t($ => $.drivers.license.number)}</Label>
          <Input
            id="lic-no"
            value={form.license_number}
            disabled={disabled}
            className="font-mono"
            onChange={(e) => set('license_number')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lic-type">{t($ => $.drivers.license.type)}</Label>
          <Input
            id="lic-type"
            value={form.license_type}
            disabled={disabled}
            placeholder={t($ => $.drivers.license.typePlaceholder)}
            onChange={(e) => set('license_type')(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lic-issue">{t($ => $.drivers.license.issueDate)}</Label>
          <Input
            id="lic-issue"
            type="date"
            value={form.license_issue_date}
            disabled={disabled}
            onChange={(e) => set('license_issue_date')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lic-exp">{t($ => $.drivers.license.expiryDate)}</Label>
          <Input
            id="lic-exp"
            type="date"
            value={form.license_expiry_date}
            min={form.license_issue_date || undefined}
            disabled={disabled}
            onChange={(e) => set('license_expiry_date')(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="lic-auth">{t($ => $.drivers.license.issuingAuthority)}</Label>
        <Input
          id="lic-auth"
          value={form.license_issuing_authority}
          disabled={disabled}
          placeholder={t($ => $.drivers.license.issuingAuthorityPlaceholder)}
          onChange={(e) => set('license_issuing_authority')(e.target.value)}
        />
      </div>
    </div>
  );
}

// ── Documents tab ──────────────────────────────────────────────────────────────

function DocumentsTab({ driver }: { driver: Driver }) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const upload = useUploadDriverDocument();
  const remove = useDeleteDriverDocument();
  const fileRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<DriverDocumentType>('license');
  const [title, setTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DriverDocument | null>(null);

  const documents = driver.documents ?? [];
  const isArchived = driver.status === 'archived';

  async function handleUpload() {
    if (!file) {
      toast({ title: t($ => $.drivers.toast.chooseFile), variant: 'destructive' });
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    if (title.trim()) form.append('title', title.trim());
    if (expiresAt) form.append('expires_at', expiresAt);

    try {
      await upload.mutateAsync({ driverId: driver.id, form });
      toast({ title: t($ => $.drivers.toast.documentUploaded) });
      setFile(null);
      setTitle('');
      setExpiresAt('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.drivers.toast.uploadFailed)), variant: 'destructive' });
    }
  }

  async function handleDownload(doc: DriverDocument) {
    try {
      await driverService.downloadDocument(driver.id, doc);
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.drivers.toast.downloadFailed)), variant: 'destructive' });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync({ driverId: driver.id, documentId: deleteTarget.id });
      toast({ title: t($ => $.drivers.toast.documentDeleted) });
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.drivers.toast.deleteFailed)), variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      {isArchived ? (
        <Alert>
          <AlertDescription className="text-sm">
            {t($ => $.drivers.documents.archivedNotice)}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-semibold">{t($ => $.drivers.documents.uploadHeading)}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t($ => $.common.type)} *</Label>
              <Select value={type} onValueChange={(v) => setType(v as DriverDocumentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{t(d.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-exp">{t($ => $.drivers.documents.expiresOn)}</Label>
              <Input
                id="doc-exp"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">{t($ => $.drivers.documents.title)}</Label>
            <Input
              id="doc-title"
              value={title}
              placeholder={t($ => $.drivers.documents.titlePlaceholder)}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-file">{t($ => $.drivers.documents.file)} * <span className="font-normal text-muted-foreground">{t($ => $.drivers.documents.fileHint)}</span></Label>
            <Input
              id="doc-file"
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={handleUpload} disabled={upload.isPending || !file}>
              {upload.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {t($ => $.drivers.documents.upload)}
            </Button>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-center">
          <Paperclip className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">{t($ => $.drivers.documents.empty.title)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t($ => $.drivers.documents.empty.hint)}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{doc.title || doc.file_name}</p>
                    <Badge variant="outline" className="text-xs">{t(DOCUMENT_TYPE_LABEL_KEY[doc.type])}</Badge>
                    {doc.is_expired && (
                      <Badge variant="destructive" className="text-xs">{t($ => $.drivers.license.status.expired)}</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {doc.file_name} · {formatBytes(doc.size_bytes)}
                    {doc.expires_at
                      ? ` · ${t($ => $.drivers.documents.expiresMeta, { date: formatDate(doc.expires_at) })}`
                      : ''}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDownload(doc)}>
                  <Download className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(doc)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t($ => $.drivers.documents.deleteDialog.title)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t($ => $.drivers.documents.deleteDialog.body, {
                name: deleteTarget?.title || deleteTarget?.file_name || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t($ => $.common.cancel)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t($ => $.common.delete)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Vehicle tab ────────────────────────────────────────────────────────────────

function VehicleTab({ driver }: { driver: Driver }) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const assign = useAssignVehicle();
  const release = useReleaseVehicle();

  const [vehicleId, setVehicleId] = useState('');
  const [releaseOpen, setReleaseOpen] = useState(false);

  const isArchived = driver.status === 'archived';
  const current = driver.current_vehicle ?? null;

  // Only vehicles free to take are offered, so BR-7 can't be tripped from the UI.
  const { data: vehicles, isLoading } = useVehicles({ available: 1, per_page: 100 }, !isArchived);
  const options = vehicles?.data ?? [];

  async function handleAssign() {
    if (!vehicleId) return;
    try {
      await assign.mutateAsync({ driverId: driver.id, vehicleId: Number(vehicleId) });
      toast({ title: current ? t($ => $.drivers.toast.vehicleChanged) : t($ => $.drivers.toast.vehicleAssigned) });
      setVehicleId('');
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.drivers.toast.assignmentFailed)), variant: 'destructive' });
    }
  }

  async function handleRelease() {
    try {
      await release.mutateAsync({ driverId: driver.id });
      toast({ title: t($ => $.drivers.toast.vehicleReleased) });
      setReleaseOpen(false);
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.drivers.toast.releaseFailed)), variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t($ => $.drivers.vehicle.intro)}</p>

      {current ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Truck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{current.plate_number}</p>
                  <Badge className="gap-1 bg-emerald-600 text-xs hover:bg-emerald-600">
                    <CheckCircle className="size-3" />
                    {t($ => $.common.assigned)}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{current.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t($ => $.drivers.vehicle.since, { date: formatDate(current.assigned_at) })}
                </p>
              </div>
            </div>
            {!isArchived && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                onClick={() => setReleaseOpen(true)}
                disabled={release.isPending}
              >
                <XCircle className="size-3" />
                {t($ => $.drivers.vehicle.release)}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border py-10 text-center">
          <Truck className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">{t($ => $.drivers.vehicle.empty.title)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t($ => $.drivers.vehicle.empty.hint)}
          </p>
        </div>
      )}

      {isArchived ? (
        <Alert>
          <AlertDescription className="text-sm">
            {t($ => $.drivers.vehicle.archivedNotice)}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label>{current ? t($ => $.drivers.vehicle.changeLabel) : t($ => $.drivers.vehicle.assignLabel)}</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger disabled={isLoading || options.length === 0}>
                <SelectValue
                  placeholder={
                    isLoading
                      ? t($ => $.drivers.vehicle.loadingPlaceholder)
                      : options.length === 0
                        ? t($ => $.drivers.vehicle.noneAvailable)
                        : t($ => $.drivers.vehicle.selectPlaceholder)
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="gap-1.5" onClick={handleAssign} disabled={!vehicleId || assign.isPending}>
            {assign.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Truck className="size-3.5" />}
            {current ? t($ => $.drivers.vehicle.change) : t($ => $.common.assign)}
          </Button>
        </div>
      )}

      <AlertDialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t($ => $.drivers.vehicle.releaseDialog.title)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t($ => $.drivers.vehicle.releaseDialog.body, {
                plate: current?.plate_number ?? '',
                name: driver.full_name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t($ => $.common.cancel)}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRelease}>{t($ => $.drivers.vehicle.release)}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── History tab ────────────────────────────────────────────────────────────────

function HistoryTab({ driver }: { driver: Driver }) {
  const { t } = useTranslation('logistics');
  const history = driver.assignments ?? [];

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-center">
        <History className="mb-2 size-8 text-muted-foreground/30" />
        <p className="text-sm font-medium">{t($ => $.drivers.history.empty.title)}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t($ => $.drivers.history.empty.hint)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t($ => $.drivers.history.count, { count: history.length })}
      </p>
      <ol className="relative space-y-3 border-s ps-5">
        {history.map((a) => (
          <li key={a.id} className="relative">
            <span
              className={`absolute -start-[1.6rem] mt-1.5 size-2.5 rounded-full ring-4 ring-background ${
                a.is_active ? 'bg-emerald-600' : 'bg-muted-foreground/40'
              }`}
            />
            <div className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">
                  {a.vehicle_plate ?? t($ => $.drivers.history.vehicleFallback, { id: a.vehicle_id })}
                </p>
                {a.is_active ? (
                  <Badge className="gap-1 bg-emerald-600 text-xs hover:bg-emerald-600">
                    <CheckCircle className="size-3" />
                    {t($ => $.common.active)}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">{t($ => $.drivers.history.released)}</Badge>
                )}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {t($ => $.drivers.history.durationDays, { days: a.duration_days })}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(a.assigned_at)} → {a.released_at ? formatDate(a.released_at) : t($ => $.drivers.history.present)}
              </p>
              {a.release_reason && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t($ => $.common.reason)}: {a.release_reason}
                </p>
              )}
              {(a.assigned_by || a.released_by) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.assigned_by ? t($ => $.drivers.history.assignedBy, { name: a.assigned_by }) : ''}
                  {a.assigned_by && a.released_by ? ' · ' : ''}
                  {a.released_by ? t($ => $.drivers.history.releasedBy, { name: a.released_by }) : ''}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Main drawer ────────────────────────────────────────────────────────────────

export function DriverDrawer({
  open,
  onOpenChange,
  editDriver,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editDriver: Driver | null;
}) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const isCreate = editDriver === null;

  const [form, setForm] = useState<DriverFormState>(EMPTY_FORM);
  const [tab, setTab] = useState('details');
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  const { data: detail, isLoading } = useDriver(open && editDriver ? editDriver.id : null);
  const { data: nextCode } = useNextDriverCode(open && isCreate);

  const createDriver = useCreateDriver();
  const updateDriver = useUpdateDriver();
  const setStatus = useSetDriverStatus();

  const driver = detail ?? editDriver;
  const saving = createDriver.isPending || updateDriver.isPending;
  const readOnly = driver?.status === 'archived';

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab('details');
    if (editDriver === null) {
      setForm(EMPTY_FORM);
      return;
    }
    const s = detail ?? editDriver;
    setForm({
      driver_code: s.driver_code,
      full_name: s.full_name,
      mobile: s.mobile,
      national_id: s.national_id,
      date_of_birth: s.date_of_birth ?? '',
      address: s.address ?? '',
      employment_date: s.employment_date ?? '',
      shipping_company_id: s.shipping_company_id ? String(s.shipping_company_id) : '',
      license_number: s.license_number ?? '',
      license_type: s.license_type ?? '',
      license_issue_date: s.license_issue_date ?? '',
      license_expiry_date: s.license_expiry_date ?? '',
      license_issuing_authority: s.license_issuing_authority ?? '',
      notes: s.notes ?? '',
    });
  }, [open, editDriver, detail]);

  useEffect(() => {
    if (open && isCreate && nextCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((p) => (p.driver_code === '' ? { ...p, driver_code: nextCode } : p));
    }
  }, [open, isCreate, nextCode]);

  async function handleSave() {
    if (!form.driver_code.trim() || !form.full_name.trim() || !form.mobile.trim() || !form.national_id.trim()) {
      toast({ title: t($ => $.drivers.toast.requiredFields), variant: 'destructive' });
      return;
    }
    try {
      if (isCreate) {
        await createDriver.mutateAsync(toPayload(form));
        toast({ title: t($ => $.drivers.toast.created, { name: form.full_name }) });
        onOpenChange(false);
      } else {
        await updateDriver.mutateAsync({ id: editDriver.id, payload: toPayload(form) });
        toast({ title: t($ => $.drivers.toast.saved) });
      }
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.drivers.toast.saveFailed)), variant: 'destructive' });
    }
  }

  async function handleSetStatus(status: 'active' | 'inactive' | 'archived') {
    if (!editDriver) return;
    try {
      await setStatus.mutateAsync({ id: editDriver.id, status });
      toast({
        title:
          status === 'archived'
            ? t($ => $.drivers.toast.archived)
            : status === 'active'
              ? t($ => $.drivers.toast.activated)
              : t($ => $.drivers.toast.deactivated),
      });
      if (status === 'archived') setArchiveConfirm(false);
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.drivers.toast.statusFailed)), variant: 'destructive' });
    }
  }

  const statusBadge =
    driver &&
    (driver.status === 'active' ? (
      <Badge className="bg-emerald-600 text-xs hover:bg-emerald-600">{t($ => $.common.active)}</Badge>
    ) : driver.status === 'inactive' ? (
      <Badge variant="secondary" className="text-xs">{t($ => $.common.inactive)}</Badge>
    ) : (
      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
        <Archive className="size-3" />
        {t($ => $.drivers.status.archived)}
      </Badge>
    ));

  return (
    <>
      <PageDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={isCreate ? t($ => $.drivers.page.newDriver) : (driver?.full_name ?? t($ => $.common.driver))}
        description={
          isCreate
            ? t($ => $.drivers.drawer.descriptionNew)
            : t($ => $.drivers.drawer.descriptionEdit, { code: driver?.driver_code ?? '' })
        }
        size="xl"
      >
        <div className="flex h-full flex-col">
          {!isCreate && driver && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {statusBadge}
              <LicenseStatusBadge
                status={driver.license_status}
                daysRemaining={driver.license_days_remaining}
                showCountdown
              />
              {driver.current_vehicle ? (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Truck className="size-3" />
                  {driver.current_vehicle.plate_number}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-xs text-amber-600">
                  <Truck className="size-3" />
                  {t($ => $.drivers.drawer.noVehicle)}
                </Badge>
              )}
            </div>
          )}

          {isCreate ? (
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pe-1">
                <DetailsFields form={form} setForm={setForm} disabled={saving} />
                <Separator />
                <div>
                  <p className="mb-3 text-sm font-semibold">{t($ => $.drivers.drawer.licenceSection)}</p>
                  <LicenseFields form={form} setForm={setForm} driver={null} disabled={saving} />
                </div>
              </div>
              <Separator className="my-4" />
              <div className="flex shrink-0 justify-end gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                  {t($ => $.common.cancel)}
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {t($ => $.drivers.drawer.createDriver)}
                </Button>
              </div>
            </>
          ) : isLoading && !driver ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            driver && (
              <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
                <TabsList className="grid w-full shrink-0 grid-cols-5">
                  <TabsTrigger value="details">{t($ => $.drivers.drawer.tabs.details)}</TabsTrigger>
                  <TabsTrigger value="license">{t($ => $.drivers.drawer.tabs.license)}</TabsTrigger>
                  <TabsTrigger value="documents" className="gap-1.5">
                    {t($ => $.drivers.drawer.tabs.documents)}
                    {driver.documents_count != null && driver.documents_count > 0 && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        {driver.documents_count}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="vehicle">{t($ => $.common.vehicle)}</TabsTrigger>
                  <TabsTrigger value="history" className="gap-1.5">
                    {t($ => $.common.history)}
                    {driver.assignments_count != null && driver.assignments_count > 0 && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        {driver.assignments_count}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <div className="min-h-0 flex-1 overflow-y-auto pe-1 pt-4">
                  <TabsContent value="details" className="mt-0 space-y-4">
                    <DetailsFields form={form} setForm={setForm} disabled={saving || readOnly} />
                    <Separator />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {driver.status === 'archived' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleSetStatus('inactive')}
                            disabled={setStatus.isPending}
                          >
                            <ArchiveRestore className="size-3.5" />
                            {t($ => $.drivers.actions.restoreFromArchive)}
                          </Button>
                        ) : (
                          <>
                            {driver.status === 'active' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => handleSetStatus('inactive')}
                                disabled={setStatus.isPending}
                              >
                                <XCircle className="size-3.5" />
                                {t($ => $.drivers.actions.deactivate)}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-emerald-700"
                                onClick={() => handleSetStatus('active')}
                                disabled={setStatus.isPending}
                              >
                                <CheckCircle className="size-3.5" />
                                {t($ => $.drivers.actions.activate)}
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-destructive hover:text-destructive"
                              onClick={() => setArchiveConfirm(true)}
                              disabled={setStatus.isPending}
                            >
                              <Archive className="size-3.5" />
                              {t($ => $.drivers.actions.archive)}
                            </Button>
                          </>
                        )}
                      </div>
                      {!readOnly && (
                        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                          {saving && <Loader2 className="size-4 animate-spin" />}
                          {t($ => $.common.saveChanges)}
                        </Button>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="license" className="mt-0 space-y-4">
                    <LicenseFields form={form} setForm={setForm} driver={driver} disabled={saving || readOnly} />
                    {!readOnly && (
                      <>
                        <Separator />
                        <div className="flex justify-end">
                          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                            {saving && <Loader2 className="size-4 animate-spin" />}
                            {t($ => $.drivers.drawer.saveLicence)}
                          </Button>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="documents" className="mt-0">
                    <DocumentsTab driver={driver} />
                  </TabsContent>

                  <TabsContent value="vehicle" className="mt-0">
                    <VehicleTab driver={driver} />
                  </TabsContent>

                  <TabsContent value="history" className="mt-0">
                    <HistoryTab driver={driver} />
                  </TabsContent>
                </div>
              </Tabs>
            )
          )}
        </div>
      </PageDrawer>

      <AlertDialog open={archiveConfirm} onOpenChange={setArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Driver</AlertDialogTitle>
            <AlertDialogDescription>
              Archive <strong>{driver?.full_name}</strong>? Any assigned vehicle is released back to
              the pool. Archived drivers are hidden from the default list and cannot be assigned
              vehicles or documents. Drivers are never deleted, so this can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleSetStatus('archived')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
