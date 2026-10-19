import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, FileText, GitMerge, Plus, ShoppingCart, Truck } from 'lucide-react';

import { PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ds/use-toast';
import { useWarehouseOptions } from '@/features/products/hooks/use-warehouse-options';
import { CompanySelect } from '@/features/branches/components/company-select';

import { PurchaseMaterialStatusBadge } from '../components/purchase-material-status-badge';
import { PurchaseMaterialPriorityBadge } from '../components/purchase-material-priority-badge';
import { CreatePurchaseMaterialWizard } from '../components/create-purchase-material-wizard';
import { PurchaseMaterialDrawer } from '../components/purchase-material-drawer';
import {
  useDeletePurchaseMaterial,
  usePurchaseMaterialsQuery,
  usePurchaseMaterialStats,
} from '../hooks/use-purchase-materials';
import type {
  PurchaseMaterial,
  PurchaseMaterialPriority,
  PurchaseMaterialStatus,
  PurchaseSourceType,
} from '../types/purchase-material';

// ── Source class map (non-translatable styling) ───────────────────────────────

const SOURCE_CLASS_MAP: Record<PurchaseSourceType, string> = {
  material_request: 'bg-blue-50 text-blue-700 border-blue-200',
  direct:           'bg-slate-50 text-slate-700 border-slate-200',
  reorder:          'bg-violet-50 text-violet-700 border-violet-200',
  ai:               'bg-amber-50 text-amber-700 border-amber-200',
  manual:           'bg-gray-50 text-gray-600 border-gray-200',
};

function SourceBadge({ source }: { source: PurchaseSourceType | null }) {
  const { t } = useTranslation('purchase-materials');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  if (!source) return <span className="text-muted-foreground text-xs">—</span>;
  const className = SOURCE_CLASS_MAP[source];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {tAny(`purchasesPage.sourceSelector.sources.${source}.label`)}
    </span>
  );
}

// ── Source selector dialog ────────────────────────────────────────────────────

type SourceOption = {
  sourceType: PurchaseSourceType;
  icon: React.ReactNode;
  title: string;
  description: string;
};

function SourceSelectorDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sourceType: PurchaseSourceType) => void;
}) {
  const { t } = useTranslation('purchase-materials');

  const SOURCE_OPTIONS: SourceOption[] = [
    {
      sourceType: 'material_request',
      icon: <FileText className="h-5 w-5" />,
      title: t($ => $.purchasesPage.sourceSelector.sources.material_request.title),
      description: t($ => $.purchasesPage.sourceSelector.sources.material_request.description),
    },
    {
      sourceType: 'direct',
      icon: <ShoppingCart className="h-5 w-5" />,
      title: t($ => $.purchasesPage.sourceSelector.sources.direct.title),
      description: t($ => $.purchasesPage.sourceSelector.sources.direct.description),
    },
    {
      sourceType: 'reorder',
      icon: <GitMerge className="h-5 w-5" />,
      title: t($ => $.purchasesPage.sourceSelector.sources.reorder.title),
      description: t($ => $.purchasesPage.sourceSelector.sources.reorder.description),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t($ => $.purchasesPage.sourceSelector.title)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 pt-1">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.sourceType}
              onClick={() => onSelect(opt.sourceType)}
              className="flex w-full items-center gap-4 rounded-lg border bg-background p-4 text-start transition-colors hover:border-primary/50 hover:bg-accent"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                {opt.icon}
              </span>
              <div className="flex-1">
                <div className="font-medium text-sm">{opt.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{opt.description}</div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(d));
}

function fmtCurrency(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const PER_PAGE = 15;

// ── Main page ─────────────────────────────────────────────────────────────────

export function PurchasesPage() {
  const { t } = useTranslation('purchase-materials');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const [statusFilter, setStatusFilter] = useState<PurchaseMaterialStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<PurchaseMaterialPriority | 'all'>('all');
  const [search, setSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sourceSelectorOpen, setSourceSelectorOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pendingSourceType, setPendingSourceType] = useState<PurchaseSourceType>('direct');

  const STATUS_CHIPS: Array<{ value: PurchaseMaterialStatus | 'all'; label: string }> = [
    { value: 'all', label: t($ => $.purchasesPage.statusChips.all) },
    { value: 'draft', label: t($ => $.purchasesPage.statusChips.draft) },
    { value: 'under_review', label: t($ => $.purchasesPage.statusChips.under_review) },
    { value: 'waiting_supplier_selection', label: t($ => $.purchasesPage.statusChips.waiting_supplier_selection) },
    { value: 'approved', label: t($ => $.purchasesPage.statusChips.approved) },
    { value: 'purchasing', label: t($ => $.purchasesPage.statusChips.purchasing) },
    { value: 'receiving', label: t($ => $.purchasesPage.statusChips.receiving) },
    { value: 'completed', label: t($ => $.purchasesPage.statusChips.completed) },
    { value: 'on_hold', label: t($ => $.purchasesPage.statusChips.on_hold) },
    { value: 'rejected', label: t($ => $.purchasesPage.statusChips.rejected) },
    { value: 'cancelled', label: t($ => $.purchasesPage.statusChips.cancelled) },
  ];

  const { data: warehouseOptions } = useWarehouseOptions();

  const params = useMemo(
    () => ({
      record_type: 'purchase' as const,
      status: statusFilter === 'all' ? undefined : statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      search: search || undefined,
      warehouse_id: warehouseFilter || undefined,
      company_id: companyFilter || undefined,
      assigned_buyer: buyerFilter || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      per_page: PER_PAGE,
      page,
    }),
    [statusFilter, priorityFilter, search, warehouseFilter, companyFilter, buyerFilter, dateFrom, dateTo, page],
  );

  const { data, isLoading, isFetching } = usePurchaseMaterialsQuery(params);
  const { data: stats } = usePurchaseMaterialStats({
    company_id: companyFilter || undefined,
    warehouse_id: warehouseFilter || undefined,
  });
  const deleteMutation = useDeletePurchaseMaterial();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setSearch('');
    setWarehouseFilter('');
    setCompanyFilter('');
    setBuyerFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  function openDrawer(purchase: PurchaseMaterial) {
    setSelectedId(purchase.id);
    setDrawerOpen(true);
  }

  async function handleDelete(purchase: PurchaseMaterial, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(tAny('purchasesPage.delete.confirm', { number: purchase.request_number }))) return;
    try {
      await deleteMutation.mutateAsync(purchase.id);
      toast.success(t($ => $.purchasesPage.toast.deleted));
    } catch {
      toast.error(t($ => $.purchasesPage.toast.deleteFailed));
    }
  }

  function handleSourceSelected(sourceType: PurchaseSourceType) {
    setSourceSelectorOpen(false);
    setPendingSourceType(sourceType);
    setWizardOpen(true);
  }

  const op = stats?.operational;
  const fin = stats?.financial;

  const opKpis: Array<{ id: string; label: string; value: number; color: string; status: PurchaseMaterialStatus }> = [
    { id: 'draft', label: t($ => $.purchasesPage.kpis.draft), value: op?.draft ?? 0, color: 'text-slate-700', status: 'draft' },
    { id: 'underReview', label: t($ => $.purchasesPage.kpis.underReview), value: op?.under_review ?? 0, color: 'text-blue-700', status: 'under_review' },
    { id: 'awaitingSupplier', label: t($ => $.purchasesPage.kpis.awaitingSupplier), value: op?.waiting_supplier_selection ?? 0, color: 'text-violet-700', status: 'waiting_supplier_selection' },
    { id: 'approved', label: t($ => $.purchasesPage.kpis.approved), value: op?.approved ?? 0, color: 'text-emerald-700', status: 'approved' },
    { id: 'purchasing', label: t($ => $.purchasesPage.kpis.purchasing), value: op?.purchasing ?? 0, color: 'text-cyan-700', status: 'purchasing' },
    { id: 'receiving', label: t($ => $.purchasesPage.kpis.receiving), value: op?.receiving ?? 0, color: 'text-teal-700', status: 'receiving' },
  ];

  const finKpis: Array<{ id: string; label: string; value: number; color: string }> = [
    { id: 'totalRequested', label: t($ => $.purchasesPage.kpis.totalRequested), value: fin?.total_estimated_value ?? 0, color: 'text-slate-700' },
    { id: 'approvedValue', label: t($ => $.purchasesPage.kpis.approvedValue), value: fin?.total_approved_value ?? 0, color: 'text-emerald-700' },
    { id: 'purchasedValue', label: t($ => $.purchasesPage.kpis.purchasedValue), value: fin?.total_purchased_value ?? 0, color: 'text-cyan-700' },
    { id: 'outstanding', label: t($ => $.purchasesPage.kpis.outstanding), value: fin?.outstanding_value ?? 0, color: 'text-amber-700' },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={t($ => $.purchasesPage.title)}
        subtitle={t($ => $.purchasesPage.subtitle)}
        actions={
          <Button onClick={() => setSourceSelectorOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            {t($ => $.purchasesPage.newPurchase)}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto px-6 pb-6 flex flex-col gap-4">
        {/* ── KPI Cards ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t($ => $.purchasesPage.operations)}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {opKpis.map(({ id, label, value, color, status }) => (
                <Card
                  key={id}
                  className="border shadow-none cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => { setStatusFilter(status); setPage(1); }}
                >
                  <CardContent className="pt-3 pb-2.5 px-3">
                    <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                    <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t($ => $.purchasesPage.financial)}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {finKpis.map(({ id, label, value, color }) => (
                <Card key={id} className="border shadow-none">
                  <CardContent className="pt-3 pb-2.5 px-3">
                    <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                    <p className={`text-xl font-bold tabular-nums ${color}`}>{fmtCurrency(value)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* ── Smart Toolbar ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_CHIPS.map((sf) => (
              <button
                key={sf.value}
                onClick={() => { setStatusFilter(sf.value); setPage(1); }}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors border ${
                  statusFilter === sf.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {sf.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Input
              className="w-48 h-8 text-sm"
              placeholder={t($ => $.purchasesPage.filters.search)}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />

            <div className="w-44">
              <CompanySelect
                value={companyFilter || null}
                onChange={(v) => { setCompanyFilter(v ?? ''); setPage(1); }}
              />
            </div>

            <select
              value={warehouseFilter}
              onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
              className="h-8 w-44 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">{t($ => $.purchasesPage.filters.allWarehouses)}</option>
              {(warehouseOptions ?? []).map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value as PurchaseMaterialPriority | 'all'); setPage(1); }}
              className="h-8 w-32 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">{t($ => $.purchasesPage.filters.allPriorities)}</option>
              <option value="urgent">{t($ => $.purchasesPage.priority.urgent)}</option>
              <option value="high">{t($ => $.purchasesPage.priority.high)}</option>
              <option value="normal">{t($ => $.purchasesPage.priority.normal)}</option>
              <option value="low">{t($ => $.purchasesPage.priority.low)}</option>
            </select>

            <Input
              className="h-8 w-36 text-sm"
              placeholder={t($ => $.purchasesPage.filters.buyer)}
              value={buyerFilter}
              onChange={(e) => { setBuyerFilter(e.target.value); setPage(1); }}
            />

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{t($ => $.purchasesPage.filters.requiredBy)}</span>
              <Input type="date" className="h-8 w-36 text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              <span>→</span>
              <Input type="date" className="h-8 w-36 text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            </div>

            {(search || statusFilter !== 'all' || priorityFilter !== 'all' || warehouseFilter || companyFilter || buyerFilter || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
                {t($ => $.purchasesPage.filters.clearFilters)}
              </Button>
            )}
          </div>
        </div>

        {/* ── Data Grid ─────────────────────────────────────────────── */}
        <div className="rounded-lg border overflow-hidden">
          <div className={`transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.requestNo)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.source)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.company)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.warehouse)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.buyer)}</th>
                    <th className="px-3 py-3 text-center font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.items)}</th>
                    <th className="px-3 py-3 text-end font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.estValue)}</th>
                    <th className="px-3 py-3 text-end font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.approvedValue)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.priority)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.requiredBy)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.status)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.purchasesPage.columns.lastUpdated)}</th>
                    <th className="px-3 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        {t($ => $.purchasesPage.loading)}
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-12 text-center">
                        <Truck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                          {search || statusFilter !== 'all'
                            ? t($ => $.purchasesPage.empty.noMatch)
                            : t($ => $.purchasesPage.empty.none)}
                        </p>
                        {!search && statusFilter === 'all' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t($ => $.purchasesPage.empty.createHint)}
                          </p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    items.map((purchase) => (
                      <tr
                        key={purchase.id}
                        className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => openDrawer(purchase)}
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-mono font-medium text-xs">{purchase.request_number}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <SourceBadge source={purchase.source_type} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">
                          {purchase.company?.name ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {purchase.warehouse?.name ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">
                          {purchase.assigned_buyer ?? '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums">
                          {purchase.items_count}
                        </td>
                        <td className="px-3 py-2.5 text-end font-mono text-xs tabular-nums">
                          {purchase.estimated_value > 0 ? fmtCurrency(purchase.estimated_value) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-end font-mono text-xs tabular-nums">
                          {purchase.approved_value > 0 ? fmtCurrency(purchase.approved_value) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <PurchaseMaterialPriorityBadge priority={purchase.priority} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">
                          {fmtDate(purchase.required_date)}
                        </td>
                        <td className="px-3 py-2.5">
                          <PurchaseMaterialStatusBadge status={purchase.status} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">
                          {fmtDate(purchase.updated_at)}
                        </td>
                        <td className="px-3 py-2.5 text-end">
                          {purchase.status === 'draft' && (
                            <button
                              type="button"
                              onClick={(e) => void handleDelete(purchase, e)}
                              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                            >
                              {t($ => $.purchasesPage.delete.button)}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pagination */}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{tAny('purchasesPage.pagination.total', { count: meta.total })}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t($ => $.purchasesPage.pagination.previous)}
              </Button>
              <span>{tAny('purchasesPage.pagination.page', { current: meta.current_page, last: meta.last_page })}</span>
              <Button size="sm" variant="outline" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
                {t($ => $.purchasesPage.pagination.next)}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Source selector dialog */}
      <SourceSelectorDialog
        open={sourceSelectorOpen}
        onOpenChange={setSourceSelectorOpen}
        onSelect={handleSourceSelected}
      />

      {/* Wizard */}
      <CreatePurchaseMaterialWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        recordType="purchase"
        sourceType={pendingSourceType}
      />

      {/* Detail drawer */}
      <PurchaseMaterialDrawer
        id={selectedId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
