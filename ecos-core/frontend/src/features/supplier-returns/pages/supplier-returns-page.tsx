import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatter } from '@/hooks/use-formatter';
import { CheckCircle2, Plus, RotateCcw, Send, Trash2, XCircle } from 'lucide-react';

import {
  ActionMenu,
  ConfirmDialog,
  EntityTable,
  EntityToolbar,
  PageHeader,
  Pagination,
} from '@/components/crud';
import type { ColumnDef } from '@/components/crud/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  useApproveSupplierReturn,
  useCancelSupplierReturn,
  useDeleteSupplierReturn,
  useSubmitSupplierReturn,
  useSupplierReturnsQuery,
  useSupplierReturnStats,
} from '@/features/supplier-returns/hooks/use-supplier-returns';
import { useSupplierReturnLabels, RETURN_STATUS_COLORS } from '@/features/supplier-returns/hooks/use-supplier-returns-labels';
import { SupplierReturnDrawer } from '@/features/supplier-returns/components/supplier-return-drawer';
import type {
  SupplierReturn,
  SupplierReturnStatus,
} from '@/features/supplier-returns/types/supplier-return';

const PER_PAGE = 15;

const CHIP_COLOR_MAP: Record<string, string> = {
  gray:   'bg-gray-100 text-gray-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  orange: 'bg-orange-50 text-orange-700',
  green:  'bg-green-50 text-green-700',
};

type ChipDef = { id: string; label: string; filterKey: SupplierReturnStatus; count: number; color: string };

export function SupplierReturnsPage() {
  const { t } = useTranslation('supplier-returns');
  const fmt = useFormatter();
  const { returnStatusLabel, returnColumnHeaders } = useSupplierReturnLabels();
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState<SupplierReturnStatus | 'all'>('all');
  const [page, setPage]               = useState(1);
  const [sort, setSort]               = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'created_at', direction: 'desc',
  });
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [cancelling, setCancelling]   = useState<SupplierReturn | null>(null);
  const [deleting, setDeleting]       = useState<SupplierReturn | null>(null);

  const params = useMemo(() => ({
    search:   search || undefined,
    status:   statusFilter === 'all' ? undefined : statusFilter,
    page,
    per_page: PER_PAGE,
  }), [search, statusFilter, page]);

  const { data, isLoading, isError, isFetching, refetch } = useSupplierReturnsQuery(params);
  const { data: stats }  = useSupplierReturnStats();
  const submitMutation   = useSubmitSupplierReturn();
  const approveMutation  = useApproveSupplierReturn();
  const cancelMutation   = useCancelSupplierReturn();
  const deleteMutation   = useDeleteSupplierReturn();

  const items = data?.items ?? [];
  const meta  = data?.meta;

  const statusChips: ChipDef[] = stats ? [
    { id: 'draft',          label: t($ => $.page.statusChips.draft),          filterKey: 'draft',            count: Number(stats.draft),          color: 'gray'   },
    { id: 'waiting',        label: t($ => $.page.statusChips.waiting),        filterKey: 'waiting_approval', count: Number(stats.waiting),        color: 'yellow' },
    { id: 'credit_pending', label: t($ => $.page.statusChips.credit_pending), filterKey: 'credit_pending',   count: Number(stats.credit_pending), color: 'orange' },
    { id: 'completed',      label: t($ => $.page.statusChips.completed),      filterKey: 'completed',        count: Number(stats.completed),      color: 'green'  },
  ] : [];

  const handleSort = (field: string) => {
    setSort(curr =>
      curr.field === field
        ? { field, direction: curr.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' }
    );
    setPage(1);
  };

  const handleClearFilters = () => {
    setStatus('all');
    setPage(1);
  };

  const columns: ColumnDef<SupplierReturn>[] = [
    {
      key: 'return_number',
      header: returnColumnHeaders.number,
      cell: (r) => <span className="font-mono text-sm font-medium">{r.return_number}</span>,
    },
    {
      key: 'supplier',
      header: returnColumnHeaders.supplier,
      cell: (r) => <span className="text-sm">{r.supplier?.name ?? '—'}</span>,
    },
    {
      key: 'return_date',
      header: returnColumnHeaders.returnDate,
      cell: (r) => <span className="text-sm text-gray-600">{r.return_date}</span>,
    },
    {
      key: 'reason',
      header: returnColumnHeaders.reason,
      cell: (r) => (
        <span className="text-xs text-gray-500 capitalize">{r.reason?.replace(/_/g, ' ') ?? '—'}</span>
      ),
    },
    {
      key: 'total_return_value',
      header: returnColumnHeaders.amount,
      cell: (r) => (
        <span className="text-sm font-medium">{fmt.money(r.total_return_value)}</span>
      ),
    },
    {
      key: 'status',
      header: returnColumnHeaders.status,
      cell: (r) => (
        <Badge className={`${RETURN_STATUS_COLORS[r.status]} border-0 text-xs`} variant="secondary">
          {returnStatusLabel[r.status]}
        </Badge>
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
          <Button onClick={() => setCreatingNew(true)} size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {t($ => $.page.newReturn)}
          </Button>
        </div>

        {stats && (
          <div className="flex gap-2 flex-wrap">
            {statusChips.map(({ id, label, filterKey, count, color }) => (
              <button
                key={id}
                onClick={() => { setStatus(filterKey); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${CHIP_COLOR_MAP[color]} hover:opacity-80`}
              >
                {label}: {count}
              </button>
            ))}
            <button
              onClick={() => { setStatus('all'); setPage(1); }}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              {t($ => $.page.statusChips.all)}: {stats.total}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card className="shadow-none border-gray-200">
          <CardContent className="flex flex-col gap-4 pt-6">
            <EntityToolbar
              searchPlaceholder={t($ => $.page.search)}
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
                      onChange={(e) => { setStatus(e.target.value as SupplierReturnStatus | 'all'); setPage(1); }}
                      className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="all">{t($ => $.page.statusChips.all)}</option>
                      <option value="draft">{t($ => $.status.draft)}</option>
                      <option value="waiting_approval">{t($ => $.status.waiting_approval)}</option>
                      <option value="approved">{t($ => $.status.approved)}</option>
                      <option value="sent">{t($ => $.status.sent)}</option>
                      <option value="credit_pending">{t($ => $.status.credit_pending)}</option>
                      <option value="completed">{t($ => $.status.completed)}</option>
                      <option value="cancelled">{t($ => $.status.cancelled)}</option>
                    </select>
                  </div>
                </div>
              }
            />

            <EntityTable<SupplierReturn>
              columns={columns}
              data={items}
              getRowId={(r) => r.id}
              isLoading={isLoading}
              isError={isError}
              sort={sort}
              onSortChange={handleSort}
              rowActions={(r) => (
                <ActionMenu
                  label={`Actions for ${r.return_number}`}
                  items={[
                    {
                      key: 'view',
                      label: t($ => $.page.actions.viewDetails),
                      icon: RotateCcw,
                      onSelect: () => setSelectedId(r.id),
                    },
                    ...(r.status === 'draft' ? [
                      {
                        key: 'submit',
                        label: t($ => $.page.actions.submit),
                        icon: Send,
                        onSelect: () => submitMutation.mutate(r.id),
                      },
                    ] : []),
                    ...(r.status === 'waiting_approval' ? [
                      {
                        key: 'approve',
                        label: t($ => $.page.actions.approve),
                        icon: CheckCircle2,
                        onSelect: () => approveMutation.mutate(r.id),
                      },
                    ] : []),
                    ...(['draft', 'waiting_approval'].includes(r.status) ? [
                      {
                        key: 'cancel',
                        label: t($ => $.page.actions.cancel),
                        icon: XCircle,
                        variant: 'destructive' as const,
                        onSelect: () => setCancelling(r),
                      },
                    ] : []),
                    ...(r.status === 'draft' ? [
                      {
                        key: 'delete',
                        label: t($ => $.page.actions.delete),
                        icon: Trash2,
                        variant: 'destructive' as const,
                        onSelect: () => setDeleting(r),
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

      <SupplierReturnDrawer
        id={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => { if (!open) setSelectedId(null); }}
      />

      <SupplierReturnDrawer
        id={null}
        open={creatingNew}
        onOpenChange={(open) => { if (!open) setCreatingNew(false); }}
        mode="create"
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => { if (!open) setCancelling(null); }}
        title={t($ => $.page.confirmCancel.title)}
        description={t($ => $.page.confirmCancel.description)}
        confirmLabel={t($ => $.page.confirmCancel.confirm)}
        variant="destructive"
        loading={cancelMutation.isPending}
        onConfirm={() => {
          if (cancelling) cancelMutation.mutate(cancelling.id, { onSuccess: () => setCancelling(null) });
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.page.confirmDelete.title)}
        description={t($ => $.page.confirmDelete.description)}
        confirmLabel={t($ => $.page.confirmDelete.confirm)}
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
