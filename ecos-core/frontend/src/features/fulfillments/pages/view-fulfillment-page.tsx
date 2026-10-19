import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog, PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FulfillmentStatusBadge } from '@/features/fulfillments/components/fulfillment-status-badge';
import {
  useCancelFulfillment,
  useFulfillFulfillment,
  useFulfillmentQuery,
} from '@/features/fulfillments/hooks/use-fulfillments';
import { ROUTES } from '@/router/routes';

function LabelValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm font-medium">{value ?? '—'}</span>
    </div>
  );
}

export function ViewFulfillmentPage() {
  const { t } = useTranslation('fulfillments');
  const { t: tCommon } = useTranslation('common');
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [confirmFulfill, setConfirmFulfill] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: fulfillment, isLoading, isError } = useFulfillmentQuery(id);
  const fulfill = useFulfillFulfillment();
  const cancel = useCancelFulfillment();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-muted-foreground text-sm">{t($ => $.detail.loading)}</span>
      </div>
    );
  }

  if (isError || !fulfillment) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-destructive text-sm">{t($ => $.detail.notFound)}</span>
      </div>
    );
  }

  const isPending = fulfillment.status === 'pending';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={fulfillment.fulfillment_number}
        subtitle={<FulfillmentStatusBadge status={fulfillment.status} />}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.title), to: ROUTES.fulfillments },
          { label: fulfillment.fulfillment_number },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate(ROUTES.fulfillments)}>
              {t($ => $.detail.back)}
            </Button>
            {isPending && (
              <>
                <Button onClick={() => setConfirmFulfill(true)}>
                  <CheckCircle className="size-4" />
                  {t($ => $.actions.fulfill)}
                </Button>
                <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
                  <XCircle className="size-4" />
                  {t($ => $.actions.cancel)}
                </Button>
              </>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t($ => $.detail.fulfillmentDetails)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <LabelValue label={t($ => $.detail.fulfillmentNumber)} value={fulfillment.fulfillment_number} />
            <LabelValue label={t($ => $.detail.order)} value={fulfillment.order?.order_number} />
            <LabelValue label={t($ => $.detail.customer)} value={fulfillment.order?.customer?.name} />
            <LabelValue label={t($ => $.detail.warehouse)} value={fulfillment.warehouse?.name} />
            <LabelValue label={t($ => $.detail.date)} value={fulfillment.fulfillment_date} />
            <LabelValue
              label={t($ => $.detail.status)}
              value={<FulfillmentStatusBadge status={fulfillment.status} />}
            />
          </div>
          {fulfillment.notes && (
            <div className="mt-4">
              <span className="text-muted-foreground text-xs">{t($ => $.detail.notes)}</span>
              <p className="mt-0.5 text-sm">{fulfillment.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t($ => $.detail.lineItems)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-start">
                  <th className="pb-2 pr-3 font-medium">{t($ => $.detail.product)}</th>
                  <th className="w-32 pb-2 font-medium">{t($ => $.detail.quantity)}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fulfillment.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{line.product?.name ?? '—'}</span>
                      {line.product?.sku && (
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          {line.product.sku}
                        </span>
                      )}
                    </td>
                    <td className="py-2">{line.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmFulfill}
        onOpenChange={setConfirmFulfill}
        title={t($ => $.dialogs.fulfill.title)}
        description={t($ => $.dialogs.fulfill.description, { number: fulfillment.fulfillment_number })}
        confirmLabel={t($ => $.dialogs.fulfill.confirm)}
        loading={fulfill.isPending}
        onConfirm={() => {
          fulfill.mutate(fulfillment.id, { onSuccess: () => setConfirmFulfill(false) });
        }}
      />

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t($ => $.dialogs.cancel.title)}
        description={t($ => $.dialogs.cancel.description, { number: fulfillment.fulfillment_number })}
        confirmLabel={t($ => $.dialogs.cancel.confirm)}
        variant="destructive"
        loading={cancel.isPending}
        onConfirm={() => {
          cancel.mutate(fulfillment.id, { onSuccess: () => setConfirmCancel(false) });
        }}
      />
    </div>
  );
}
