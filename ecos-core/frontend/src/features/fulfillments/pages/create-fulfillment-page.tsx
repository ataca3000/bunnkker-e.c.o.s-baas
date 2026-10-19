import { useEffect, useState } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import { EntityForm, PageHeader } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FulfillmentHeaderFields } from '@/features/fulfillments/components/fulfillment-header-fields';
import { FulfillmentLinesEditor } from '@/features/fulfillments/components/fulfillment-lines-editor';
import {
  fulfillmentSchema,
  toFormValues,
  toPayload,
  type FulfillmentFormValues,
} from '@/features/fulfillments/components/fulfillment-form-schema';
import { useCreateFulfillment } from '@/features/fulfillments/hooks/use-fulfillments';
import { ordersService } from '@/features/orders/services/orders-service';
import { ROUTES } from '@/router/routes';

const FORM_ID = 'fulfillment-form';

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

export function CreateFulfillmentPage() {
  const { t } = useTranslation('fulfillments');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const createFulfillment = useCreateFulfillment();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FulfillmentFormValues>({
    resolver: zodResolver(fulfillmentSchema),
    defaultValues: toFormValues(),
  });

  const selectedOrderId = useWatch({ control: form.control, name: 'order_id' });

  useEffect(() => {
    if (!selectedOrderId) return;

    ordersService.get(selectedOrderId).then((order) => {
      if (order.lines.length > 0) {
        form.setValue(
          'lines',
          order.lines.map((l) => ({
            product_id: l.product_id,
            quantity: String(l.quantity),
          })),
          { shouldValidate: false },
        );
      }
    }).catch(() => undefined);
  }, [selectedOrderId, form]);

  const handleSubmit = (values: FulfillmentFormValues) => {
    setServerError(null);
    createFulfillment.mutate(toPayload(values), {
      onSuccess: (fulfillment) => navigate(`${ROUTES.fulfillments}/${fulfillment.id}`),
      onError: (error) => setServerError(extractMessage(error)),
    });
  };

  return (
    <FormProvider {...form}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t($ => $.create.title)}
          subtitle={t($ => $.create.subtitle)}
          breadcrumbs={[
            { label: tCommon($ => $.home), to: ROUTES.dashboard },
            { label: t($ => $.title), to: ROUTES.fulfillments },
            { label: t($ => $.create.new) },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate(ROUTES.fulfillments)}>
                {tCommon($ => $.common.cancel)}
              </Button>
              <Button type="submit" form={FORM_ID} disabled={createFulfillment.isPending}>
                {createFulfillment.isPending ? t($ => $.create.creating) : t($ => $.create.submitCreate)}
              </Button>
            </div>
          }
        />

        {serverError ? (
          <Alert variant="destructive">
            <AlertTitle>{t($ => $.create.errorTitle)}</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <EntityForm form={form} id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t($ => $.create.fulfillmentDetails)}</CardTitle>
            </CardHeader>
            <CardContent>
              <FulfillmentHeaderFields />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t($ => $.create.lineItems)}</CardTitle>
            </CardHeader>
            <CardContent>
              <FulfillmentLinesEditor />
            </CardContent>
          </Card>
        </EntityForm>
      </div>
    </FormProvider>
  );
}
