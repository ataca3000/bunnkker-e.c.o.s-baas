import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
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
import {
  useGoodsReceiptQuery,
  useUpdateGoodsReceipt,
} from '@/features/goods-receipts/hooks/use-goods-receipts';
import { ROUTES } from '@/router/routes';

export function EditGoodsReceiptPage() {
  const { t } = useTranslation('goods-receipts');
  const { t: tCommon } = useTranslation('common');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const updateGR = useUpdateGoodsReceipt();

  const [overridePoLineInfos, setOverridePoLineInfos] = useState<PoLineInfo[] | null>(null);

  const { data: receipt, isLoading, isError } = useGoodsReceiptQuery(id ?? '');

  const form = useForm<GoodsReceiptFormValues>({
    resolver: zodResolver(goodsReceiptSchema),
    defaultValues: toFormValues(null),
  });

  useEffect(() => {
    if (!receipt) return;
    if (receipt.status !== 'draft') {
      navigate(`${ROUTES.goodsReceipts}/${receipt.id}`, { replace: true });
      return;
    }
    form.reset(toFormValues(receipt));
  }, [receipt, form, navigate]);

  const poLineInfos = useMemo<PoLineInfo[]>(() => {
    if (overridePoLineInfos !== null) return overridePoLineInfos;
    return (receipt?.lines ?? []).map((l) => ({
      id: l.purchase_order_line_id,
      productName: l.product?.name ?? '—',
      productSku: l.product?.sku ?? '',
      unitPrice: l.unit_price,
      orderedQty: l.ordered_quantity,
    }));
  }, [overridePoLineInfos, receipt]);

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

  const onSubmit = (values: GoodsReceiptFormValues) => {
    if (!id) return;
    updateGR.mutate(
      { id, payload: toFormData(values) },
      { onSuccess: () => navigate(`${ROUTES.goodsReceipts}/${id}`) },
    );
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-6">
          <PageHeader
            title={`${t($ => $.edit.title)} ${receipt.receipt_number}`}
            subtitle={t($ => $.edit.subtitle)}
            breadcrumbs={[
              { label: tCommon($ => $.home), to: ROUTES.dashboard },
              { label: t($ => $.title), to: ROUTES.goodsReceipts },
              { label: receipt.receipt_number, to: `${ROUTES.goodsReceipts}/${id}` },
              { label: t($ => $.edit.editLabel) },
            ]}
            actions={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`${ROUTES.goodsReceipts}/${id}`)}
                >
                  {tCommon($ => $.common.cancel)}
                </Button>
                <Button type="submit" disabled={updateGR.isPending}>
                  {updateGR.isPending ? t($ => $.edit.saving) : t($ => $.edit.submitEdit)}
                </Button>
              </div>
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>{t($ => $.detail.receiptDetails)}</CardTitle>
            </CardHeader>
            <CardContent>
              <GoodsReceiptHeaderFields onPoLinesLoaded={setOverridePoLineInfos} />
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
