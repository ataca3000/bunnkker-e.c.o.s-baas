import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import type { PurchaseMaterial, PurchaseMaterialPriority, PurchaseMaterialStatus } from '../types/purchase-material';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(d));
}

function fmtCurrency(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const PER_PAGE = 15;

export function PurchaseMaterialsPage() {
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
  const [wizardOpen, setWizardOpen] = useState(false);

  const STATUS_CHIPS: Array<{ value: PurchaseMaterialStatus | 'all'; label: string }> = [
    { value: 'all', label: t($ => $.requestsPage.statusChips.all) },
    { value: 'draft', label: t($ => $.requestsPage.statusChips.draft) },
    { value: 'under_review', label: t($ => $.requestsPage.statusChips.under_review) },
    { value: 'waiting_supplier_selection', label: t($ => $.requestsPage.statusChips.waiting_supplier_selection) },
    { value: 'approved', label: t($ => $.requestsPage.statusChips.approved) },
    { value: 'purchasing', label: t($ => $.requestsPage.statusChips.purchasing) },
    { value: 'receiving', label: t($ => $.requestsPage.statusChips.receiving) },
    { value: 'completed', label: t($ => $.requestsPage.statusChips.completed) },
    { value: 'on_hold', label: t($ => $.requestsPage.statusChips.on_hold) },
    { value: 'rejected', label: t($ => $.requestsPage.statusChips.rejected) },
    { value: 'cancelled', label: t($ => $.requestsPage.statusChips.cancelled) },
  ];

  const { data: warehouseOptions } = useWarehouseOptions();

  const params = useMemo(
    () => ({
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
  const { data: stats } = usePurchaseMaterialStats({ company_id: companyFilter || undefined, warehouse_id: warehouseFilter || undefined });
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

  function openDrawer(material: PurchaseMaterial) {
    setSelectedId(material.id);
    setDrawerOpen(true);
  }

  async function handleDelete(material: PurchaseMaterial, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(tAny('requestsPage.delete.confirm', { number: material.request_number }))) return;
    try {
      await deleteMutation.mutateAsync(material.id);
      toast.success(t($ => $.requestsPage.toast.deleted));
    } catch {
      toast.error(t($ => $.requestsPage.toast.deleteFailed));
    }
  }

  const op = stats?.operational;
  const fin = stats?.financial;

  const opKpis: Array<{ id: string; label: string; value: number; color: string; status: PurchaseMaterialStatus }> = [
    { id: 'draft', label: t($ => $.requestsPage.kpis.draft), value: op?.draft ?? 0, color: 'text-slate-700', status: 'draft' },
    { id: 'underReview', label: t($ => $.requestsPage.kpis.underReview), value: op?.under_review ?? 0, color: 'text-blue-700', status: 'under_review' },
    { id: 'awaitingSupplier', label: t($ => $.requestsPage.kpis.awaitingSupplier), value: op?.waiting_supplier_selection ?? 0, color: 'text-violet-700', status: 'waiting_supplier_selection' },
    { id: 'approved', label: t($ => $.requestsPage.kpis.approved), value: op?.approved ?? 0, color: 'text-emerald-700', status: 'approved' },
    { id: 'purchasing', label: t($ => $.requestsPage.kpis.purchasing), value: op?.purchasing ?? 0, color: 'text-cyan-700', status: 'purchasing' },
    { id: 'receiving', label: t($ => $.requestsPage.kpis.receiving), value: op?.receiving ?? 0, color: 'text-teal-700', status: 'receiving' },
  ];

  const finKpis: Array<{ id: string; label: string; value: number; color: string }> = [
    { id: 'totalRequested', label: t($ => $.requestsPage.kpis.totalRequested), value: fin?.total_estimated_value ?? 0, color: 'text-slate-700' },
    { id: 'approvedValue', label: t($ => $.requestsPage.kpis.approvedValue), value: fin?.total_approved_value ?? 0, color: 'text-emerald-700' },
    { id: 'purchasedValue', label: t($ => $.requestsPage.kpis.purchasedValue), value: fin?.total_purchased_value ?? 0, color: 'text-cyan-700' },
    { id: 'outstanding', label: t($ => $.requestsPage.kpis.outstanding), value: fin?.outstanding_value ?? 0, color: 'text-amber-700' },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={t($ => $.requestsPage.title)}
        subtitle={t($ => $.requestsPage.subtitle)}
        actions={
          <Button onClick={() => setWizardOpen(true)}>{t($ => $.requestsPage.newRequest)}</Button>
        }
      />

      <div className="flex-1 overflow-auto px-6 pb-6 flex flex-col gap-4">
        {/* ── KPI Cards ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {/* Operational group */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t($ => $.requestsPage.operations)}
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

          {/* Financial group */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {t($ => $.requestsPage.financial)}
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
          {/* Status chips row */}
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

          {/* Filter row */}
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              className="w-48 h-8 text-sm"
              placeholder={t($ => $.requestsPage.filters.search)}
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
              <option value="">{t($ => $.requestsPage.filters.allWarehouses)}</option>
              {(warehouseOptions ?? []).map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value as PurchaseMaterialPriority | 'all'); setPage(1); }}
              className="h-8 w-32 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">{t($ => $.requestsPage.filters.allPriorities)}</option>
              <option value="urgent">{t($ => $.requestsPage.priority.urgent)}</option>
              <option value="high">{t($ => $.requestsPage.priority.high)}</option>
              <option value="normal">{t($ => $.requestsPage.priority.normal)}</option>
              <option value="low">{t($ => $.requestsPage.priority.low)}</option>
            </select>

            <Input
              className="h-8 w-36 text-sm"
              placeholder={t($ => $.requestsPage.filters.buyer)}
              value={buyerFilter}
              onChange={(e) => { setBuyerFilter(e.target.value); setPage(1); }}
            />

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{t($ => $.requestsPage.filters.requiredBy)}</span>
              <Input type="date" className="h-8 w-36 text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              <span>→</span>
              <Input type="date" className="h-8 w-36 text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            </div>

            {(search || statusFilter !== 'all' || priorityFilter !== 'all' || warehouseFilter || companyFilter || buyerFilter || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
                {t($ => $.requestsPage.filters.clearFilters)}
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
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.requestNo)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.company)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.channel)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.warehouse)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.requestedBy)}</th>
                    <th className="px-3 py-3 text-center font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.items)}</th>
                    <th className="px-3 py-3 text-end font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.requestedQty)}</th>
                    <th className="px-3 py-3 text-end font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.estValue)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.priority)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.requiredBy)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.status)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.assignedBuyer)}</th>
                    <th className="px-3 py-3 text-start font-medium text-xs text-muted-foreground">{t($ => $.requestsPage.columns.lastUpdated)}</th>
                    <th className="px-3 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        {t($ => $.requestsPage.loading)}
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        {search || statusFilter !== 'all' ? t($ => $.requestsPage.empty.noMatch) : t($ => $.requestsPage.empty.none)}
                      </td>
                    </tr>
                  ) : (
                    items.map((pm) => (
                      <tr
                        key={pm.id}
                        className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => openDrawer(pm)}
                      >
                        <td className="px-3 py-2.5">
                          <span className="font-mono font-medium text-xs">{pm.request_number}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{pm.company?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{pm.channel_id ?? '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{pm.warehouse?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{pm.requested_by ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums">{pm.items_count}</td>
                        <td className="px-3 py-2.5 text-end font-mono text-xs tabular-nums">
                          {pm.total_requested_qty > 0 ? pm.total_requested_qty.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-end font-mono text-xs tabular-nums">
                          {pm.estimated_value > 0 ? fmtCurrency(pm.estimated_value) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <PurchaseMaterialPriorityBadge priority={pm.priority} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{fmtDate(pm.required_date)}</td>
                        <td className="px-3 py-2.5">
                          <PurchaseMaterialStatusBadge status={pm.status} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{pm.assigned_buyer ?? '—'}</td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">{fmtDate(pm.updated_at)}</td>
                        <td className="px-3 py-2.5 text-end">
                          {pm.status === 'draft' && (
                            <button
                              type="button"
                              onClick={(e) => void handleDelete(pm, e)}
                              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                            >
                              {t($ => $.requestsPage.delete.button)}
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
            <span>{tAny('requestsPage.pagination.total', { count: meta.total })}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t($ => $.requestsPage.pagination.previous)}
              </Button>
              <span>{tAny('requestsPage.pagination.page', { current: meta.current_page, last: meta.last_page })}</span>
              <Button size="sm" variant="outline" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
                {t($ => $.requestsPage.pagination.next)}
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreatePurchaseMaterialWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <PurchaseMaterialDrawer id={selectedId} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
