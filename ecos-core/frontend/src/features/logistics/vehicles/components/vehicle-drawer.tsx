import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Archive,
  Download,
  FileText,
  Loader2,
  Lock,
  Paperclip,
  Pencil,
  ShieldAlert,
  Trash2,
  Truck,
  Upload,
  UserRound,
  Wrench,
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
  useAmendMaintenance,
  useCanManageMaintenance,
  useCreateVehicle,
  useDeleteMaintenance,
  useDeleteVehicleDocument,
  useNextVehicleCode,
  useRecordMaintenance,
  useSetVehicleStatus,
  useUpdateVehicle,
  useUploadVehicleDocument,
  useVehicle,
  useVehicleOptions,
} from '../hooks/use-vehicles';
import { vehicleService } from '../services/vehicle-service';
import type {
  MaintenanceType,
  Vehicle,
  VehicleDocument,
  VehiclePayload,
  VehicleStatus,
  VehicleType,
} from '../types/vehicle';
import { VehicleStatusBadge } from './vehicle-status-badge';
import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Status → translation key. Kept local so this module only exports components. */
const STATUS_LABEL_KEYS: Record<VehicleStatus, LogisticsLabel> = {
  available: ($) => $.common.available,
  assigned: ($) => $.common.assigned,
  in_delivery: ($) => $.vehicles.status.inDelivery,
  maintenance: ($) => $.vehicles.status.maintenance,
  out_of_service: ($) => $.vehicles.status.outOfService,
  archived: ($) => $.vehicles.status.archived,
};

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
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Form state ─────────────────────────────────────────────────────────────────

type VehicleFormState = {
  vehicle_code: string;
  plate_number: string;
  name: string;
  type: string;
  shipping_company_id: string;
  capacity_orders: string;
  capacity_weight_kg: string;
  capacity_volume_m3: string;
  fuel_type: string;
  manufacturer: string;
  model: string;
  year: string;
  color: string;
  vin: string;
  notes: string;
};

const EMPTY_FORM: VehicleFormState = {
  vehicle_code: '',
  plate_number: '',
  name: '',
  type: 'van',
  shipping_company_id: '',
  capacity_orders: '',
  capacity_weight_kg: '',
  capacity_volume_m3: '',
  fuel_type: '',
  manufacturer: '',
  model: '',
  year: '',
  color: '',
  vin: '',
  notes: '',
};

function toPayload(form: VehicleFormState): VehiclePayload {
  const text = (v: string) => (v.trim() === '' ? null : v.trim());
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  return {
    vehicle_code: form.vehicle_code.trim(),
    plate_number: form.plate_number.trim(),
    name: text(form.name),
    type: form.type as VehicleType,
    shipping_company_id: form.shipping_company_id ? Number(form.shipping_company_id) : null,
    capacity_orders: Number(form.capacity_orders || 0),
    capacity_weight_kg: num(form.capacity_weight_kg),
    capacity_volume_m3: num(form.capacity_volume_m3),
    fuel_type: (text(form.fuel_type) as VehiclePayload['fuel_type']) ?? null,
    manufacturer: text(form.manufacturer),
    model: text(form.model),
    year: num(form.year),
    color: text(form.color),
    vin: text(form.vin),
    notes: text(form.notes),
  };
}

// ── Details tab ────────────────────────────────────────────────────────────────

function DetailsFields({
  form,
  setForm,
  disabled,
}: {
  form: VehicleFormState;
  setForm: (fn: (prev: VehicleFormState) => VehicleFormState) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation('logistics');
  const { data: options } = useVehicleOptions();
  const { data: carriers } = useShippingCompanies({ status: 'active', per_page: 100 });
  const set = (k: keyof VehicleFormState) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  /** Picking a type pre-fills a sensible order capacity when the field is empty. */
  function onTypeChange(value: string) {
    const preset = options?.types.find((t) => t.value === value)?.default_capacity_orders;
    setForm((p) => ({
      ...p,
      type: value,
      capacity_orders: p.capacity_orders === '' && preset ? String(preset) : p.capacity_orders,
    }));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vh-code">{t($ => $.vehicles.form.vehicleCode)} *</Label>
          <Input
            id="vh-code"
            value={form.vehicle_code}
            disabled={disabled}
            className="font-mono"
            placeholder="VEH-001"
            onChange={(e) => set('vehicle_code')(e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vh-plate">{t($ => $.vehicles.form.plateNumber)} *</Label>
          <Input
            id="vh-plate"
            value={form.plate_number}
            disabled={disabled}
            className="font-mono"
            onChange={(e) => set('plate_number')(e.target.value.toUpperCase())}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vh-name">{t($ => $.vehicles.form.vehicleName)}</Label>
          <Input
            id="vh-name"
            value={form.name}
            disabled={disabled}
            placeholder={t($ => $.vehicles.form.vehicleNamePlaceholder)}
            onChange={(e) => set('name')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t($ => $.vehicles.form.vehicleType)} *</Label>
          <Select value={form.type} onValueChange={onTypeChange}>
            <SelectTrigger disabled={disabled}>
              <SelectValue placeholder={t($ => $.vehicles.form.selectType)} />
            </SelectTrigger>
            <SelectContent>
              {(options?.types ?? []).map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t($ => $.vehicles.form.shippingCompany)}</Label>
        <Select value={form.shipping_company_id} onValueChange={set('shipping_company_id')}>
          <SelectTrigger disabled={disabled}>
            <SelectValue placeholder={t($ => $.vehicles.form.selectCarrier)} />
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

      <Separator />
      <p className="text-sm font-semibold">{t($ => $.common.capacity)}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="vh-cap-o">{t($ => $.vehicles.form.capacityOrders)} *</Label>
          <Input
            id="vh-cap-o"
            type="number"
            min={1}
            value={form.capacity_orders}
            disabled={disabled}
            onChange={(e) => set('capacity_orders')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vh-cap-w">{t($ => $.vehicles.form.capacityWeight)}</Label>
          <Input
            id="vh-cap-w"
            type="number"
            min={0}
            step="0.01"
            value={form.capacity_weight_kg}
            disabled={disabled}
            onChange={(e) => set('capacity_weight_kg')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vh-cap-v">{t($ => $.vehicles.form.capacityVolume)}</Label>
          <Input
            id="vh-cap-v"
            type="number"
            min={0}
            step="0.001"
            value={form.capacity_volume_m3}
            disabled={disabled}
            onChange={(e) => set('capacity_volume_m3')(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t($ => $.vehicles.form.capacityHint)}</p>

      <Separator />
      <p className="text-sm font-semibold">{t($ => $.vehicles.form.specification)}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t($ => $.vehicles.form.fuelType)}</Label>
          <Select value={form.fuel_type} onValueChange={set('fuel_type')}>
            <SelectTrigger disabled={disabled}>
              <SelectValue placeholder={t($ => $.vehicles.form.selectFuelType)} />
            </SelectTrigger>
            <SelectContent>
              {(options?.fuel_types ?? []).map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vh-manu">{t($ => $.vehicles.form.manufacturer)}</Label>
          <Input
            id="vh-manu"
            value={form.manufacturer}
            disabled={disabled}
            onChange={(e) => set('manufacturer')(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="vh-model">{t($ => $.vehicles.form.model)}</Label>
          <Input id="vh-model" value={form.model} disabled={disabled} onChange={(e) => set('model')(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vh-year">{t($ => $.vehicles.form.year)}</Label>
          <Input
            id="vh-year"
            type="number"
            min={1950}
            max={2100}
            value={form.year}
            disabled={disabled}
            onChange={(e) => set('year')(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vh-color">{t($ => $.vehicles.form.color)}</Label>
          <Input id="vh-color" value={form.color} disabled={disabled} onChange={(e) => set('color')(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vh-vin">{t($ => $.vehicles.form.vin)}</Label>
        <Input
          id="vh-vin"
          value={form.vin}
          disabled={disabled}
          className="font-mono"
          placeholder={t($ => $.common.optional)}
          onChange={(e) => set('vin')(e.target.value.toUpperCase())}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vh-notes">{t($ => $.common.notes)}</Label>
        <Textarea id="vh-notes" rows={3} value={form.notes} disabled={disabled} onChange={(e) => set('notes')(e.target.value)} />
      </div>
    </div>
  );
}

// ── Maintenance tab ────────────────────────────────────────────────────────────

type MaintenanceFormState = {
  performed_on: string;
  type: string;
  description: string;
  cost: string;
  vendor: string;
  next_maintenance_date: string;
  notes: string;
};

const EMPTY_MAINTENANCE: MaintenanceFormState = {
  performed_on: '',
  type: 'routine',
  description: '',
  cost: '',
  vendor: '',
  next_maintenance_date: '',
  notes: '',
};

function MaintenanceTab({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const { data: options } = useVehicleOptions();
  const { data: canManage = false } = useCanManageMaintenance();
  const record = useRecordMaintenance();
  const amend = useAmendMaintenance();
  const remove = useDeleteMaintenance();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MaintenanceFormState>(EMPTY_MAINTENANCE);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const records = vehicle.maintenance_records ?? [];
  const saving = record.isPending || amend.isPending;
  const set = (k: keyof MaintenanceFormState) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_MAINTENANCE, performed_on: new Date().toISOString().slice(0, 10) });
    setFormOpen(true);
  }

  function openEdit(r: (typeof records)[number]) {
    setEditingId(r.id);
    setForm({
      performed_on: r.performed_on ?? '',
      type: r.type,
      description: r.description ?? '',
      cost: String(r.cost ?? ''),
      vendor: r.vendor ?? '',
      next_maintenance_date: r.next_maintenance_date ?? '',
      notes: r.notes ?? '',
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.performed_on) {
      toast({ title: t($ => $.vehicles.maintenance.toast.dateRequired), variant: 'destructive' });
      return;
    }
    const payload = {
      performed_on: form.performed_on,
      type: form.type as MaintenanceType,
      description: form.description.trim() || null,
      cost: form.cost.trim() === '' ? null : Number(form.cost),
      vendor: form.vendor.trim() || null,
      next_maintenance_date: form.next_maintenance_date || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editingId !== null) {
        await amend.mutateAsync({ vehicleId: vehicle.id, recordId: editingId, payload });
        toast({ title: t($ => $.vehicles.maintenance.toast.amended) });
      } else {
        await record.mutateAsync({ vehicleId: vehicle.id, payload });
        toast({ title: t($ => $.vehicles.maintenance.toast.recorded) });
      }
      setFormOpen(false);
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.vehicles.maintenance.toast.saveFailed)), variant: 'destructive' });
    }
  }

  async function handleDelete() {
    if (deleteTarget === null) return;
    try {
      await remove.mutateAsync({ vehicleId: vehicle.id, recordId: deleteTarget });
      toast({ title: t($ => $.vehicles.maintenance.toast.deleted) });
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.vehicles.maintenance.toast.deleteFailed)), variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t($ => $.vehicles.maintenance.recordCount, { count: records.length })}
          {!canManage && ` ${t($ => $.vehicles.maintenance.immutableNote)}`}
        </p>
        {!formOpen && (
          <Button size="sm" className="shrink-0 gap-1.5" onClick={openCreate}>
            <Wrench className="size-3.5" />
            {t($ => $.vehicles.maintenance.recordService)}
          </Button>
        )}
      </div>

      {!canManage && (
        <Alert>
          <Lock className="size-4" />
          <AlertDescription className="text-sm">
            {t($ => $.vehicles.maintenance.permissionNotice)}
          </AlertDescription>
        </Alert>
      )}

      {formOpen && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-semibold">
            {editingId !== null ? t($ => $.vehicles.maintenance.amendRecord) : t($ => $.vehicles.maintenance.newRecord)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mt-date">{t($ => $.common.date)} *</Label>
              <Input
                id="mt-date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.performed_on}
                onChange={(e) => set('performed_on')(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t($ => $.common.type)} *</Label>
              <Select value={form.type} onValueChange={set('type')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(options?.maintenance_types ?? []).map((mt) => (
                    <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-desc">{t($ => $.common.description)}</Label>
            <Textarea id="mt-desc" rows={2} value={form.description} onChange={(e) => set('description')(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mt-cost">{t($ => $.vehicles.maintenance.cost)}</Label>
              <Input id="mt-cost" type="number" min={0} step="0.01" value={form.cost} onChange={(e) => set('cost')(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mt-vendor">{t($ => $.vehicles.maintenance.vendor)}</Label>
              <Input id="mt-vendor" value={form.vendor} onChange={(e) => set('vendor')(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-next">{t($ => $.vehicles.maintenance.nextDate)}</Label>
            <Input
              id="mt-next"
              type="date"
              min={form.performed_on || undefined}
              value={form.next_maintenance_date}
              onChange={(e) => set('next_maintenance_date')(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} disabled={saving}>
              {t($ => $.common.cancel)}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {editingId !== null ? t($ => $.vehicles.maintenance.saveAmendment) : t($ => $.vehicles.maintenance.record)}
            </Button>
          </div>
        </div>
      )}

      {records.length === 0 && !formOpen ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-center">
          <Wrench className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">{t($ => $.vehicles.maintenance.emptyTitle)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t($ => $.vehicles.maintenance.emptyDescription)}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">{r.type_label}</Badge>
                    <span className="text-sm font-medium">{formatDate(r.performed_on)}</span>
                    {r.cost > 0 && (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {formatMoney(r.cost, r.currency)}
                      </span>
                    )}
                    {r.is_next_service_due && (
                      <Badge variant="destructive" className="text-xs">{t($ => $.vehicles.maintenance.serviceDue)}</Badge>
                    )}
                    {r.was_amended && (
                      <Badge variant="secondary" className="text-xs">{t($ => $.vehicles.maintenance.amended)}</Badge>
                    )}
                  </div>
                  {r.description && <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.vendor ? `${r.vendor}` : t($ => $.vehicles.maintenance.noVendor)}
                    {r.next_maintenance_date
                      ? ` · ${t($ => $.vehicles.maintenance.nextOn, { date: formatDate(r.next_maintenance_date) })}`
                      : ''}
                    {r.recorded_by ? ` · ${t($ => $.vehicles.maintenance.byUser, { name: r.recorded_by })}` : ''}
                  </p>
                  {r.was_amended && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t($ => $.vehicles.maintenance.amendedBy, {
                        name: r.amended_by ?? t($ => $.common.unknown),
                        date: formatDate(r.amended_at),
                      })}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(r.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t($ => $.vehicles.maintenance.deleteTitle)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t($ => $.vehicles.maintenance.deleteDescription)}
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

// ── Documents tab ──────────────────────────────────────────────────────────────

function DocumentsTab({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const { data: options } = useVehicleOptions();
  const upload = useUploadVehicleDocument();
  const remove = useDeleteVehicleDocument();
  const fileRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<string>('license');
  const [reference, setReference] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VehicleDocument | null>(null);

  const documents = vehicle.documents ?? [];
  const isArchived = vehicle.status === 'archived';

  async function handleUpload() {
    if (!file) {
      toast({ title: t($ => $.vehicles.documents.toast.chooseFile), variant: 'destructive' });
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    if (reference.trim()) form.append('reference_number', reference.trim());
    if (expiresAt) form.append('expires_at', expiresAt);

    try {
      await upload.mutateAsync({ vehicleId: vehicle.id, form });
      toast({ title: t($ => $.vehicles.documents.toast.uploaded) });
      setFile(null);
      setReference('');
      setExpiresAt('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.vehicles.documents.toast.uploadFailed)), variant: 'destructive' });
    }
  }

  async function handleDownload(doc: VehicleDocument) {
    try {
      await vehicleService.downloadDocument(vehicle.id, doc);
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.vehicles.documents.toast.downloadFailed)), variant: 'destructive' });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync({ vehicleId: vehicle.id, documentId: deleteTarget.id });
      toast({ title: t($ => $.vehicles.documents.toast.deleted) });
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.vehicles.documents.toast.deleteFailed)), variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  }

  const blockingDocumentNames = (vehicle.blocking_expired_documents ?? [])
    .map((d) => t($ => $.vehicles.documentType[d.type], { defaultValue: d.type.replace('_', ' ') }))
    .join(t($ => $.vehicles.documents.joinAnd));

  return (
    <div className="space-y-4">
      {vehicle.can_be_dispatched === false && (vehicle.blocking_expired_documents?.length ?? 0) > 0 && (
        <Alert className="border-destructive/40 bg-destructive/5">
          <ShieldAlert className="size-4" />
          <AlertDescription className="text-sm">
            {t($ => $.vehicles.documents.blockedAlert, { documents: blockingDocumentNames })}
          </AlertDescription>
        </Alert>
      )}

      {isArchived ? (
        <Alert>
          <AlertDescription className="text-sm">
            {t($ => $.vehicles.documents.archivedNotice)}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-semibold">{t($ => $.vehicles.documents.uploadTitle)}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t($ => $.common.type)} *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(options?.document_types ?? []).map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vd-exp">{t($ => $.vehicles.documents.expiresOn)}</Label>
              <Input id="vd-exp" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vd-ref">{t($ => $.vehicles.documents.referenceNumber)}</Label>
            <Input id="vd-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vd-file">
              {t($ => $.vehicles.documents.file)} *{' '}
              <span className="font-normal text-muted-foreground">{t($ => $.vehicles.documents.fileHint)}</span>
            </Label>
            <Input
              id="vd-file"
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={handleUpload} disabled={upload.isPending || !file}>
              {upload.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {t($ => $.vehicles.documents.upload)}
            </Button>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-center">
          <Paperclip className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">{t($ => $.vehicles.documents.emptyTitle)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t($ => $.vehicles.documents.emptyDescription)}</p>
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
                    <Badge variant="outline" className="text-xs">{doc.type_label}</Badge>
                    {doc.is_expired && (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <AlertTriangle className="size-3" />
                        {t($ => $.vehicles.documents.expired)}
                      </Badge>
                    )}
                    {doc.is_expiring_soon && (
                      <Badge className="bg-amber-500 text-xs hover:bg-amber-500">
                        {t($ => $.vehicles.documents.expiresInDays, { days: doc.days_until_expiry })}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {doc.file_name} · {formatBytes(doc.size_bytes)}
                    {doc.reference_number
                      ? ` · ${t($ => $.vehicles.documents.ref, { value: doc.reference_number })}`
                      : ''}
                    {doc.expires_at
                      ? ` · ${t($ => $.vehicles.documents.expiresValue, { date: formatDate(doc.expires_at) })}`
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
            <AlertDialogTitle>{t($ => $.vehicles.documents.deleteTitle)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t($ => $.vehicles.documents.deletePrefix)}{' '}
              <strong>{deleteTarget?.title || deleteTarget?.file_name}</strong>
              {t($ => $.vehicles.documents.deleteSuffix)}
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

// ── Assignment tab ─────────────────────────────────────────────────────────────

function AssignmentTab({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation('logistics');
  const driver = vehicle.current_driver ?? null;

  const blockingDocumentNames = (vehicle.blocking_expired_documents ?? [])
    .map((d) => t($ => $.vehicles.documentType[d.type], { defaultValue: d.type.replace('_', ' ') }))
    .join(t($ => $.vehicles.documents.joinAnd));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t($ => $.vehicles.assignment.intro)}
      </p>

      {driver ? (
        <div className="rounded-lg border border-blue-500/40 bg-blue-500/5 p-4">
          <div className="flex items-start gap-2.5">
            <UserRound className="mt-0.5 size-4 shrink-0 text-blue-600" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{driver.full_name}</p>
                <Badge variant="outline" className="font-mono text-xs">{driver.driver_code}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t($ => $.vehicles.assignment.assignedOn, { date: formatDate(driver.assigned_at) })}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border py-10 text-center">
          <UserRound className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">{t($ => $.vehicles.assignment.emptyTitle)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t($ => $.vehicles.assignment.emptyDescription)}
          </p>
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-semibold">{t($ => $.vehicles.assignment.dispatchReadiness)}</p>
        <div className="flex items-center gap-2">
          {vehicle.can_be_dispatched ? (
            <Badge className="bg-emerald-600 text-xs hover:bg-emerald-600">
              {t($ => $.vehicles.dispatch.readyForDispatch)}
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1 text-xs">
              <ShieldAlert className="size-3" />
              {t($ => $.vehicles.dispatch.notDispatchable)}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {t($ => $.vehicles.assignment.statusLine, { status: t(STATUS_LABEL_KEYS[vehicle.status]) })}
            {vehicle.next_document_expiry
              ? ` · ${t($ => $.vehicles.assignment.nextDocExpiry, { date: formatDate(vehicle.next_document_expiry) })}`
              : ''}
          </span>
        </div>
        {(vehicle.blocking_expired_documents?.length ?? 0) > 0 && (
          <p className="text-xs text-destructive">
            {t($ => $.vehicles.assignment.blockedByExpired, { documents: blockingDocumentNames })}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main drawer ────────────────────────────────────────────────────────────────

export function VehicleDrawer({
  open,
  onOpenChange,
  editVehicle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editVehicle: Vehicle | null;
}) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const isCreate = editVehicle === null;

  const [form, setForm] = useState<VehicleFormState>(EMPTY_FORM);
  const [tab, setTab] = useState('details');
  const [statusTarget, setStatusTarget] = useState<VehicleStatus | null>(null);

  const { data: detail, isLoading } = useVehicle(open && editVehicle ? editVehicle.id : null);
  const { data: nextCode } = useNextVehicleCode(open && isCreate);
  const { data: options } = useVehicleOptions();

  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const setStatus = useSetVehicleStatus();

  const vehicle = detail ?? editVehicle;
  const saving = createVehicle.isPending || updateVehicle.isPending;
  const readOnly = vehicle?.status === 'archived';

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab('details');
    if (editVehicle === null) {
      setForm(EMPTY_FORM);
      return;
    }
    const s = detail ?? editVehicle;
    setForm({
      vehicle_code: s.vehicle_code,
      plate_number: s.plate_number,
      name: s.name ?? '',
      type: s.type,
      shipping_company_id: s.shipping_company_id ? String(s.shipping_company_id) : '',
      capacity_orders: String(s.capacity_orders ?? ''),
      capacity_weight_kg: s.capacity_weight_kg != null ? String(s.capacity_weight_kg) : '',
      capacity_volume_m3: s.capacity_volume_m3 != null ? String(s.capacity_volume_m3) : '',
      fuel_type: s.fuel_type ?? '',
      manufacturer: s.manufacturer ?? '',
      model: s.model ?? '',
      year: s.year != null ? String(s.year) : '',
      color: s.color ?? '',
      vin: s.vin ?? '',
      notes: s.notes ?? '',
    });
  }, [open, editVehicle, detail]);

  useEffect(() => {
    if (open && isCreate && nextCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((p) => (p.vehicle_code === '' ? { ...p, vehicle_code: nextCode } : p));
    }
  }, [open, isCreate, nextCode]);

  async function handleSave() {
    if (!form.vehicle_code.trim() || !form.plate_number.trim() || !form.capacity_orders) {
      toast({ title: t($ => $.vehicles.toast.requiredFields), variant: 'destructive' });
      return;
    }
    try {
      if (isCreate) {
        await createVehicle.mutateAsync(toPayload(form));
        toast({ title: t($ => $.vehicles.toast.created, { plate: form.plate_number }) });
        onOpenChange(false);
      } else {
        await updateVehicle.mutateAsync({ id: editVehicle.id, payload: toPayload(form) });
        toast({ title: t($ => $.vehicles.toast.saved) });
      }
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.vehicles.toast.saveFailed)), variant: 'destructive' });
    }
  }

  async function handleStatusChange(status: VehicleStatus) {
    if (!editVehicle) return;
    try {
      await setStatus.mutateAsync({ id: editVehicle.id, status });
      toast({ title: t($ => $.vehicles.toast.statusChanged, { status: t(STATUS_LABEL_KEYS[status]) }) });
      setStatusTarget(null);
    } catch (err) {
      toast({ title: apiErrorMessage(err, t($ => $.vehicles.toast.statusChangeFailed)), variant: 'destructive' });
      setStatusTarget(null);
    }
  }

  /** Only transitions the server would accept are offered. */
  const settable = new Set((options?.operator_settable_statuses ?? []).map((s) => s.value));
  const nextStates = (vehicle?.allowed_transitions ?? []).filter((t) => settable.has(t.value));

  return (
    <>
      <PageDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={isCreate ? t($ => $.vehicles.drawer.newTitle) : (vehicle?.label ?? t($ => $.vehicles.drawer.fallbackTitle))}
        description={
          isCreate
            ? t($ => $.vehicles.drawer.createDescription)
            : t($ => $.vehicles.drawer.editDescription, { code: vehicle?.vehicle_code ?? '' })
        }
        size="xl"
      >
        <div className="flex h-full flex-col">
          {!isCreate && vehicle && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <VehicleStatusBadge status={vehicle.status} />
              <Badge variant="outline" className="gap-1 text-xs">
                <Truck className="size-3" />
                {vehicle.type_label}
              </Badge>
              {vehicle.current_driver && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <UserRound className="size-3" />
                  {vehicle.current_driver.full_name}
                </Badge>
              )}
              {vehicle.can_be_dispatched === false && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <ShieldAlert className="size-3" />
                  {t($ => $.vehicles.dispatch.notDispatchable)}
                </Badge>
              )}
            </div>
          )}

          {isCreate ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto pe-1">
                <DetailsFields form={form} setForm={setForm} disabled={saving} />
              </div>
              <Separator className="my-4" />
              <div className="flex shrink-0 justify-end gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                  {t($ => $.common.cancel)}
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {t($ => $.vehicles.actions.create)}
                </Button>
              </div>
            </>
          ) : isLoading && !vehicle ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            vehicle && (
              <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
                <TabsList className="grid w-full shrink-0 grid-cols-4">
                  <TabsTrigger value="details">{t($ => $.vehicles.tabs.details)}</TabsTrigger>
                  <TabsTrigger value="maintenance" className="gap-1.5">
                    {t($ => $.vehicles.tabs.service)}
                    {vehicle.maintenance_records_count != null && vehicle.maintenance_records_count > 0 && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        {vehicle.maintenance_records_count}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="gap-1.5">
                    {t($ => $.vehicles.tabs.docs)}
                    {vehicle.documents_count != null && vehicle.documents_count > 0 && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                        {vehicle.documents_count}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="assignment">{t($ => $.common.driver)}</TabsTrigger>
                </TabsList>

                <div className="min-h-0 flex-1 overflow-y-auto pe-1 pt-4">
                  <TabsContent value="details" className="mt-0 space-y-4">
                    <DetailsFields form={form} setForm={setForm} disabled={saving || readOnly} />
                    <Separator />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {nextStates.map((transition) => (
                          <Button
                            key={transition.value}
                            variant="outline"
                            size="sm"
                            className={`gap-1.5 ${transition.value === 'archived' ? 'text-destructive hover:text-destructive' : ''}`}
                            onClick={() => setStatusTarget(transition.value as VehicleStatus)}
                            disabled={setStatus.isPending}
                          >
                            {transition.value === 'archived' && <Archive className="size-3.5" />}
                            {transition.value === 'maintenance' && <Wrench className="size-3.5" />}
                            {t($ => $.vehicles.actions.mark, {
                              status: STATUS_LABEL_KEYS[transition.value as VehicleStatus]
                                ? t(STATUS_LABEL_KEYS[transition.value as VehicleStatus])
                                : transition.label,
                            })}
                          </Button>
                        ))}
                      </div>
                      {!readOnly && (
                        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                          {saving && <Loader2 className="size-4 animate-spin" />}
                          {t($ => $.common.saveChanges)}
                        </Button>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="maintenance" className="mt-0">
                    <MaintenanceTab vehicle={vehicle} />
                  </TabsContent>

                  <TabsContent value="documents" className="mt-0">
                    <DocumentsTab vehicle={vehicle} />
                  </TabsContent>

                  <TabsContent value="assignment" className="mt-0">
                    <AssignmentTab vehicle={vehicle} />
                  </TabsContent>
                </div>
              </Tabs>
            )
          )}
        </div>
      </PageDrawer>

      <AlertDialog open={statusTarget !== null} onOpenChange={(o) => { if (!o) setStatusTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t($ => $.vehicles.statusDialog.title)}</AlertDialogTitle>
            <AlertDialogDescription>
              {t($ => $.vehicles.statusDialog.movePrefix)} <strong>{vehicle?.plate_number}</strong>{' '}
              {t($ => $.vehicles.statusDialog.moveMiddle)}{' '}
              <strong>{statusTarget ? t(STATUS_LABEL_KEYS[statusTarget]) : ''}</strong>
              {t($ => $.vehicles.statusDialog.moveSuffix)}
              {statusTarget === 'archived' && ` ${t($ => $.vehicles.statusDialog.archivedNote)}`}
              {statusTarget === 'out_of_service' && ` ${t($ => $.vehicles.statusDialog.outOfServiceNote)}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t($ => $.common.cancel)}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusTarget && handleStatusChange(statusTarget)}
              className={statusTarget === 'archived' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {t($ => $.common.confirm)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
