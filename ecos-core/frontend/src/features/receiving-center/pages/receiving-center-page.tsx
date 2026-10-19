import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, PackageOpen, Pencil, Plus, Send, Trash2 } from 'lucide-react';

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
} from '@/features/goods-receipts/types/goods-receipt';
import { ROUTES } from '@/router/routes';
import { useTranslation } from 'react-i18next';
import { useFormatter } from '@/hooks/use-formatter';

const PER_PAGE = 15;

type KpiProps = { label: string; value: string | number; color?: string };

function KpiChip({ label, value, color = 'gray' }: KpiProps) {
  const colors: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-700',
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
  };

  return (
    <div className={`flex flex-col items-center px-5 py-3 rounded-lg ${colors[color] ?? colors.gray}`}>
      <span className="text-xl font-semibold">{value}</span>
      <span className="text-xs mt-0.5 opacity-80">{label}</span>
    </div>
  );
}

export function ReceivingCenterPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('receiving-center');
  const fmt = useFormatter();
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState<GoodsReceiptStatus | 'all'>('all');
  const [page, setPage]                   = useState(1);
  const [sort, setSort]                   = useState<{ field: GoodsReceiptSortField; direction: 'asc' | 'desc' }>({
    field: 'created_at', direction: 'desc',
  });
  const [deleting, setDeleting] = useState<GoodsReceipt | null>(null);
  const [posting, setPosting]   = useState<GoodsReceipt | null>(null);

  const params = useMemo(() => ({
    search:   search || undefined,
    status:   statusFilter,
    page,
    per_page: PER_PAGE,
    sort_by:  sort.field,
    sort_dir: sort.direction,
  }), [search, statusFilter, page, sort]);

  const { data, isLoading, isError, isFetching, refetch } = useGoodsReceiptsQuery(params);
  const deleteGR = useDeleteGoodsReceipt();
  const postGR   = usePostGoodsReceipt();

  const items = data?.items ?? [];
  const meta  = data?.meta;

  const draftCount  = items.filter(i => i.status === 'draft').length;
  const postedCount = items.filter(i => i.status === 'posted').length;

  const handleSort = (field: string) => {
    setSort(curr =>
      curr.field === field
        ? { field: field as GoodsReceiptSortField, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field: field as GoodsReceiptSortField, direction: 'asc' }
    );
    setPage(1);
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setPage(1);
  };

  const columns: ColumnDef<GoodsReceipt>[] = [
    {
      key: 'receipt_number',
      header: t($ => $.page.columns.receiptNo),
      sortable: true,
      cell: (gr) => <span className="font-mono text-sm font-medium">{gr.receipt_number}</span>,
    },
    {
      key: 'receipt_date',
      header: t($ => $.page.columns.date),
      sortable: true,
      cell: (gr) => <span className="text-sm text-gray-600">{gr.receipt_date}</span>,
    },
    {
      key: 'supplier',
      header: t($ => $.page.columns.supplier),
      cell: (gr) => <span className="text-sm">{gr.purchase_order?.supplier?.name ?? '—'}</span>,
    },
    {
      key: 'warehouse',
      header: t($ => $.page.columns.warehouse),
      cell: (gr) => (
        <span className="text-sm text-gray-600">
          {gr.warehouse ? `${gr.warehouse.code} — ${gr.warehouse.name}` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: t($ => $.page.columns.status),
      sortable: true,
      cell: (gr) => <GrStatusBadge status={gr.status} />,
    },
    {
      key: 'payment_status',
      header: t($ => $.page.columns.payment),
      cell: (gr) => <GrPaymentStatusBadge status={gr.payment_status} />,
    },
    {
      key: 'invoice_total_amount',
      header: t($ => $.page.columns.invoiceTotal),
      cell: (gr) => (
        <span className="text-sm font-medium">
          {gr.invoice_total_amount > 0 ? fmt.money(gr.invoice_total_amount) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <PageHeader
            title={t($ => $.page.title)}
            subtitle={t($ => $.page.subtitle)}
          />
          <Button onClick={() => navigate(ROUTES.goodsReceiptsNew)} size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {t($ => $.page.actions.newReceipt)}
          </Button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <KpiChip label={t($ => $.page.kpis.totalReceipts)} value={meta?.total ?? '—'} color="gray" />
          <KpiChip label={t($ => $.page.kpis.draft)} value={draftCount} color="yellow" />
          <KpiChip label={t($ => $.page.kpis.posted)} value={postedCount} color="green" />
          <button
            className="flex flex-col items-center px-5 py-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            onClick={() => navigate(ROUTES.goodsReceiptsNew)}
          >
            <PackageOpen className="w-4 h-4 mb-0.5" />
            <span className="text-xs">{t($ => $.page.actions.receiveGoods)}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card className="shadow-none border-gray-200">
          <CardContent className="flex flex-col gap-4 pt-6">
            <EntityToolbar
              searchPlaceholder={t($ => $.page.filters.search)}
              onSearchChange={(v) => { setSearch(v); setPage(1); }}
              onRefresh={() => void refetch()}
              isRefreshing={isFetching}
              onClearFilters={handleClearFilters}
              filterPanel={
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{t($ => $.page.columns.status)}</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value as GoodsReceiptStatus | 'all'); setPage(1); }}
                      className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="all">{tAny('page.filters.allStatuses')}</option>
                      <option value="draft">{tAny('page.kpis.draft')}</option>
                      <option value="posted">{tAny('page.kpis.posted')}</option>
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
                      label: t($ => $.page.actions.view),
                      icon: Eye,
                      onSelect: () => navigate(`${ROUTES.goodsReceipts}/${gr.id}`),
                    },
                    ...(gr.status === 'draft' ? [
                      {
                        key: 'edit',
                        label: t($ => $.page.actions.edit),
                        icon: Pencil,
                        onSelect: () => navigate(`${ROUTES.goodsReceipts}/${gr.id}/edit`),
                      },
                      {
                        key: 'post',
                        label: t($ => $.page.actions.post),
                        icon: Send,
                        onSelect: () => setPosting(gr),
                      },
                      {
                        key: 'delete',
                        label: t($ => $.page.actions.delete),
                        icon: Trash2,
                        variant: 'destructive' as const,
                        onSelect: () => setDeleting(gr),
                      },
                    ] : []),
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
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.page.confirmDelete.title)}
        description={t($ => $.page.confirmDelete.description)}
        confirmLabel={t($ => $.page.confirmDelete.confirm)}
        variant="destructive"
        loading={deleteGR.isPending}
        onConfirm={() => {
          if (deleting) deleteGR.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />

      <ConfirmDialog
        open={posting !== null}
        onOpenChange={(open) => { if (!open) setPosting(null); }}
        title={t($ => $.page.confirmPost.title)}
        description={t($ => $.page.confirmPost.description)}
        confirmLabel={t($ => $.page.confirmPost.confirm)}
        loading={postGR.isPending}
        onConfirm={() => {
          if (posting) postGR.mutate(posting.id, { onSuccess: () => setPosting(null) });
        }}
      />
    </div>
  );
}
