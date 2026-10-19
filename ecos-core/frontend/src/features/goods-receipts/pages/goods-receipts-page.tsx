import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, Send, Trash2 } from 'lucide-react';
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
import { GrPaymentStatusBadge } from '@/features/goods-receipts/components/gr-payment-status-badge';
import { GrStatusBadge } from '@/features/goods-receipts/components/gr-status-badge';
import {
  useDeleteGoodsReceipt,
  useGoodsReceiptsQuery,
  usePostGoodsReceipt,
} from '@/features/goods-receipts/hooks/use-goods-receipts';
import type {
  GoodsReceipt,
  GoodsReceiptSortField,
  GoodsReceiptStatus,
  PaymentStatus,
} from '@/features/goods-receipts/types/goods-receipt';
import { useSupplierOptions } from '@/features/purchase-orders/hooks/use-supplier-options';
import { ROUTES } from '@/router/routes';

const PER_PAGE = 10;

export function GoodsReceiptsPage() {
  const { t } = useTranslation('goods-receipts');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GoodsReceiptStatus | 'all'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ field: GoodsReceiptSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at',
    direction: 'desc',
  });
  const [deleting, setDeleting] = useState<GoodsReceipt | null>(null);
  const [posting, setPosting] = useState<GoodsReceipt | null>(null);

  const { data: supplierOptions } = useSupplierOptions();

  const params = useMemo(
    () => ({
      search: search || undefined,
      status: statusFilter,
      payment_status: paymentStatusFilter === 'all' ? undefined : paymentStatusFilter,
      supplier_id: supplierFilter || undefined,
      page,
      per_page: PER_PAGE,
      sort_by: sort.field,
      sort_dir: sort.direction,
    }),
    [search, statusFilter, paymentStatusFilter, supplierFilter, page, sort],
  );

  const { data, isLoading, isError, isFetching, refetch } = useGoodsReceiptsQuery(params);
  const deleteGR = useDeleteGoodsReceipt();
  const postGR = usePostGoodsReceipt();

  const items = data?.items ?? [];
  const meta = data?.meta;

  const handleSort = (field: string) => {
    setSort((curr) =>
      curr.field === field
        ? { field: field as GoodsReceiptSortField, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as GoodsReceiptSortField, direction: 'asc' },
    );
    setPage(1);
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setPaymentStatusFilter('all');
    setSupplierFilter('');
    setPage(1);
  };

  const columns: ColumnDef<GoodsReceipt>[] = [
    {
      key: 'receipt_number',
      header: t($ => $.columns.number),
      sortable: true,
      cell: (gr) => <span className="font-medium">{gr.receipt_number}</span>,
    },
    {
      key: 'supplier',
      header: t($ => $.columns.supplier),
      cell: (gr) => gr.purchase_order?.supplier?.name ?? '—',
    },
    {
      key: 'purchase_order',
      header: t($ => $.columns.purchaseOrder),
      cell: (gr) => gr.purchase_order?.po_number ?? '—',
    },
    {
      key: 'receipt_date',
      header: t($ => $.columns.receiptDate),
      sortable: true,
      cell: (gr) => gr.receipt_date,
    },
    {
      key: 'supplier_invoice_number',
      header: t($ => $.columns.invoiceNumber),
      cell: (gr) => gr.supplier_invoice_number ?? '—',
    },
    {
      key: 'supplier_invoice_date',
      header: t($ => $.columns.invoiceDate),
      cell: (gr) => gr.supplier_invoice_date ?? '—',
    },
    {
      key: 'invoice_total_amount',
      header: t($ => $.columns.invoiceTotal),
      cell: (gr) => gr.invoice_total_amount > 0
        ? gr.invoice_total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—',
    },
    {
      key: 'payment_status',
      header: t($ => $.columns.paymentStatus),
      cell: (gr) => <GrPaymentStatusBadge status={gr.payment_status} />,
    },
    {
      key: 'status',
      header: t($ => $.columns.status),
      sortable: true,
      cell: (gr) => <GrStatusBadge status={gr.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t($ => $.title)}
        subtitle={t($ => $.subtitle)}
        breadcrumbs={[{ label: tCommon($ => $.home), to: ROUTES.dashboard }, { label: t($ => $.title) }]}
        actions={
          <Button onClick={() => navigate(ROUTES.goodsReceiptsNew)}>
            <Plus className="size-4" />
            {t($ => $.actions.new)}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EntityToolbar
            searchPlaceholder={t($ => $.search)}
            onSearchChange={(v) => { setSearch(v); setPage(1); }}
            onRefresh={() => void refetch()}
            isRefreshing={isFetching}
            onExport={() => undefined}
            onClearFilters={handleClearFilters}
            filterPanel={
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{tCommon($ => $.filters.status)}</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value as GoodsReceiptStatus | 'all'); setPage(1); }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="all">{tCommon($ => $.status.all)}</option>
                    <option value="draft">{t($ => $.status.draft)}</option>
                    <option value="posted">{t($ => $.status.posted)}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t($ => $.filters.paymentStatus)}</span>
                  <select
                    value={paymentStatusFilter}
                    onChange={(e) => { setPaymentStatusFilter(e.target.value as PaymentStatus | 'all'); setPage(1); }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="all">{t($ => $.filters.allPaymentStatuses)}</option>
                    <option value="unpaid">{t($ => $.paymentStatus.unpaid)}</option>
                    <option value="partially_paid">{t($ => $.paymentStatus.partiallyPaid)}</option>
                    <option value="paid">{t($ => $.paymentStatus.paid)}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">{t($ => $.filters.supplier)}</span>
                  <select
                    value={supplierFilter}
                    onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="">{tCommon($ => $.status.all)}</option>
                    {(supplierOptions ?? []).map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            }
          />

          <EntityTable<GoodsReceipt>
            columns={columns}
            data={items}
            getRowId={(gr) => gr.id}
            isLoading={isLoading}
            isError={isError}
            sort={sort}
            onSortChange={handleSort}
            rowActions={(gr) => (
              <ActionMenu
                label={`Actions for ${gr.receipt_number}`}
                items={[
                  {
                    key: 'view',
                    label: tCommon($ => $.actions.view),
                    icon: Eye,
                    onSelect: () => navigate(`${ROUTES.goodsReceipts}/${gr.id}`),
                  },
                  ...(gr.status === 'draft'
                    ? [
                        {
                          key: 'edit',
                          label: tCommon($ => $.common.edit),
                          icon: Pencil,
                          onSelect: () => navigate(`${ROUTES.goodsReceipts}/${gr.id}/edit`),
                        },
                        {
                          key: 'post',
                          label: t($ => $.actions.post),
                          icon: Send,
                          onSelect: () => setPosting(gr),
                        },
                        {
                          key: 'delete',
                          label: tCommon($ => $.common.delete),
                          icon: Trash2,
                          variant: 'destructive' as const,
                          onSelect: () => setDeleting(gr),
                        },
                      ]
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
        title={t($ => $.dialogs.delete.title)}
        description={t($ => $.dialogs.delete.description, { number: deleting?.receipt_number ?? '' })}
        confirmLabel={t($ => $.dialogs.delete.confirm)}
        variant="destructive"
        loading={deleteGR.isPending}
        onConfirm={() => {
          if (deleting) deleteGR.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />

      <ConfirmDialog
        open={posting !== null}
        onOpenChange={(open) => { if (!open) setPosting(null); }}
        title={t($ => $.dialogs.post.title)}
        description={t($ => $.dialogs.post.description, { number: posting?.receipt_number ?? '' })}
        confirmLabel={t($ => $.dialogs.post.confirm)}
        loading={postGR.isPending}
        onConfirm={() => {
          if (posting) postGR.mutate(posting.id, { onSuccess: () => setPosting(null) });
        }}
      />
    </div>
  );
}
