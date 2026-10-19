import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PoLineInfo } from '@/features/goods-receipts/components/goods-receipt-header-fields';
import { GoodsReceiptHeaderFields } from '@/features/goods-receipts/components/goods-receipt-header-fields';
import { GoodsReceiptLinesEditor } from '@/features/goods-receipts/components/goods-receipt-lines-editor';
import {
  goodsReceiptSchema,
  toFormValues,
  toFormData,
  type GoodsReceiptFormValues,
} from '@/features/goods-receipts/components/goods-receipt-form-schema';
import { useCreateGoodsReceipt } from '@/features/goods-receipts/hooks/use-goods-receipts';
import { ROUTES } from '@/router/routes';

export function CreateGoodsReceiptPage() {
  const { t } = useTranslation('goods-receipts');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const createGR = useCreateGoodsReceipt();
  const [poLineInfos, setPoLineInfos] = useState<PoLineInfo[]>([]);

  const form = useForm<GoodsReceiptFormValues>({
    resolver: zodResolver(goodsReceiptSchema),
    defaultValues: toFormValues(null),
  });

  const onSubmit = (values: GoodsReceiptFormValues) => {
    createGR.mutate(toFormData(values), {
      onSuccess: (created) => {
        navigate(`${ROUTES.goodsReceipts}/${created.id}`);
      },
    });
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-6">
          <PageHeader
            title={t($ => $.create.title)}
            subtitle={t($ => $.create.subtitle)}
            breadcrumbs={[
              { label: tCommon($ => $.home), to: ROUTES.dashboard },
              { label: t($ => $.title), to: ROUTES.goodsReceipts },
              { label: t($ => $.create.new) },
            ]}
            actions={
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => navigate(ROUTES.goodsReceipts)}>
                  {tCommon($ => $.common.cancel)}
                </Button>
                <Button type="submit" disabled={createGR.isPending}>
                  {createGR.isPending ? t($ => $.create.creating) : t($ => $.create.submitCreate)}
                </Button>
              </div>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>{t($ => $.create.receiptDetails)}</CardTitle>
            </CardHeader>
            <CardContent>
              <GoodsReceiptHeaderFields onPoLinesLoaded={setPoLineInfos} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t($ => $.lines.title)}</CardTitle>
            </CardHeader>
            <CardContent>
              <GoodsReceiptLinesEditor poLineInfos={poLineInfos} />
            </CardContent>
          </Card>
        </div>
      </form>
    </FormProvider>
  );
}
