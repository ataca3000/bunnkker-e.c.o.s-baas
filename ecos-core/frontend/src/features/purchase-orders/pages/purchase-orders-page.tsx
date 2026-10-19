import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Eye, Pencil, Plus, SendHorizonal, Trash2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  ActionMenu,
  ConfirmDialog,
  EntityTable,
  EntityToolbar,
  PageHeader,
  Pagination,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PoStatusBadge } from '@/features/purchase-orders/components/po-status-badge';
import {
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
  useDeletePurchaseOrder,
  usePurchaseOrdersQuery,
  useSubmitPurchaseOrder,
} from '@/features/purchase-orders/hooks/use-purchase-orders';
import type {
  PurchaseOrder,
  PurchaseOrderSortField,
  PurchaseOrderStatus,
} from '@/features/purchase-orders/types/purchase-order';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 10;

type StatusFilter = PurchaseOrderStatus | 'all';

export function PurchaseOrdersPage() {
  const { t } = useTranslation('purchase-orders');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: PurchaseOrderSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });

  const [deleting, setDeleting] = useState<PurchaseOrder | null>(null);
  const [submitting, setSubmitting] = useState<PurchaseOrder | null>(null);
  const [approving, setApproving] = useState<PurchaseOrder | null>(null);
  const [cancelling, setCancelling] = useState<PurchaseOrder | null>(null);

  const params = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, statusFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = usePurchaseOrdersQuery(params);
  const deletePO = useDeletePurchaseOrder();
  const submitPO = useSubmitPurchaseOrder();
  const approvePO = useApprovePurchaseOrder();
  const cancelPO = useCancelPurchaseOrder();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSort = (field: string) => {
    setSort((current) =>
      current.field === field
        ? { field: field as PurchaseOrderSortField, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as PurchaseOrderSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      key: 'po_number',
      header: t($ => $.columns.number),
      sortable: true,
      cell: (po) => <span className="font-medium">{po.po_number}</span>,
    },
    { key: 'supplier', header: t($ => $.columns.supplier), cell: (po) => po.supplier?.name ?? '—' },
    { key: 'warehouse', header: t($ => $.columns.warehouse), cell: (po) => po.warehouse?.name ?? '—' },
    { key: 'order_date', header: t($ => $.columns.orderDate), sortable: true, cell: (po) => po.order_date },
    { key: 'expected_date', header: t($ => $.columns.expectedDate), sortable: true, cell: (po) => po.expected_date ?? '—' },
    {
      key: 'grand_total',
      header: t($ => $.columns.total),
      sortable: true,
      cell: (po) => (
        <span className="font-medium">
          {(po.grand_total ?? po.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'received_percentage',
      header: t($ => $.columns.receivedPct),
      cell: (po) => {
        if (po.received_percentage === null || po.received_percentage === undefined) return '—';
        const pct = Math.min(100, Math.max(0, po.received_percentage));
        return (
          <div className="flex items-center gap-2 min-w-[80px]">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs tabular-nums">{Math.round(pct)}%</span>
          </div>
        );
      },
    },
    { key: 'status', header: t($ => $.columns.status), sortable: true, cell: (po) => <PoStatusBadge status={po.status} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.title)}
        subtitle={t($ => $.subtitle)}
        breadcrumbs={[{ label: tCommon($ => $.home), to: ROUTES.dashboard }, { label: t($ => $.title) }]}
        actions={
          <Button onClick={() => navigate(ROUTES.purchaseOrdersNew)}>
            <Plus className="size-4" />
            {t($ => $.actions.new)}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EntityToolbar
            searchPlaceholder={t($ => $.search)}
            onSearchChange={handleSearch}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            onExport={() => undefined}
            onClearFilters={() => { setStatusFilter('all'); setPage(1); }}
            filterPanel={
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{t($ => $.filters.status)}</span>
                <select
                  value={statusFilter}
                  onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setPage(1); }}
                  className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="all">{tCommon($ => $.status.all)}</option>
                  <option value="draft">{t($ => $.status.draft)}</option>
                  <option value="submitted">{t($ => $.status.submitted)}</option>
                  <option value="approved">{t($ => $.status.approved)}</option>
                  <option value="partially_received">{t($ => $.status.partially_received)}</option>
                  <option value="received">{t($ => $.status.received)}</option>
                  <option value="cancelled">{t($ => $.status.cancelled)}</option>
                </select>
              </div>
            }
          />

          <EntityTable<PurchaseOrder>
            columns={columns}
            data={items}
            getRowId={(po) => po.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(po) => (
              <ActionMenu
                label={`Actions for ${po.po_number}`}
                items={[
                  { key: 'view', label: tCommon($ => $.actions.view), icon: Eye, onSelect: () => navigate(`${ROUTES.purchaseOrders}/${po.id}`) },
                  ...(po.status === 'draft'
                    ? [
                        { key: 'edit', label: tCommon($ => $.common.edit), icon: Pencil, onSelect: () => navigate(`${ROUTES.purchaseOrders}/${po.id}/edit`) },
                        { key: 'submit', label: t($ => $.actions.submit), icon: SendHorizonal, onSelect: () => setSubmitting(po) },
                      ]
                    : []),
                  ...(po.status === 'submitted'
                    ? [{ key: 'approve', label: t($ => $.actions.approve), icon: CheckCircle, onSelect: () => setApproving(po) }]
                    : []),
                  ...(!['cancelled', 'received'].includes(po.status)
                    ? [{ key: 'cancel', label: tCommon($ => $.common.cancel), icon: XCircle, variant: 'destructive' as const, onSelect: () => setCancelling(po) }]
                    : []),
                  ...(po.status === 'draft'
                    ? [{ key: 'delete', label: tCommon($ => $.common.delete), icon: Trash2, variant: 'destructive' as const, onSelect: () => setDeleting(po) }]
                    : []),
                ]}
              />
            )}
          />

          {meta ? (
            <Pagination
              meta={{ page: meta.current_page, perPage: meta.per_page, total: meta.total, lastPage: meta.last_page }}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.delete.title)}
        description={tCommon($ => $.dialogs.softDeleteMessage, { name: deleting?.po_number ?? '' })}
        confirmLabel={t($ => $.delete.confirm)}
        variant="destructive"
        loading={deletePO.isPending}
        onConfirm={() => { if (deleting) deletePO.mutate(deleting.id, { onSuccess: () => setDeleting(null) }); }}
      />

      <ConfirmDialog
        open={submitting !== null}
        onOpenChange={(open) => { if (!open) setSubmitting(null); }}
        title={t($ => $.dialogs.submit.title)}
        description={t($ => $.dialogs.submit.description, { number: submitting?.po_number ?? '' })}
        confirmLabel={t($ => $.dialogs.submit.confirm)}
        loading={submitPO.isPending}
        onConfirm={() => { if (submitting) submitPO.mutate(submitting.id, { onSuccess: () => setSubmitting(null) }); }}
      />

      <ConfirmDialog
        open={approving !== null}
        onOpenChange={(open) => { if (!open) setApproving(null); }}
        title={t($ => $.dialogs.approve.title)}
        description={t($ => $.dialogs.approve.description, { number: approving?.po_number ?? '' })}
        confirmLabel={t($ => $.dialogs.approve.confirm)}
        loading={approvePO.isPending}
        onConfirm={() => { if (approving) approvePO.mutate(approving.id, { onSuccess: () => setApproving(null) }); }}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => { if (!open) setCancelling(null); }}
        title={t($ => $.dialogs.cancel.title)}
        description={t($ => $.dialogs.cancel.description, { number: cancelling?.po_number ?? '' })}
        confirmLabel={t($ => $.dialogs.cancel.confirm)}
        variant="destructive"
        loading={cancelPO.isPending}
        onConfirm={() => { if (cancelling) cancelPO.mutate(cancelling.id, { onSuccess: () => setCancelling(null) }); }}
      />
    </div>
  );
}
