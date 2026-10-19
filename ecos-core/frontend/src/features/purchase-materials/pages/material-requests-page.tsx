import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2, Package, Plus, Search, Trash2, X } from 'lucide-react';

import { PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ds/use-toast';
import { CompanySelect } from '@/features/branches/components/company-select';
import { useWarehouseOptions } from '@/features/products/hooks/use-warehouse-options';
import { useProductsQuery } from '@/features/products/hooks/use-products';
import { useProductProcurementPanel } from '../hooks/use-purchase-materials';
import {
  useCreatePurchaseMaterial,
  usePurchaseMaterialsQuery,
  useSubmitPurchaseMaterial,
} from '../hooks/use-purchase-materials';
import { PurchaseMaterialStatusBadge } from '../components/purchase-material-status-badge';
import { PurchaseMaterialPriorityBadge } from '../components/purchase-material-priority-badge';
import { PurchaseMaterialDrawer } from '../components/purchase-material-drawer';
import type {
  PurchaseMaterialPriority,
  PurchaseMaterialStatus,
} from '../types/purchase-material';

// ── Local form types ──────────────────────────────────────────────────────────

let _lineId = 0;
function newLocalId() {
  return `local-${++_lineId}`;
}

type LocalLine = {
  localId: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  requested_qty: string;
  unit_label: string;
  notes: string;
};

function emptyLine(): LocalLine {
  return {
    localId: newLocalId(),
    product_id: '',
    product_name: '',
    product_sku: '',
    requested_qty: '',
    unit_label: '',
    notes: '',
  };
}

// ── Inline stock hint ─────────────────────────────────────────────────────────

function InlineStockHint({
  productId,
  warehouseId,
}: {
  productId: string;
  warehouseId?: string;
}) {
  const { t } = useTranslation('purchase-materials');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const { data, isLoading } = useProductProcurementPanel(productId || null, {
    warehouse_id: warehouseId,
  });

  if (!productId) return null;
  if (isLoading) return <span className="text-xs text-muted-foreground">{t($ => $.materialRequestsPage.createPanel.loadingHint)}</span>;
  if (!data) return null;

  const available = data.inventory.available_qty;
  const days = data.coverage.days_remaining;
  const risk = data.coverage.risk;

  const riskClass =
    risk === 'critical'
      ? 'text-red-500'
      : risk === 'high'
        ? 'text-amber-500'
        : 'text-muted-foreground';

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{tAny('materialRequestsPage.createPanel.available', { count: available })}</span>
      {days !== null && (
        <span className={riskClass}>
          {risk === 'critical' || risk === 'high' ? '⚠ ' : ''}
          {tAny('materialRequestsPage.createPanel.coverage', { days })}
        </span>
      )}
    </span>
  );
}

// ── Product search combobox (per row) ─────────────────────────────────────────

function ProductSearchInput({
  value,
  onChange,
  onSelect,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (product: { id: string; name: string; sku: string }) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const { t } = useTranslation('purchase-materials');
  const [open, setOpen] = useState(false);
  const { data, isFetching } = useProductsQuery({
    search: value,
    per_page: 8,
  });

  const products = data?.items ?? [];

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        placeholder={t($ => $.materialRequestsPage.createPanel.table.searchProduct)}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-8 text-sm"
      />
      {open && value.length >= 1 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {isFetching && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t($ => $.materialRequestsPage.createPanel.searching)}
            </div>
          )}
          {!isFetching && products.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">{t($ => $.materialRequestsPage.createPanel.noProducts)}</div>
          )}
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-accent"
              onMouseDown={() => {
                onSelect({ id: p.id, name: p.name, sku: p.sku });
                setOpen(false);
              }}
            >
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-6 w-6 rounded object-cover" />
              ) : (
                <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.sku}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create panel ──────────────────────────────────────────────────────────────

function CreateMaterialRequestPanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation('purchase-materials');

  const [companyId, setCompanyId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [priority, setPriority] = useState<PurchaseMaterialPriority>('normal');
  const [requiredDate, setRequiredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LocalLine[]>([emptyLine()]);
  const [submitAfterSave, setSubmitAfterSave] = useState(false);
  const firstProductRef = useRef<HTMLInputElement>(null);

  const { data: warehouseOptions } = useWarehouseOptions();
  const createMutation = useCreatePurchaseMaterial();
  const submitMutation = useSubmitPurchaseMaterial();

  function updateLine(localId: string, patch: Partial<LocalLine>) {
    setLines((prev) => prev.map((l) => (l.localId === localId ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(localId: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.localId !== localId) : prev));
  }

  function handleQtyKeyDown(e: React.KeyboardEvent, lineIndex: number) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (lineIndex === lines.length - 1) {
        addLine();
        // next render will focus the new row — handled by autoFocus on new rows
      }
    }
  }

  async function handleSave(andSubmit: boolean) {
    if (!warehouseId) {
      toast.error(t($ => $.materialRequestsPage.createPanel.toast.warehouseRequired));
      return;
    }
    const validLines = lines.filter((l) => l.product_id && parseFloat(l.requested_qty) > 0);
    if (validLines.length === 0) {
      toast.error(t($ => $.materialRequestsPage.createPanel.toast.addAtLeastOne));
      return;
    }

    try {
      const created = await createMutation.mutateAsync({
        warehouse_id: warehouseId,
        company_id: companyId || null,
        priority,
        required_date: requiredDate || null,
        notes: notes || null,
        record_type: 'material_request',
        lines: validLines.map((l) => ({
          product_id: l.product_id,
          requested_qty: parseFloat(l.requested_qty),
          unit_label: l.unit_label || null,
          notes: l.notes || null,
        })),
      });

      if (andSubmit) {
        await submitMutation.mutateAsync(created.id);
        toast.success(t($ => $.materialRequestsPage.createPanel.toast.createdAndSubmitted));
      } else {
        toast.success(t($ => $.materialRequestsPage.createPanel.toast.savedAsDraft));
      }
      onCreated();
    } catch {
      toast.error(t($ => $.materialRequestsPage.createPanel.toast.failed));
    }
  }

  const isBusy = createMutation.isPending || submitMutation.isPending;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-base font-semibold">{t($ => $.materialRequestsPage.createPanel.title)}</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t($ => $.materialRequestsPage.createPanel.company)}</Label>
            <CompanySelect value={companyId} onChange={setCompanyId} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              {t($ => $.materialRequestsPage.createPanel.warehouseRequired)}
            </Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={t($ => $.materialRequestsPage.createPanel.selectWarehouse)} />
              </SelectTrigger>
              <SelectContent>
                {(warehouseOptions ?? []).map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t($ => $.materialRequestsPage.createPanel.priority)}</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as PurchaseMaterialPriority)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t($ => $.materialRequestsPage.createPanel.priorityOptions.low)}</SelectItem>
                <SelectItem value="normal">{t($ => $.materialRequestsPage.createPanel.priorityOptions.normal)}</SelectItem>
                <SelectItem value="high">{t($ => $.materialRequestsPage.createPanel.priorityOptions.high)}</SelectItem>
                <SelectItem value="urgent">{t($ => $.materialRequestsPage.createPanel.priorityOptions.urgent)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t($ => $.materialRequestsPage.createPanel.requiredDate)}</Label>
            <Input
              type="date"
              className="h-9 text-sm"
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t($ => $.materialRequestsPage.createPanel.notes)}</Label>
          <Textarea
            placeholder={t($ => $.materialRequestsPage.createPanel.notesPlaceholder)}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
          />
        </div>

        {/* Product lines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">{t($ => $.materialRequestsPage.createPanel.products)}</Label>
            <span className="text-xs text-muted-foreground">
              {t($ => $.materialRequestsPage.createPanel.enterKey)}
            </span>
          </div>

          <div className="rounded-md border">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_80px_70px_1fr_28px] gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span>{t($ => $.materialRequestsPage.createPanel.table.product)}</span>
              <span>{t($ => $.materialRequestsPage.createPanel.table.qty)}</span>
              <span>{t($ => $.materialRequestsPage.createPanel.table.unit)}</span>
              <span>{t($ => $.materialRequestsPage.createPanel.table.notes)}</span>
              <span />
            </div>

            {lines.map((line, idx) => (
              <div key={line.localId} className="border-b last:border-0">
                <div className="grid grid-cols-[1fr_80px_70px_1fr_28px] items-center gap-2 px-3 py-2">
                  <ProductSearchInput
                    value={line.product_name}
                    inputRef={idx === 0 ? firstProductRef : undefined}
                    onChange={(v) => updateLine(line.localId, { product_name: v, product_id: '' })}
                    onSelect={(p) =>
                      updateLine(line.localId, {
                        product_id: p.id,
                        product_name: p.name,
                        product_sku: p.sku,
                      })
                    }
                  />
                  <Input
                    type="number"
                    min="0.0001"
                    step="any"
                    placeholder={t($ => $.materialRequestsPage.createPanel.table.qtyPlaceholder)}
                    value={line.requested_qty}
                    onChange={(e) => updateLine(line.localId, { requested_qty: e.target.value })}
                    onKeyDown={(e) => handleQtyKeyDown(e, idx)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder={t($ => $.materialRequestsPage.createPanel.table.unitPlaceholder)}
                    value={line.unit_label}
                    onChange={(e) => updateLine(line.localId, { unit_label: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder={t($ => $.materialRequestsPage.createPanel.table.notesPlaceholder)}
                    value={line.notes}
                    onChange={(e) => updateLine(line.localId, { notes: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLine(line.localId)}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Inline stock hint */}
                {line.product_id && (
                  <div className="px-3 pb-1.5">
                    <InlineStockHint productId={line.product_id} warehouseId={warehouseId} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" />
            {t($ => $.materialRequestsPage.createPanel.addProduct)}
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-3">
        <Button variant="ghost" onClick={onClose} disabled={isBusy}>
          {t($ => $.materialRequestsPage.createPanel.cancel)}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={isBusy}
          >
            {createMutation.isPending && !submitAfterSave ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            {t($ => $.materialRequestsPage.createPanel.saveAsDraft)}
          </Button>
          <Button
            onClick={() => {
              setSubmitAfterSave(true);
              handleSave(true);
            }}
            disabled={isBusy}
          >
            {submitMutation.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            {t($ => $.materialRequestsPage.createPanel.submitToProcurement)}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MaterialRequestsPage() {
  const { t } = useTranslation('purchase-materials');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseMaterialStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const STATUS_CHIPS: Array<{ value: PurchaseMaterialStatus | 'all'; label: string }> = [
    { value: 'all', label: t($ => $.materialRequestsPage.statusChips.all) },
    { value: 'draft', label: t($ => $.materialRequestsPage.statusChips.draft) },
    { value: 'under_review', label: t($ => $.materialRequestsPage.statusChips.under_review) },
    { value: 'on_hold', label: t($ => $.materialRequestsPage.statusChips.on_hold) },
    { value: 'cancelled', label: t($ => $.materialRequestsPage.statusChips.cancelled) },
  ];

  const { data, isLoading } = usePurchaseMaterialsQuery({
    record_type: 'material_request',
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    page,
    per_page: 20,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleCreated = useCallback(() => {
    setShowCreatePanel(false);
  }, []);

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageHeader
          title={t($ => $.materialRequestsPage.title)}
          subtitle={t($ => $.materialRequestsPage.subtitle)}
          actions={
            <Button onClick={() => setShowCreatePanel(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {t($ => $.materialRequestsPage.newRequest)}
            </Button>
          }
        />

        <div className="flex-1 overflow-auto px-6 pb-6 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t($ => $.materialRequestsPage.searchPlaceholder)}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Status chips */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => {
                  setStatusFilter(chip.value);
                  setPage(1);
                }}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  statusFilter === chip.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent',
                ].join(' ')}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t($ => $.materialRequestsPage.columns.requestNo)}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t($ => $.materialRequestsPage.columns.warehouse)}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t($ => $.materialRequestsPage.columns.products)}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t($ => $.materialRequestsPage.columns.priority)}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t($ => $.materialRequestsPage.columns.requiredDate)}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t($ => $.materialRequestsPage.columns.status)}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t($ => $.materialRequestsPage.columns.requestedBy)}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground">
                      {t($ => $.materialRequestsPage.columns.createdAt)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                          </td>
                        ))}
                      </tr>
                    ))}

                  {!isLoading && items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                        <AlertCircle className="mx-auto mb-2 h-6 w-6 opacity-40" />
                        <p className="text-sm">{t($ => $.materialRequestsPage.empty.title)}</p>
                        <p className="text-xs mt-1">
                          {t($ => $.materialRequestsPage.empty.description)}
                        </p>
                      </td>
                    </tr>
                  )}

                  {!isLoading &&
                    items.map((item) => (
                      <tr
                        key={item.id}
                        className="cursor-pointer border-b transition-colors hover:bg-muted/40"
                        onClick={() => setSelectedId(item.id)}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          {item.request_number}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.warehouse?.name ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {tAny('materialRequestsPage.items', { count: item.items_count })}
                        </td>
                        <td className="px-4 py-3">
                          <PurchaseMaterialPriorityBadge priority={item.priority} />
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {item.required_date
                            ? new Date(item.required_date).toLocaleDateString()
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <PurchaseMaterialStatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {item.requested_by ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {item.created_at
                            ? new Date(item.created_at).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {/* Pagination */}
              {meta && meta.last_page > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {tAny('materialRequestsPage.pagination.total', { count: meta.total })}
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      {t($ => $.materialRequestsPage.pagination.previous)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === meta.last_page}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t($ => $.materialRequestsPage.pagination.next)}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create panel */}
      {showCreatePanel && (
        <div className="w-[520px] shrink-0 border-l bg-background">
          <CreateMaterialRequestPanel
            onClose={() => setShowCreatePanel(false)}
            onCreated={handleCreated}
          />
        </div>
      )}

      {/* Detail drawer */}
      <PurchaseMaterialDrawer
        id={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => { if (!open) setSelectedId(null); }}
      />
    </div>
  );
}
