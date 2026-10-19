import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2, Minus, PackageSearch, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { CompanySelect } from '@/features/branches/components/company-select';
import { warehousesService } from '@/features/warehouses/services/warehouses-service';
import { productsService } from '@/features/products/services/products-service';
import { toast } from '@/components/ds/use-toast';
import { useCreatePurchaseMaterial } from '../hooks/use-purchase-materials';
import { EnterpriseDemandPanel } from './enterprise-demand-panel';
import type { PurchaseMaterialLinePayload, PurchaseMaterialPriority } from '../types/purchase-material';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordType?: 'material_request' | 'purchase';
  sourceType?: 'material_request' | 'direct' | 'reorder' | 'ai' | 'manual' | null;
};

type LineItem = PurchaseMaterialLinePayload & {
  _name: string;
  _sku: string;
};

const TOTAL_STEPS = 3;

export function CreatePurchaseMaterialWizard({ open, onOpenChange, recordType = 'material_request', sourceType }: Props) {
  const { t } = useTranslation('purchase-materials');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const PRIORITY_OPTIONS: Array<{ value: PurchaseMaterialPriority; label: string }> = [
    { value: 'low', label: t($ => $.wizard.priority.low) },
    { value: 'normal', label: t($ => $.wizard.priority.normal) },
    { value: 'high', label: t($ => $.wizard.priority.high) },
    { value: 'urgent', label: t($ => $.wizard.priority.urgent) },
  ];

  const [step, setStep] = useState(1);

  // Step 1 fields
  const [companyId, setCompanyId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [priority, setPriority] = useState<PurchaseMaterialPriority>('normal');
  const [requiredDate, setRequiredDate] = useState('');
  const [notes, setNotes] = useState('');

  // Step 2 fields
  const [productSearch, setProductSearch] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [focusedProductId, setFocusedProductId] = useState<string | null>(null);

  const create = useCreatePurchaseMaterial();

  const { data: warehousesData, isLoading: wLoading } = useQuery({
    queryKey: ['warehouses-for-pm', companyId],
    queryFn: () => warehousesService.list({ company_id: companyId || undefined, status: 'active', per_page: 100 }),
    staleTime: 60_000,
  });

  const { data: productsData, isLoading: pLoading } = useQuery({
    queryKey: ['products-for-pm-wizard', productSearch],
    queryFn: () => productsService.list({ search: productSearch || undefined, per_page: 20 }),
    staleTime: 30_000,
    enabled: step === 2,
  });

  const warehouses = warehousesData?.items ?? [];
  const products = productsData?.items ?? [];

  // For demand panel: use the focused product if set, else the last added line
  const panelProductId = focusedProductId ?? lines.at(-1)?.product_id ?? null;
  const panelRequestedQty = lines.find((l) => l.product_id === panelProductId)?.requested_qty;

  function handleClose() {
    setStep(1);
    setCompanyId('');
    setChannelId('');
    setWarehouseId('');
    setPriority('normal');
    setRequiredDate('');
    setNotes('');
    setProductSearch('');
    setLines([]);
    setFocusedProductId(null);
    onOpenChange(false);
  }

  function addProduct(product: { id: string; name: string; sku: string }) {
    if (lines.find((l) => l.product_id === product.id)) {
      setFocusedProductId(product.id);
      return;
    }
    setLines((prev) => [
      ...prev,
      { product_id: product.id, requested_qty: 1, unit_label: null, notes: null, _name: product.name, _sku: product.sku },
    ]);
    setFocusedProductId(product.id);
  }

  function updateQty(productId: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.product_id === productId ? { ...l, requested_qty: Math.max(0.0001, qty) } : l)));
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.product_id !== productId));
    if (focusedProductId === productId) setFocusedProductId(null);
  }

  async function handleSubmit() {
    if (!warehouseId || lines.length === 0) return;
    try {
      await create.mutateAsync({
        warehouse_id: warehouseId,
        company_id: companyId || null,
        channel_id: channelId || null,
        priority,
        required_date: requiredDate || null,
        notes: notes || null,
        record_type: recordType,
        source_type: sourceType ?? null,
        lines: lines.map(({ product_id, requested_qty, unit_label, notes: ln }) => ({
          product_id,
          requested_qty,
          unit_label,
          notes: ln,
        })),
      });
      toast.success(t($ => $.wizard.toast.success));
      handleClose();
    } catch {
      toast.error(t($ => $.wizard.toast.failed));
    }
  }

  const canProceedStep1 = !!warehouseId;
  const canProceedStep2 = lines.length > 0;

  const stepName =
    step === 1
      ? t($ => $.wizard.steps.generalInfo)
      : step === 2
        ? t($ => $.wizard.steps.requestedMaterials)
        : t($ => $.wizard.steps.reviewSubmit);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t($ => $.wizard.title)}</DialogTitle>
          <DialogDescription>
            {tAny('wizard.stepOf', { step, total: TOTAL_STEPS })} {stepName}
          </DialogDescription>
        </DialogHeader>

        {/* Step progress bar */}
        <div className="flex gap-1 px-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i + 1 <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {/* ── Step 1: General Information ─────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4 px-1 overflow-y-auto max-h-[60vh] py-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">{t($ => $.wizard.step1.company)}</label>
                  <CompanySelect
                    value={companyId || null}
                    onChange={(v) => { setCompanyId(v ?? ''); setWarehouseId(''); }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">{t($ => $.wizard.step1.channel)}</label>
                  <Input
                    placeholder={t($ => $.wizard.step1.channelPlaceholder)}
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  {t($ => $.wizard.step1.warehouse)} <span className="text-destructive">*</span>
                </label>
                {wLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> {t($ => $.wizard.step1.loadingWarehouses)}
                  </div>
                ) : (
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">{t($ => $.wizard.step1.selectWarehouse)}</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">{t($ => $.wizard.step1.priority)}</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PurchaseMaterialPriority)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">{t($ => $.wizard.step1.requiredBy)}</label>
                  <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t($ => $.wizard.step1.notes)}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={t($ => $.wizard.step1.notesPlaceholder)}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Step 2: Requested Materials + Demand Panel ──────────── */}
          {step === 2 && (
            <div className="flex gap-4 h-full max-h-[60vh]">
              {/* Left: product picker + selected lines */}
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">{t($ => $.wizard.step2.searchProducts)}</label>
                  <div className="relative">
                    <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder={t($ => $.wizard.step2.searchPlaceholder)}
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Search results */}
                <div className="border rounded-md overflow-hidden">
                  {pLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> {t($ => $.wizard.step2.searching)}
                    </div>
                  ) : products.length === 0 ? (
                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                      {t($ => $.wizard.step2.noProducts)}
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {products.map((p) => {
                          const added = lines.some((l) => l.product_id === p.id);
                          const focused = focusedProductId === p.id;
                          return (
                            <tr
                              key={p.id}
                              className={`border-b last:border-0 transition-colors cursor-pointer ${focused ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                              onClick={() => setFocusedProductId(p.id)}
                            >
                              <td className="px-3 py-2">
                                <p className="font-medium leading-tight">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.sku}</p>
                              </td>
                              <td className="px-3 py-2 text-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={added ? 'outline' : 'default'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    added ? removeLine(p.id) : addProduct({ id: p.id, name: p.name, sku: p.sku });
                                  }}
                                >
                                  {added ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                                  {added ? t($ => $.wizard.step2.remove) : t($ => $.wizard.step2.add)}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Selected lines */}
                {lines.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {tAny('wizard.step2.selected', { count: lines.length })}
                    </p>
                    <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="px-3 py-1.5 text-start font-medium text-xs text-muted-foreground">{t($ => $.wizard.step2.material)}</th>
                            <th className="px-3 py-1.5 text-center font-medium text-xs text-muted-foreground w-24">{t($ => $.wizard.step2.qty)}</th>
                            <th className="px-3 py-1.5 w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line) => (
                            <tr
                              key={line.product_id}
                              className={`border-t cursor-pointer transition-colors ${focusedProductId === line.product_id ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                              onClick={() => setFocusedProductId(line.product_id)}
                            >
                              <td className="px-3 py-1.5">
                                <p className="font-medium leading-tight text-sm">{line._name}</p>
                                <p className="text-xs text-muted-foreground">{line._sku}</p>
                              </td>
                              <td className="px-3 py-1.5">
                                <Input
                                  type="number"
                                  min={0.0001}
                                  step={0.01}
                                  value={line.requested_qty}
                                  onChange={(e) => updateQty(line.product_id, parseFloat(e.target.value) || 1)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-7 text-center w-full"
                                />
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removeLine(line.product_id); }}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Minus className="size-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {lines.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground border border-dashed rounded-md p-4">
                    <AlertCircle className="size-4 shrink-0" />
                    {t($ => $.wizard.step2.addAtLeastOne)}
                  </div>
                )}
              </div>

              {/* Right: Enterprise Demand Panel */}
              <div className="w-64 shrink-0 border-l pl-4 overflow-y-auto">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {t($ => $.wizard.step2.demandIntelligence)}
                </p>
                <EnterpriseDemandPanel
                  productId={panelProductId}
                  warehouseId={warehouseId}
                  requestedQty={panelRequestedQty}
                  requiredDate={requiredDate || undefined}
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Review ──────────────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col gap-4 px-1 overflow-y-auto max-h-[60vh] py-1">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t($ => $.wizard.step3.warehouse)}</p>
                  <p className="font-medium">{warehouses.find((w) => w.id === warehouseId)?.name ?? warehouseId}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t($ => $.wizard.step3.priority)}</p>
                  <p className="font-medium capitalize">{priority}</p>
                </div>
                {channelId && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t($ => $.wizard.step3.channel)}</p>
                    <p className="font-medium">{channelId}</p>
                  </div>
                )}
                {requiredDate && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t($ => $.wizard.step3.requiredBy)}</p>
                    <p className="font-medium">
                      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(requiredDate))}
                    </p>
                  </div>
                )}
                {notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">{t($ => $.wizard.step3.notes)}</p>
                    <p>{notes}</p>
                  </div>
                )}
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-start font-medium text-xs text-muted-foreground">{t($ => $.wizard.step3.material)}</th>
                      <th className="px-3 py-2 text-end font-medium text-xs text-muted-foreground">{t($ => $.wizard.step3.requestedQty)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.product_id} className="border-t">
                        <td className="px-3 py-2">
                          <p className="font-medium">{line._name}</p>
                          <p className="text-xs text-muted-foreground">{line._sku}</p>
                        </td>
                        <td className="px-3 py-2 text-end font-mono">{line.requested_qty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          {step > 1 && (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              {t($ => $.wizard.buttons.previous)}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={handleClose}>
            {t($ => $.wizard.buttons.cancel)}
          </Button>
          {step < TOTAL_STEPS ? (
            <Button
              type="button"
              disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
              onClick={() => setStep((s) => s + 1)}
            >
              {t($ => $.wizard.buttons.next)}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={create.isPending}
              onClick={() => { void handleSubmit(); }}
            >
              {create.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {t($ => $.wizard.buttons.creating)}
                </>
              ) : t($ => $.wizard.buttons.create)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
