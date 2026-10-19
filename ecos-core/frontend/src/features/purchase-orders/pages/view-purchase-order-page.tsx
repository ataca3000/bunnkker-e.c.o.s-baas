import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, Pencil, SendHorizonal, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog, PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PoStatusBadge } from '@/features/purchase-orders/components/po-status-badge';
import {
  useApprovePurchaseOrder,
  useCancelPurchaseOrder,
  usePurchaseOrderQuery,
  useSubmitPurchaseOrder,
} from '@/features/purchase-orders/hooks/use-purchase-orders';
import { ROUTES } from '@/router/routes';

function LabelValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ViewPurchaseOrderPage() {
  const { t } = useTranslation('purchase-orders');
  const { t: tCommon } = useTranslation('common');
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading } = usePurchaseOrderQuery(id);
  const submitPO = useSubmitPurchaseOrder();
  const approvePO = useApprovePurchaseOrder();
  const cancelPO = useCancelPurchaseOrder();

  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t($ => $.detail.loading)}
          breadcrumbs={[{ label: tCommon($ => $.home), to: ROUTES.dashboard }, { label: t($ => $.title), to: ROUTES.purchaseOrders }, { label: '…' }]}
        />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t($ => $.detail.notFound)}
          breadcrumbs={[{ label: tCommon($ => $.home), to: ROUTES.dashboard }, { label: t($ => $.title), to: ROUTES.purchaseOrders }]}
        />
        <p className="text-muted-foreground text-sm">{t($ => $.detail.notFoundMessage)}</p>
      </div>
    );
  }

  const isDraft = order.status === 'draft';
  const isSubmitted = order.status === 'submitted';
  const isCancellable = !['cancelled', 'received'].includes(order.status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={order.po_number}
        subtitle={order.supplier?.name ?? ''}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.title), to: ROUTES.purchaseOrders },
          { label: order.po_number },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PoStatusBadge status={order.status} />
            {isDraft && (
              <>
                <Button variant="outline" onClick={() => navigate(`${ROUTES.purchaseOrders}/${order.id}/edit`)}>
                  <Pencil className="size-4" />
                  {tCommon($ => $.common.edit)}
                </Button>
                <Button onClick={() => setSubmitting(true)}>
                  <SendHorizonal className="size-4" />
                  {t($ => $.actions.submit)}
                </Button>
              </>
            )}
            {isSubmitted && (
              <Button onClick={() => setApproving(true)}>
                <CheckCircle className="size-4" />
                {t($ => $.actions.approve)}
              </Button>
            )}
            {isCancellable && (
              <Button variant="destructive" onClick={() => setCancelling(true)}>
                <XCircle className="size-4" />
                {tCommon($ => $.common.cancel)}
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t($ => $.detail.orderDetails)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LabelValue label={t($ => $.detail.supplier)} value={order.supplier?.name ?? '—'} />
            <LabelValue label={t($ => $.detail.warehouse)} value={order.warehouse?.name ?? '—'} />
            <LabelValue label={t($ => $.detail.orderDate)} value={order.order_date} />
            <LabelValue label={t($ => $.detail.expectedDate)} value={order.expected_date ?? '—'} />
            <LabelValue label={t($ => $.detail.status)} value={<PoStatusBadge status={order.status} />} />
          </div>
          {order.notes && (
            <div className="mt-4">
              <span className="text-muted-foreground text-xs">{t($ => $.detail.notes)}</span>
              <p className="mt-0.5 text-sm">{order.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t($ => $.detail.lineItems)}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-start">
                  <th className="pb-2 pr-3 font-medium">{t($ => $.detail.product)}</th>
                  <th className="w-24 pb-2 pr-3 font-medium">{t($ => $.detail.qty)}</th>
                  <th className="w-24 pb-2 pr-3 font-medium">{t($ => $.detail.receivedQty)}</th>
                  <th className="w-24 pb-2 pr-3 font-medium">{t($ => $.detail.remainingQty)}</th>
                  <th className="w-32 pb-2 pr-3 font-medium">{t($ => $.detail.unitPrice)}</th>
                  <th className="w-32 pb-2 font-medium text-end">{t($ => $.detail.lineTotal)}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.lines.map((line) => {
                  const pct = line.quantity > 0 ? Math.min(100, (line.received_qty / line.quantity) * 100) : 0;
                  return (
                    <tr key={line.id}>
                      <td className="py-2 pr-3">
                        <span className="font-medium">{line.product?.name ?? '—'}</span>
                        {line.product?.sku && (
                          <span className="text-muted-foreground ml-1.5 text-xs">{line.product.sku}</span>
                        )}
                        {line.quantity > 0 && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <div className="h-1 w-24 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-muted-foreground text-xs">{Math.round(pct)}%</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3">{line.quantity}</td>
                      <td className="py-2 pr-3">{line.received_qty}</td>
                      <td className="py-2 pr-3">{line.remaining_qty}</td>
                      <td className="py-2 pr-3">
                        {fmt(line.unit_price)}
                      </td>
                      <td className="py-2 text-end font-medium">
                        {fmt(line.line_total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial summary */}
          <div className="flex flex-col items-end gap-1 border-t pt-3 text-sm">
            <div className="flex gap-8">
              <span className="text-muted-foreground">{t($ => $.detail.subtotal)}</span>
              <span className="w-32 text-end font-medium">{fmt(order.subtotal)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex gap-8">
                <span className="text-muted-foreground">{t($ => $.detail.discount)}</span>
                <span className="w-32 text-end font-medium">- {fmt(order.discount_amount)}</span>
              </div>
            )}
            {order.shipping_amount > 0 && (
              <div className="flex gap-8">
                <span className="text-muted-foreground">{t($ => $.detail.shipping)}</span>
                <span className="w-32 text-end font-medium">{fmt(order.shipping_amount)}</span>
              </div>
            )}
            {order.additional_costs > 0 && (
              <div className="flex gap-8">
                <span className="text-muted-foreground">{t($ => $.detail.additionalCosts)}</span>
                <span className="w-32 text-end font-medium">{fmt(order.additional_costs)}</span>
              </div>
            )}
            <div className="flex gap-8 text-base font-semibold">
              <span>{t($ => $.detail.grandTotal)}</span>
              <span className="w-32 text-end">{fmt(order.grand_total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={submitting}
        onOpenChange={setSubmitting}
        title={t($ => $.dialogs.submit.title)}
        description={t($ => $.dialogs.submit.description, { number: order.po_number })}
        confirmLabel={t($ => $.dialogs.submit.confirm)}
        loading={submitPO.isPending}
        onConfirm={() => {
          submitPO.mutate(order.id, { onSuccess: () => setSubmitting(false) });
        }}
      />

      <ConfirmDialog
        open={approving}
        onOpenChange={setApproving}
        title={t($ => $.dialogs.approve.title)}
        description={t($ => $.dialogs.approve.description, { number: order.po_number })}
        confirmLabel={t($ => $.dialogs.approve.confirm)}
        loading={approvePO.isPending}
        onConfirm={() => {
          approvePO.mutate(order.id, { onSuccess: () => setApproving(false) });
        }}
      />

      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t($ => $.dialogs.cancel.title)}
        description={t($ => $.dialogs.cancel.description, { number: order.po_number })}
        confirmLabel={t($ => $.dialogs.cancel.confirm)}
        variant="destructive"
        loading={cancelPO.isPending}
        onConfirm={() => {
          cancelPO.mutate(order.id, { onSuccess: () => setCancelling(false) });
        }}
      />
    </div>
  );
}
