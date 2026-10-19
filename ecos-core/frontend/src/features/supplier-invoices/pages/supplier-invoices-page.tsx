import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatter } from '@/hooks/use-formatter';
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  FileText,
  Loader2,
  Plus,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';

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
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useCancelSupplierInvoice,
  useDeleteSupplierInvoice,
  usePostSupplierInvoice,
  useSupplierInvoice,
  useSupplierInvoiceStats,
  useSupplierInvoicesQuery,
  useValidateSupplierInvoice,
} from '@/features/supplier-invoices/hooks/use-supplier-invoices';
import { SupplierInvoiceEditor } from '@/features/supplier-invoices/components/supplier-invoice-editor';
import type {
  SupplierInvoice,
  SupplierInvoiceStatus,
} from '@/features/supplier-invoices/types/supplier-invoice';

const STATUS_COLORS: Record<SupplierInvoiceStatus, string> = {
  draft:           'bg-gray-100 text-gray-700',
  validated:       'bg-blue-100 text-blue-800',
  auto_processing: 'bg-yellow-100 text-yellow-800',
  posted:          'bg-green-100 text-green-800',
  failed:          'bg-red-100 text-red-700',
  cancelled:       'bg-red-100 text-red-700',
};

const PER_PAGE = 15;

function InvoiceDetailDrawer({
  id,
  open,
  onOpenChange,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: invoice, isLoading } = useSupplierInvoice(id);
  const validateMutation = useValidateSupplierInvoice();
  const postMutation     = usePostSupplierInvoice();
  const cancelMutation   = useCancelSupplierInvoice();
  const { t } = useTranslation('supplier-invoices');
  const fmt = useFormatter();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        {isLoading || !invoice ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <SheetTitle>{invoice.invoice_number}</SheetTitle>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {invoice.supplier?.name ?? '—'} · {invoice.invoice_date}
                  </p>
                </div>
                <Badge
                  className={`${STATUS_COLORS[invoice.status]} border-0 text-xs flex-shrink-0`}
                  variant="secondary"
                >
                  {invoice.status_label}
                </Badge>
              </div>

              <div className="flex gap-2 pt-2 flex-wrap">
                {invoice.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => validateMutation.mutate(invoice.id)}
                    disabled={validateMutation.isPending}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t($ => $.detail.validate)}
                  </Button>
                )}
                {invoice.status === 'validated' && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-green-600 hover:bg-green-700"
                    onClick={() => postMutation.mutate(invoice.id)}
                    disabled={postMutation.isPending}
                  >
                    {postMutation.isPending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Zap className="w-3.5 h-3.5" />
                    }
                    {t($ => $.detail.postToInventory)}
                  </Button>
                )}
                {['draft', 'validated', 'failed'].includes(invoice.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-red-600"
                    onClick={() => cancelMutation.mutate(invoice.id)}
                    disabled={cancelMutation.isPending}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {t($ => $.detail.cancel)}
                  </Button>
                )}
              </div>

              {invoice.status === 'failed' && invoice.posting_error && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-800">{t($ => $.detail.postingError)}</p>
                    <p className="text-xs text-red-600 mt-0.5">{invoice.posting_error}</p>
                  </div>
                </div>
              )}
            </SheetHeader>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t($ => $.detail.financial.subtotal)}</span>
                  <span>{fmt.money(invoice.subtotal)}</span>
                </div>
                {invoice.tax_total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t($ => $.detail.financial.tax)}</span>
                    <span>{fmt.money(invoice.tax_total)}</span>
                  </div>
                )}
                {invoice.freight_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t($ => $.detail.financial.freight)}</span>
                    <span>{fmt.money(invoice.freight_amount)}</span>
                  </div>
                )}
                {invoice.additional_costs > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">{t($ => $.detail.financial.additionalCosts)}</span>
                    <span>{fmt.money(invoice.additional_costs)}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between text-sm font-semibold">
                  <span>{t($ => $.detail.financial.grandTotal)}</span>
                  <span className="text-gray-900">{fmt.money(invoice.grand_total)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase">
                  {t($ => $.detail.itemsTitle)} ({invoice.lines.length})
                </p>
                <div className="space-y-2">
                  {invoice.lines.map(line => (
                    <div key={line.id} className="p-3 border border-gray-100 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium">{line.product?.name ?? line.product_id}</p>
                          <p className="text-xs text-gray-500">
                            {line.quantity} × {fmt.money(line.unit_price)}
                            {line.tax_rate > 0 && ` + ${line.tax_rate}% tax`}
                          </p>
                          {line.landed_unit_cost !== null && (
                            <p className="text-xs text-blue-600 mt-0.5">
                              {t($ => $.detail.landedCostFormat, { value: fmt.money(line.landed_unit_cost) })}
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-semibold">{fmt.money(line.line_total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {(invoice.auto_purchase_id || invoice.auto_receipt_id) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase">
                    {t($ => $.detail.autoDocuments)}
                  </p>
                  <div className="space-y-1.5">
                    {invoice.auto_purchase_id && (
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-gray-600">{t($ => $.detail.purchaseRecordCreated)}</span>
                        <span className="text-xs text-gray-400 font-mono">{invoice.auto_purchase_id.slice(0, 8)}…</span>
                      </div>
                    )}
                    {invoice.auto_receipt_id && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-gray-600">{t($ => $.detail.goodsReceiptCreated)}</span>
                        <span className="text-xs text-gray-400 font-mono">{invoice.auto_receipt_id.slice(0, 8)}…</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {invoice.posting_log && invoice.posting_log.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase">
                    {t($ => $.detail.postingLog)}
                  </p>
                  <div className="bg-gray-900 rounded-lg p-3 space-y-1">
                    {invoice.posting_log.map((entry, i) => (
                      <p key={i} className="text-xs font-mono text-green-400">{entry}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function SupplierInvoicesPage() {
  const { t } = useTranslation('supplier-invoices');
  const fmt = useFormatter();
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState<SupplierInvoiceStatus | 'all'>('all');
  const [page, setPage]               = useState(1);
  const [sort, setSort]               = useState<{ field: string; direction: 'asc' | 'desc' }>({
    field: 'created_at', direction: 'desc',
  });
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [deleting, setDeleting]       = useState<SupplierInvoice | null>(null);

  const params = useMemo(() => ({
    search:   search || undefined,
    status:   statusFilter === 'all' ? undefined : statusFilter,
    page,
    per_page: PER_PAGE,
  }), [search, statusFilter, page]);

  const { data, isLoading, isError, isFetching, refetch } = useSupplierInvoicesQuery(params);
  const { data: stats }   = useSupplierInvoiceStats();
  const validateMutation  = useValidateSupplierInvoice();
  const postMutation      = usePostSupplierInvoice();
  const cancelMutation    = useCancelSupplierInvoice();
  const deleteMutation    = useDeleteSupplierInvoice();

  const items = data?.items ?? [];
  const meta  = data?.meta;

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

  const handlePost = useCallback((id: string) => {
    postMutation.mutate(id);
  }, [postMutation]);

  const columns = useMemo<ColumnDef<SupplierInvoice>[]>(() => [
    {
      key: 'invoice_number',
      header: t($ => $.page.columns.invoiceNo),
      cell: (inv) => (
        <div>
          <span className="font-mono text-sm font-medium">{inv.invoice_number}</span>
          {inv.supplier_invoice_ref && (
            <span className="text-xs text-gray-400 block">{t($ => $.page.columns.ref)}: {inv.supplier_invoice_ref}</span>
          )}
        </div>
      ),
    },
    {
      key: 'supplier',
      header: t($ => $.page.columns.supplier),
      cell: (inv) => <span className="text-sm">{inv.supplier?.name ?? '—'}</span>,
    },
    {
      key: 'invoice_date',
      header: t($ => $.page.columns.invoiceDate),
      cell: (inv) => <span className="text-sm text-gray-600">{inv.invoice_date}</span>,
    },
    {
      key: 'due_date',
      header: t($ => $.page.columns.dueDate),
      cell: (inv) => (
        <span className={`text-sm ${
          inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'posted'
            ? 'text-red-600 font-medium'
            : 'text-gray-600'
        }`}>
          {inv.due_date ?? '—'}
        </span>
      ),
    },
    {
      key: 'grand_total',
      header: t($ => $.page.columns.grandTotal),
      cell: (inv) => (
        <span className="text-sm font-semibold">{fmt.money(inv.grand_total)}</span>
      ),
    },
    {
      key: 'status',
      header: t($ => $.page.columns.status),
      cell: (inv) => (
        <div className="flex items-center gap-2">
          <Badge
            className={`${STATUS_COLORS[inv.status]} border-0 text-xs`}
            variant="secondary"
          >
            {inv.status === 'auto_processing' && (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            )}
            {inv.status_label}
          </Badge>
          {inv.status === 'validated' && (
            <Button
              size="sm"
              className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 gap-1"
              onClick={(e) => { e.stopPropagation(); handlePost(inv.id); }}
              disabled={postMutation.isPending}
            >
              <Zap className="w-3 h-3" />
              {t($ => $.page.actions.postShort)}
            </Button>
          )}
        </div>
      ),
    },
  ], [t, fmt, handlePost, postMutation.isPending]);

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
            {t($ => $.page.newInvoice)}
          </Button>
        </div>

        {stats && (
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-600">
              <FileText className="w-3.5 h-3.5" />
              <span>{t($ => $.page.stats.draft)}: <strong>{stats.draft}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg text-xs text-blue-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t($ => $.page.stats.validated)}: <strong>{stats.validated}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 rounded-lg text-xs text-green-700">
              <Zap className="w-3.5 h-3.5" />
              <span>{t($ => $.page.stats.posted)}: <strong>{stats.posted}</strong></span>
            </div>
            {stats.failed > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{t($ => $.page.stats.failed)}: <strong>{stats.failed}</strong></span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-600 ms-auto">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{t($ => $.page.stats.postedValue)}: <strong>{fmt.moneyCompact(stats.total_value)}</strong></span>
            </div>
          </div>
        )}
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
                    <span className="text-sm font-medium">{t($ => $.page.filters.status)}</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatus(e.target.value as SupplierInvoiceStatus | 'all'); setPage(1); }}
                      className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="all">{t($ => $.page.filters.allStatuses)}</option>
                      <option value="draft">{t($ => $.status.draft)}</option>
                      <option value="validated">{t($ => $.page.stats.validated)}</option>
                      <option value="auto_processing">{t($ => $.page.filters.processing)}</option>
                      <option value="posted">{t($ => $.status.posted)}</option>
                      <option value="failed">{t($ => $.page.stats.failed)}</option>
                      <option value="cancelled">{t($ => $.status.cancelled)}</option>
                    </select>
                  </div>
                </div>
              }
            />

            <EntityTable<SupplierInvoice>
              columns={columns}
              data={items}
              getRowId={(inv) => inv.id}
              isLoading={isLoading}
              isError={isError}
              sort={sort}
              onSortChange={handleSort}
              rowActions={(inv) => (
                <ActionMenu
                  label={t($ => $.page.actions.actionsFor, { invoiceNumber: inv.invoice_number })}
                  items={[
                    {
                      key: 'view',
                      label: t($ => $.page.actions.view) as string,
                      icon: FileText,
                      onSelect: () => setSelectedId(inv.id),
                    },
                    ...(inv.status === 'draft' ? [
                      {
                        key: 'validate',
                        label: t($ => $.page.actions.validate) as string,
                        icon: CheckCircle2,
                        onSelect: () => validateMutation.mutate(inv.id),
                      },
                    ] : []),
                    ...(inv.status === 'validated' ? [
                      {
                        key: 'post',
                        label: t($ => $.page.actions.post) as string,
                        icon: Zap,
                        onSelect: () => handlePost(inv.id),
                      },
                    ] : []),
                    ...(['draft', 'validated', 'failed'].includes(inv.status) ? [
                      {
                        key: 'cancel',
                        label: t($ => $.page.actions.cancel) as string,
                        icon: XCircle,
                        variant: 'destructive' as const,
                        onSelect: () => cancelMutation.mutate(inv.id),
                      },
                    ] : []),
                    ...(inv.status === 'draft' ? [
                      {
                        key: 'delete',
                        label: t($ => $.page.actions.delete) as string,
                        icon: Trash2,
                        variant: 'destructive' as const,
                        onSelect: () => setDeleting(inv),
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

      {selectedId !== null && (
        <InvoiceDetailDrawer
          id={selectedId}
          open={true}
          onOpenChange={(open) => { if (!open) setSelectedId(null); }}
        />
      )}

      <SupplierInvoiceEditor
        open={creatingNew}
        onOpenChange={(open) => { if (!open) setCreatingNew(false); }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t($ => $.page.confirmDelete.title) as string}
        description={t($ => $.page.confirmDelete.description) as string}
        confirmLabel={t($ => $.page.confirmDelete.confirm) as string}
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
