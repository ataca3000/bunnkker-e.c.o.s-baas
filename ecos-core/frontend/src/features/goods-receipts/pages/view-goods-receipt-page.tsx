import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Send, Trash2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog, PageHeader } from '@/components/crud';
import { GrStatusBadge } from '@/features/goods-receipts/components/gr-status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GoodsReceiptHeaderFields } from '@/features/goods-receipts/components/goods-receipt-header-fields';
import { GoodsReceiptLinesEditor } from '@/features/goods-receipts/components/goods-receipt-lines-editor';
import { toFormValues } from '@/features/goods-receipts/components/goods-receipt-form-schema';
import type { GoodsReceiptFormValues } from '@/features/goods-receipts/components/goods-receipt-form-schema';
import {
  useDeleteGoodsReceipt,
  useGoodsReceiptQuery,
  usePostGoodsReceipt,
} from '@/features/goods-receipts/hooks/use-goods-receipts';
import { ROUTES } from '@/router/routes';

function fmt(n: number, decimals = 4) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: decimals });
}

/** Colour-coded badge for payment status */
function PaymentStatusBadge({ status, label }: { status: string; label: string }) {
  const cls =
    status === 'paid'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      : status === 'partially_paid'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        : 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function ViewGoodsReceiptPage() {
  const { t } = useTranslation('goods-receipts');
  const { t: tCommon } = useTranslation('common');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmPost, setConfirmPost] = useState(false);

  const { data: receipt, isLoading, isError } = useGoodsReceiptQuery(id ?? '');
  const deleteGR = useDeleteGoodsReceipt();
  const postGR = usePostGoodsReceipt();

  const form = useForm<GoodsReceiptFormValues>({
    defaultValues: receipt ? toFormValues(receipt) : toFormValues(null),
    values: receipt ? toFormValues(receipt) : undefined,
  });

  const poLineInfos = (receipt?.lines ?? []).map((l) => ({
    id: l.purchase_order_line_id,
    productName: l.product?.name ?? '—',
    productSku: l.product?.sku ?? '',
    unitPrice: l.unit_price,
    orderedQty: l.ordered_quantity,
  }));

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-muted-foreground text-sm">{t($ => $.detail.loading)}</span>
      </div>
    );
  }

  if (isError || !receipt) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-destructive text-sm">{t($ => $.detail.notFound)}</span>
      </div>
    );
  }

  const isDraft = receipt.status === 'draft';
  const totalNetQty = receipt.lines.reduce((s, l) => s + l.net_received_quantity, 0);
  const extraCostPerUnit = totalNetQty > 0 ? receipt.total_landed_costs / totalNetQty : 0;
  const hasLandedCosts =
    receipt.freight_amount > 0 || receipt.tax_amount > 0 || receipt.additional_costs > 0;

  return (
    <FormProvider {...form}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={receipt.receipt_number}
          subtitle={<GrStatusBadge status={receipt.status} />}
          breadcrumbs={[
            { label: tCommon($ => $.home), to: ROUTES.dashboard },
            { label: t($ => $.title), to: ROUTES.goodsReceipts },
            { label: receipt.receipt_number },
          ]}
          actions={
            isDraft ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate(`${ROUTES.goodsReceipts}/${receipt.id}/edit`)}
                >
                  <Pencil className="size-4" />
                  {tCommon($ => $.common.edit)}
                </Button>
                <Button variant="outline" onClick={() => setConfirmPost(true)}>
                  <Send className="size-4" />
                  {t($ => $.actions.post)}
                </Button>
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4" />
                  {tCommon($ => $.common.delete)}
                </Button>
              </div>
            ) : null
          }
        />

        {/* Receipt Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t($ => $.detail.receiptDetails)}</CardTitle>
          </CardHeader>
          <CardContent>
            <GoodsReceiptHeaderFields readOnly />
          </CardContent>
        </Card>

        {/* Invoice attachment shortcut when posted */}
        {receipt.invoice_attachment_url && (
          <Card>
            <CardHeader>
              <CardTitle>{t($ => $.detail.invoiceAttachment)}</CardTitle>
            </CardHeader>
            <CardContent>
              <a
                href={receipt.invoice_attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex items-center gap-1.5 text-sm underline"
              >
                <ExternalLink className="size-4" />
                {receipt.supplier_invoice_number
                  ? `${t($ => $.detail.invoice)} ${receipt.supplier_invoice_number}`
                  : t($ => $.detail.viewInvoice)}
              </a>
            </CardContent>
          </Card>
        )}

        {/* Invoice Financials */}
        {(receipt.invoice_total_amount > 0 || hasLandedCosts) && (
          <Card>
            <CardHeader>
              <CardTitle>{t($ => $.detail.invoiceFinancials)}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex justify-between gap-4 rounded-md bg-primary/5 px-3 py-2">
                  <dt className="text-foreground text-sm font-semibold">{t($ => $.detail.invoiceTotal)}</dt>
                  <dd className="text-foreground text-sm font-bold tabular-nums">
                    {fmt(receipt.invoice_total_amount, 2)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.form.invoiceFinancials.freight)}</dt>
                  <dd className="text-sm font-medium tabular-nums">{fmt(receipt.freight_amount, 2)}</dd>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.form.invoiceFinancials.tax)}</dt>
                  <dd className="text-sm font-medium tabular-nums">{fmt(receipt.tax_amount, 2)}</dd>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.form.invoiceFinancials.additionalCosts)}</dt>
                  <dd className="text-sm font-medium tabular-nums">{fmt(receipt.additional_costs, 2)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t($ => $.detail.paymentInfo)}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                <dt className="text-muted-foreground text-sm">{t($ => $.detail.paymentStatus)}</dt>
                <dd>
                  <PaymentStatusBadge
                    status={receipt.payment_status}
                    label={receipt.payment_status_label}
                  />
                </dd>
              </div>
              {receipt.invoice_total_amount > 0 && (
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.detail.paidAmount)}</dt>
                  <dd className="text-sm font-medium tabular-nums">{fmt(receipt.paid_amount, 2)}</dd>
                </div>
              )}
              {receipt.invoice_total_amount > 0 && (
                <div className="flex justify-between gap-4 rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-900/20">
                  <dt className="text-amber-700 text-sm dark:text-amber-300">{t($ => $.detail.outstandingAmount)}</dt>
                  <dd className="text-amber-700 text-sm font-bold tabular-nums dark:text-amber-300">{fmt(receipt.outstanding_amount, 2)}</dd>
                </div>
              )}
              {receipt.payment_method && (
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.detail.paymentMethod)}</dt>
                  <dd className="text-sm font-medium">{receipt.payment_method_label}</dd>
                </div>
              )}
              {receipt.payment_terms_days != null && (
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.detail.paymentTerms)}</dt>
                  <dd className="text-sm font-medium tabular-nums">
                    {receipt.payment_terms_days === 0
                      ? t($ => $.form.paymentInfo.termsImmediate)
                      : t($ => $.detail.nDays, { n: receipt.payment_terms_days })}
                  </dd>
                </div>
              )}
              {receipt.payment_due_date && (
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.detail.paymentDueDate)}</dt>
                  <dd className="text-sm font-medium tabular-nums">{receipt.payment_due_date}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Lines */}
        <Card>
          <CardHeader>
            <CardTitle>{t($ => $.detail.lineItems)}</CardTitle>
          </CardHeader>
          <CardContent>
            <GoodsReceiptLinesEditor readOnly poLineInfos={poLineInfos} />
          </CardContent>
        </Card>

        {/* Landed Cost Summary */}
        {(hasLandedCosts || receipt.status === 'posted') && (
          <Card>
            <CardHeader>
              <CardTitle>{t($ => $.detail.landedCostSummary)}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.form.invoiceFinancials.freight)}</dt>
                  <dd className="text-sm font-medium tabular-nums">{fmt(receipt.freight_amount, 2)}</dd>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.form.invoiceFinancials.tax)}</dt>
                  <dd className="text-sm font-medium tabular-nums">{fmt(receipt.tax_amount, 2)}</dd>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.form.invoiceFinancials.additionalCosts)}</dt>
                  <dd className="text-sm font-medium tabular-nums">{fmt(receipt.additional_costs, 2)}</dd>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.detail.totalExtraCosts)}</dt>
                  <dd className="text-sm font-medium tabular-nums">{fmt(receipt.total_landed_costs, 2)}</dd>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-muted/50 px-3 py-2">
                  <dt className="text-muted-foreground text-sm">{t($ => $.detail.totalNetQty)}</dt>
                  <dd className="text-sm font-medium tabular-nums">{fmt(totalNetQty, 4)}</dd>
                </div>
                <div className="flex justify-between gap-4 rounded-md bg-primary/5 px-3 py-2">
                  <dt className="text-foreground text-sm font-semibold">{t($ => $.detail.extraCostPerUnit)}</dt>
                  <dd className="text-foreground text-sm font-bold tabular-nums">{fmt(extraCostPerUnit, 4)}</dd>
                </div>
              </dl>

              {receipt.status === 'posted' && receipt.lines.some((l) => l.landed_unit_cost != null) && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground border-b text-start">
                        <th className="pb-2 pr-3 font-medium">{t($ => $.lines.columns.product)}</th>
                        <th className="w-28 pb-2 pr-3 text-end font-medium">{t($ => $.detail.unitPrice)}</th>
                        <th className="w-28 pb-2 pr-3 text-end font-medium">{t($ => $.detail.netQty)}</th>
                        <th className="w-32 pb-2 text-end font-medium">{t($ => $.detail.landedUnitCost)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {receipt.lines
                        .filter((l) => l.landed_unit_cost != null)
                        .map((l) => (
                          <tr key={l.id}>
                            <td className="py-2 pr-3">{l.product?.name ?? '—'}</td>
                            <td className="py-2 pr-3 text-end tabular-nums">{fmt(l.unit_price, 2)}</td>
                            <td className="py-2 pr-3 text-end tabular-nums">{fmt(l.net_received_quantity, 4)}</td>
                            <td className="py-2 text-end tabular-nums font-medium">{fmt(l.landed_unit_cost!, 4)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t($ => $.dialogs.delete.title)}
        description={t($ => $.dialogs.delete.description, { number: receipt.receipt_number })}
        confirmLabel={t($ => $.dialogs.delete.confirm)}
        variant="destructive"
        loading={deleteGR.isPending}
        onConfirm={() => {
          deleteGR.mutate(receipt.id, {
            onSuccess: () => navigate(ROUTES.goodsReceipts),
          });
        }}
      />

      <ConfirmDialog
        open={confirmPost}
        onOpenChange={setConfirmPost}
        title={t($ => $.dialogs.post.title)}
        description={t($ => $.dialogs.post.description, { number: receipt.receipt_number })}
        confirmLabel={t($ => $.dialogs.post.confirm)}
        loading={postGR.isPending}
        onConfirm={() => {
          postGR.mutate(receipt.id, {
            onSuccess: () => setConfirmPost(false),
          });
        }}
      />
    </FormProvider>
  );
}
