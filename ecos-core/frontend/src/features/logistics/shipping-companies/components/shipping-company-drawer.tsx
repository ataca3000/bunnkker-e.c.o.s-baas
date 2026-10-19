import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  Building2,
  CheckCircle,
  FileText,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Truck,
  Warehouse,
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ds/use-toast';

import { companiesService } from '@/features/companies/services/companies-service';
import {
  useActivateShippingContract,
  useCreateShippingCompany,
  useCreateShippingContract,
  useCreateShippingMapping,
  useDeleteShippingContract,
  useDeleteShippingMapping,
  useNextShippingCompanyCode,
  useSetShippingCompanyStatus,
  useShippingCompany,
  useUpdateShippingCompany,
  useUpdateShippingContract,
} from '../hooks/use-shipping-companies';
import type {
  ShippingCompany,
  ShippingCompanyPayload,
  ShippingCompanyType,
  ShippingContract,
  ShippingContractPayload,
} from '../types/shipping-company';

// ── Helpers ────────────────────────────────────────────────────────────────────

function apiErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const res = (err as { response?: { data?: { message?: string } } }).response;
    if (res?.data?.message) return res.data.message;
  }
  return fallback;
}

function TypeBadge({ type }: { type: ShippingCompanyType }) {
  return type === 'internal' ? (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Warehouse className="size-3" />
      Internal Fleet
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-xs">
      <Truck className="size-3" />
      External Provider
    </Badge>
  );
}

// ── Company Form (create + edit details) ───────────────────────────────────────

type CompanyFormState = {
  name: string;
  code: string;
  type: ShippingCompanyType;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  is_active: boolean;
};

const EMPTY_FORM: CompanyFormState = {
  name: '',
  code: '',
  type: 'external',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  is_active: true,
};

function toPayload(form: CompanyFormState, isCreate: boolean): ShippingCompanyPayload {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    ...(isCreate ? { type: form.type } : {}),
    contact_person: form.contact_person.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    notes: form.notes.trim() || null,
    ...(isCreate ? { status: form.is_active ? 'active' : 'inactive' } : {}),
  } as ShippingCompanyPayload;
}

function CompanyFormFields({
  form,
  setForm,
  isCreate,
  disabled,
}: {
  form: CompanyFormState;
  setForm: (updater: (prev: CompanyFormState) => CompanyFormState) => void;
  isCreate: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sc-name">Company Name *</Label>
          <Input
            id="sc-name"
            value={form.name}
            disabled={disabled}
            placeholder="e.g. Bosta"
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sc-code">Code *</Label>
          <Input
            id="sc-code"
            value={form.code}
            disabled={disabled}
            placeholder="SHC-001"
            className="font-mono"
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
          />
        </div>
      </div>

      {isCreate ? (
        <div className="space-y-1.5">
          <Label>Type *</Label>
          <Select
            value={form.type}
            onValueChange={(v) => setForm((p) => ({ ...p, type: v as ShippingCompanyType }))}
          >
            <SelectTrigger disabled={disabled}>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="external">External Provider (Bosta, Aramex…)</SelectItem>
              <SelectItem value="internal">Internal Fleet (own vehicles)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Type cannot be changed after creation.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground">Type</Label>
          <TypeBadge type={form.type} />
          <span className="text-xs text-muted-foreground">— locked after creation</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sc-contact">Contact Person</Label>
          <Input
            id="sc-contact"
            value={form.contact_person}
            disabled={disabled}
            onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sc-phone">Phone</Label>
          <Input
            id="sc-phone"
            value={form.phone}
            disabled={disabled}
            placeholder="01xxxxxxxxx"
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sc-email">Email</Label>
        <Input
          id="sc-email"
          type="email"
          value={form.email}
          disabled={disabled}
          placeholder="ops@carrier.com"
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sc-address">Address</Label>
        <Input
          id="sc-address"
          value={form.address}
          disabled={disabled}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sc-notes">Notes</Label>
        <Textarea
          id="sc-notes"
          value={form.notes}
          disabled={disabled}
          rows={3}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />
      </div>

      {isCreate && (
        <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Active</p>
            <p className="text-xs text-muted-foreground">Company is available for assignments</p>
          </div>
          <Switch
            checked={form.is_active}
            disabled={disabled}
            onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
          />
        </div>
      )}
    </div>
  );
}

// ── Contracts Tab ──────────────────────────────────────────────────────────────

type ContractFormState = {
  name: string;
  start_date: string;
  end_date: string;
  payment_terms: string;
  notes: string;
};

const EMPTY_CONTRACT: ContractFormState = {
  name: '',
  start_date: '',
  end_date: '',
  payment_terms: '',
  notes: '',
};

function ContractsTab({ company }: { company: ShippingCompany }) {
  const { toast } = useToast();
  const createContract = useCreateShippingContract();
  const updateContract = useUpdateShippingContract();
  const deleteContract = useDeleteShippingContract();
  const activateContract = useActivateShippingContract();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShippingContract | null>(null);
  const [form, setForm] = useState<ContractFormState>(EMPTY_CONTRACT);
  const [deleteTarget, setDeleteTarget] = useState<ShippingContract | null>(null);

  const contracts = company.contracts ?? [];
  const isArchived = company.status === 'archived';
  const saving = createContract.isPending || updateContract.isPending;

  function openCreateForm() {
    setEditing(null);
    setForm(EMPTY_CONTRACT);
    setFormOpen(true);
  }

  function openEditForm(contract: ShippingContract) {
    setEditing(contract);
    setForm({
      name: contract.name,
      start_date: contract.start_date ?? '',
      end_date: contract.end_date ?? '',
      payment_terms: contract.payment_terms ?? '',
      notes: contract.notes ?? '',
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: 'Contract name is required.', variant: 'destructive' });
      return;
    }
    const payload: ShippingContractPayload = {
      name: form.name.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      payment_terms: form.payment_terms.trim() || null,
      notes: form.notes.trim() || null,
    };
    try {
      if (editing) {
        await updateContract.mutateAsync({ companyId: company.id, contractId: editing.id, payload });
        toast({ title: 'Contract updated.' });
      } else {
        await createContract.mutateAsync({ companyId: company.id, payload });
        toast({ title: 'Contract added.' });
      }
      setFormOpen(false);
    } catch (err) {
      toast({ title: apiErrorMessage(err, 'Saving the contract failed.'), variant: 'destructive' });
    }
  }

  async function handleActivate(contract: ShippingContract) {
    try {
      await activateContract.mutateAsync({ companyId: company.id, contractId: contract.id });
      toast({ title: `"${contract.name}" is now the active contract.` });
    } catch (err) {
      toast({ title: apiErrorMessage(err, 'Activation failed.'), variant: 'destructive' });
    }
  }

  async function handleDeactivate(contract: ShippingContract) {
    try {
      await updateContract.mutateAsync({
        companyId: company.id,
        contractId: contract.id,
        payload: { status: 'inactive' },
      });
      toast({ title: `Contract "${contract.name}" archived (inactive).` });
    } catch (err) {
      toast({ title: apiErrorMessage(err, 'Deactivation failed.'), variant: 'destructive' });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteContract.mutateAsync({ companyId: company.id, contractId: deleteTarget.id });
      toast({ title: `Contract "${deleteTarget.name}" deleted.` });
    } catch (err) {
      toast({ title: apiErrorMessage(err, 'Delete failed.'), variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      {isArchived && (
        <Alert>
          <AlertDescription className="text-sm">
            This company is archived — new contracts cannot be added.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {contracts.length} contract{contracts.length !== 1 ? 's' : ''} — one may be active at a time.
        </p>
        {!formOpen && (
          <Button size="sm" className="gap-1.5" onClick={openCreateForm} disabled={isArchived}>
            <Plus className="size-3.5" />
            Add Contract
          </Button>
        )}
      </div>

      {formOpen && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-semibold">{editing ? 'Edit Contract' : 'New Contract'}</p>
          <div className="space-y-1.5">
            <Label htmlFor="ct-name">Contract Name *</Label>
            <Input
              id="ct-name"
              value={form.name}
              placeholder="e.g. 2026 Master Agreement"
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ct-start">Start Date</Label>
              <Input
                id="ct-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ct-end">End Date</Label>
              <Input
                id="ct-end"
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-terms">Payment Terms</Label>
            <Input
              id="ct-terms"
              value={form.payment_terms}
              placeholder="e.g. Net 30, COD weekly settlement"
              onChange={(e) => setForm((p) => ({ ...p, payment_terms: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ct-notes">Notes</Label>
            <Textarea
              id="ct-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {editing ? 'Save Changes' : 'Add Contract'}
            </Button>
          </div>
        </div>
      )}

      {contracts.length === 0 && !formOpen ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-center">
          <FileText className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">No contracts yet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Add the commercial agreement terms for this carrier.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className={`rounded-lg border p-3 transition-colors ${
                contract.status === 'active' ? 'border-emerald-500/40 bg-emerald-500/5' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{contract.name}</p>
                    {contract.status === 'active' && (
                      <Badge className="gap-1 bg-emerald-600 text-xs hover:bg-emerald-600">
                        <CheckCircle className="size-3" />
                        Active
                      </Badge>
                    )}
                    {contract.is_expired && (
                      <Badge variant="destructive" className="text-xs">Expired</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {contract.start_date ?? '—'} → {contract.end_date ?? 'open-ended'}
                    {contract.payment_terms ? ` · ${contract.payment_terms}` : ''}
                  </p>
                  {contract.notes && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{contract.notes}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {contract.status !== 'active' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => handleActivate(contract)}
                      disabled={activateContract.isPending}
                    >
                      <CheckCircle className="size-3" />
                      Activate
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => handleDeactivate(contract)}
                      disabled={updateContract.isPending}
                    >
                      <XCircle className="size-3" />
                      Deactivate
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => openEditForm(contract)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(contract)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contract</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Company Mapping Tab ────────────────────────────────────────────────────────

function CompanyMappingTab({ company }: { company: ShippingCompany }) {
  const { toast } = useToast();
  const createMapping = useCreateShippingMapping();
  const deleteMapping = useDeleteShippingMapping();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const isArchived = company.status === 'archived';
  const mappings = useMemo(() => company.mappings ?? [], [company.mappings]);

  const { data: ecosCompanies, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', 'for-shipping-mapping'],
    queryFn: () => companiesService.list({ per_page: 100, status: 'active' }),
    staleTime: 60_000,
  });

  const mappedIds = useMemo(() => new Set(mappings.map((m) => m.company_id)), [mappings]);
  const available = (ecosCompanies?.items ?? []).filter((c) => !mappedIds.has(c.id));

  async function handleLink() {
    if (!selectedCompanyId) return;
    try {
      await createMapping.mutateAsync({ companyId: company.id, ecosCompanyId: selectedCompanyId });
      setSelectedCompanyId('');
      toast({ title: 'Company linked.' });
    } catch (err) {
      toast({ title: apiErrorMessage(err, 'Linking failed.'), variant: 'destructive' });
    }
  }

  async function handleUnlink(mappingId: number, name: string | null | undefined) {
    try {
      await deleteMapping.mutateAsync({ companyId: company.id, mappingId });
      toast({ title: `${name ?? 'Company'} unlinked.` });
    } catch (err) {
      toast({ title: apiErrorMessage(err, 'Unlinking failed.'), variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Link this carrier to the ECOS companies it ships for. Orders from a linked company can be
        assigned to this carrier.
      </p>

      {isArchived ? (
        <Alert>
          <AlertDescription className="text-sm">
            This company is archived — new company links cannot be added.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Label>ECOS Company</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger disabled={companiesLoading || available.length === 0}>
                <SelectValue
                  placeholder={
                    companiesLoading
                      ? 'Loading companies…'
                      : available.length === 0
                        ? 'All companies are already linked'
                        : 'Select a company to link'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {available.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="gap-1.5"
            onClick={handleLink}
            disabled={!selectedCompanyId || createMapping.isPending}
          >
            {createMapping.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            Link
          </Button>
        </div>
      )}

      {mappings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-center">
          <Building2 className="mb-2 size-8 text-muted-foreground/30" />
          <p className="text-sm font-medium">No linked companies</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This carrier is not yet assigned to any ECOS company.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {mappings.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2.5">
                <Building2 className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{m.company_name ?? m.company_id}</p>
                  {m.company_code && (
                    <p className="font-mono text-xs text-muted-foreground">{m.company_code}</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                onClick={() => handleUnlink(m.id, m.company_name)}
                disabled={deleteMapping.isPending}
              >
                <Trash2 className="size-3" />
                Unlink
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Drawer ────────────────────────────────────────────────────────────────

export function ShippingCompanyDrawer({
  open,
  onOpenChange,
  editCompany,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCompany: ShippingCompany | null;
}) {
  const { toast } = useToast();
  const isCreate = editCompany === null;

  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM);
  const [tab, setTab] = useState('details');
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  const { data: detail, isLoading: detailLoading } = useShippingCompany(
    open && editCompany ? editCompany.id : null,
  );
  const { data: nextCode } = useNextShippingCompanyCode(open && isCreate);

  const createCompany = useCreateShippingCompany();
  const updateCompany = useUpdateShippingCompany();
  const setStatus = useSetShippingCompanyStatus();

  const company = detail ?? editCompany;
  const saving = createCompany.isPending || updateCompany.isPending;

  // Hydrate form when the drawer opens or the loaded record changes.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab('details');
    if (editCompany === null) {
      setForm(EMPTY_FORM);
    } else {
      const src = detail ?? editCompany;
      setForm({
        name: src.name,
        code: src.code,
        type: src.type,
        contact_person: src.contact_person ?? '',
        phone: src.phone ?? '',
        email: src.email ?? '',
        address: src.address ?? '',
        notes: src.notes ?? '',
        is_active: src.status === 'active',
      });
    }
  }, [open, editCompany, detail]);

  // Suggest next code for new companies.
  useEffect(() => {
    if (open && isCreate && nextCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((p) => (p.code === '' ? { ...p, code: nextCode } : p));
    }
  }, [open, isCreate, nextCode]);

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: 'Name and Code are required.', variant: 'destructive' });
      return;
    }
    try {
      if (isCreate) {
        await createCompany.mutateAsync(toPayload(form, true));
        toast({ title: `Shipping company "${form.name}" created.` });
        onOpenChange(false);
      } else {
        await updateCompany.mutateAsync({ id: editCompany.id, payload: toPayload(form, false) });
        toast({ title: 'Changes saved.' });
      }
    } catch (err) {
      toast({ title: apiErrorMessage(err, 'Saving failed.'), variant: 'destructive' });
    }
  }

  async function handleSetStatus(status: 'active' | 'inactive' | 'archived') {
    if (!editCompany) return;
    try {
      await setStatus.mutateAsync({ id: editCompany.id, status });
      toast({
        title:
          status === 'archived'
            ? 'Company archived.'
            : status === 'active'
              ? 'Company activated.'
              : 'Company deactivated.',
      });
      if (status === 'archived') setArchiveConfirm(false);
    } catch (err) {
      toast({ title: apiErrorMessage(err, 'Status change failed.'), variant: 'destructive' });
    }
  }

  const statusBadge =
    company &&
    (company.status === 'active' ? (
      <Badge className="bg-emerald-600 text-xs hover:bg-emerald-600">Active</Badge>
    ) : company.status === 'inactive' ? (
      <Badge variant="secondary" className="text-xs">Inactive</Badge>
    ) : (
      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
        <Archive className="size-3" />
        Archived
      </Badge>
    ));

  return (
    <>
      <PageDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={isCreate ? 'New Shipping Company' : (company?.name ?? 'Shipping Company')}
        description={
          isCreate
            ? 'Register an internal fleet or external shipping provider.'
            : `${company?.code ?? ''} — manage details, contracts and company links.`
        }
        size="xl"
      >
        <div className="flex h-full flex-col">
          {!isCreate && (
            <div className="mb-3 flex items-center gap-2">
              {statusBadge}
              {company && <TypeBadge type={company.type} />}
            </div>
          )}

          {isCreate ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <CompanyFormFields form={form} setForm={setForm} isCreate disabled={saving} />
              </div>
              <Separator className="my-4" />
              <div className="flex shrink-0 justify-end gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Create Company
                </Button>
              </div>
            </>
          ) : detailLoading && !company ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="grid w-full shrink-0 grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="contracts" className="gap-1.5">
                  Contracts
                  {company?.contracts_count != null && company.contracts_count > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {company.contracts_count}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="companies" className="gap-1.5">
                  Companies
                  {company?.companies_count != null && company.companies_count > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {company.companies_count}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto pt-4 pr-1">
                <TabsContent value="details" className="mt-0 space-y-4">
                  <CompanyFormFields
                    form={form}
                    setForm={setForm}
                    isCreate={false}
                    disabled={saving || company?.status === 'archived'}
                  />

                  <Separator />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {company?.status === 'archived' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleSetStatus('inactive')}
                          disabled={setStatus.isPending}
                        >
                          <ArchiveRestore className="size-3.5" />
                          Restore from Archive
                        </Button>
                      ) : (
                        <>
                          {company?.status === 'active' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => handleSetStatus('inactive')}
                              disabled={setStatus.isPending}
                            >
                              <XCircle className="size-3.5" />
                              Deactivate
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
                              Activate
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
                            Archive
                          </Button>
                        </>
                      )}
                    </div>
                    {company?.status !== 'archived' && (
                      <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                        {saving && <Loader2 className="size-4 animate-spin" />}
                        Save Changes
                      </Button>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="contracts" className="mt-0">
                  {company && <ContractsTab company={company} />}
                </TabsContent>

                <TabsContent value="companies" className="mt-0">
                  {company && <CompanyMappingTab company={company} />}
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </PageDrawer>

      <AlertDialog open={archiveConfirm} onOpenChange={setArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Shipping Company</AlertDialogTitle>
            <AlertDialogDescription>
              Archive <strong>{company?.name}</strong>? Archived companies are hidden from the
              default list and cannot receive new contracts or company links. You can restore it
              later.
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
