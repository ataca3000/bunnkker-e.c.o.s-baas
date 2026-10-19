import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EntityForm, PageHeader } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PurchaseOrderHeaderFields } from '@/features/purchase-orders/components/purchase-order-header-fields';
import { PurchaseOrderLinesEditor } from '@/features/purchase-orders/components/purchase-order-lines-editor';
import { PurchaseOrderTotalsLive } from '@/features/purchase-orders/components/purchase-order-totals-live';
import {
  purchaseOrderSchema,
  toFormValues,
  toPayload,
  type PurchaseOrderFormValues,
} from '@/features/purchase-orders/components/purchase-order-form-schema';
import {
  usePurchaseOrderQuery,
  useUpdatePurchaseOrder,
} from '@/features/purchase-orders/hooks/use-purchase-orders';
import { ROUTES } from '@/router/routes';

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

const FORM_ID = 'edit-po-form';

export function EditPurchaseOrderPage() {
  const { t } = useTranslation('purchase-orders');
  const { t: tCommon } = useTranslation('common');
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading } = usePurchaseOrderQuery(id);
  const updatePO = useUpdatePurchaseOrder();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: toFormValues(null),
  });

  useEffect(() => {
    if (order) {
      form.reset(toFormValues(order));
    }
  }, [order, form]);

  if (!isLoading && order && order.status !== 'draft') {
    navigate(`${ROUTES.purchaseOrders}/${id}`, { replace: true });
    return null;
  }

  const handleSubmit = (values: PurchaseOrderFormValues) => {
    setServerError(null);
    updatePO.mutate(
      { id, payload: toPayload(values) },
      {
        onSuccess: (po) => navigate(`${ROUTES.purchaseOrders}/${po.id}`),
        onError: (error) => setServerError(extractMessage(error)),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={isLoading ? t($ => $.detail.loading) : `${t($ => $.edit.title)} ${order?.po_number ?? ''}`}
        subtitle={t($ => $.edit.subtitle)}
        breadcrumbs={[
          { label: tCommon($ => $.home), to: ROUTES.dashboard },
          { label: t($ => $.title), to: ROUTES.purchaseOrders },
          { label: order?.po_number ?? '…' },
        ]}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(`${ROUTES.purchaseOrders}/${id}`)}>
              {tCommon($ => $.common.cancel)}
            </Button>
            <Button type="submit" form={FORM_ID} disabled={updatePO.isPending || isLoading}>
              {updatePO.isPending ? t($ => $.edit.saving) : t($ => $.edit.submitEdit)}
            </Button>
          </>
        }
      />

      {serverError ? (
        <Alert variant="destructive">
          <AlertTitle>{t($ => $.edit.errorTitle)}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <EntityForm form={form} id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t($ => $.create.orderDetails)}</CardTitle>
          </CardHeader>
          <CardContent>
            <PurchaseOrderHeaderFields />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t($ => $.lines.title)}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <PurchaseOrderLinesEditor />
            <PurchaseOrderTotalsLive />
          </CardContent>
        </Card>
      </EntityForm>
    </div>
  );
}
