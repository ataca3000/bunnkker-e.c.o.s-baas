import { useEffect, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Paperclip, X } from 'lucide-react';

import { FormField } from '@/components/crud';
import { Combobox } from '@/components/crud/combobox';
import { Input } from '@/components/ui/input';
import type { GoodsReceiptFormValues } from '@/features/goods-receipts/components/goods-receipt-form-schema';
import { useApprovedPoOptions } from '@/features/goods-receipts/hooks/use-approved-po-options';
import { useWarehouseOptions } from '@/features/goods-receipts/hooks/use-warehouse-options';
import { purchaseOrdersService } from '@/features/purchase-orders/services/purchase-orders-service';

export type PoLineInfo = {
  id: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  orderedQty: number;
};

type Props = {
  readOnly?: boolean;
  onPoLinesLoaded?: (infos: PoLineInfo[]) => void;
};

const selectClass =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50';

export function GoodsReceiptHeaderFields({ readOnly = false, onPoLinesLoaded }: Props) {
  const { t } = useTranslation('goods-receipts');
  const { register, control, watch, setValue } =
    useFormContext<GoodsReceiptFormValues>();

  const { data: poOptions = [], isLoading: loadingPOs } = useApprovedPoOptions();
  const { data: warehouseOptions = [], isLoading: loadingWarehouses } = useWarehouseOptions();

  const selectedPoId         = watch('purchase_order_id');
  const invoiceAttachmentPath = watch('invoice_attachment_path');
  const invoiceAttachment     = watch('invoice_attachment');
  const supplierInvoiceDate  = watch('supplier_invoice_date');
  const paymentTermsDays     = watch('payment_terms_days');
  const invoiceInputRef      = useRef<HTMLInputElement>(null);

  const { data: poDetail } = useQuery({
    queryKey: ['po-detail-for-gr', selectedPoId],
    queryFn: () => purchaseOrdersService.get(selectedPoId),
    enabled: Boolean(selectedPoId) && !readOnly,
  });

  useEffect(() => {
    if (!poDetail || readOnly) return;

    const formLines = poDetail.lines.map((l) => ({
      purchase_order_line_id: l.id,
      product_id: l.product_id,
      ordered_quantity: l.quantity,
      gross_received_quantity: '',
      net_received_quantity: '',
      unit_price: l.unit_price ?? 0,
      weight_photo: null,
      weight_photo_path: null,
      notes: '',
    }));
    setValue('lines', formLines, { shouldValidate: false });

    const infos: PoLineInfo[] = poDetail.lines.map((l) => ({
      id: l.id,
      productName: l.product?.name ?? '—',
      productSku: l.product?.sku ?? '',
      unitPrice: l.unit_price ?? 0,
      orderedQty: l.quantity,
    }));
    onPoLinesLoaded?.(infos);
  }, [poDetail, readOnly, setValue, onPoLinesLoaded]);

  // Auto-calculate payment due date from invoice date + terms days
  useEffect(() => {
    if (readOnly || !supplierInvoiceDate || !paymentTermsDays) return;
    const days = Number(paymentTermsDays);
    if (!Number.isFinite(days) || days < 0) return;
    const date = new Date(supplierInvoiceDate);
    date.setDate(date.getDate() + days);
    setValue('payment_due_date', date.toISOString().slice(0, 10), { shouldValidate: false });
  }, [supplierInvoiceDate, paymentTermsDays, readOnly, setValue]);

  return (
    <div className="space-y-6">
      {/* ── Core receipt fields ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField name="purchase_order_id" label={t($ => $.form.purchaseOrder.label)} required>
            <Controller
              control={control}
              name="purchase_order_id"
              render={({ field }) => (
                <Combobox
                  options={poOptions}
                  value={field.value || null}
                  onChange={field.onChange}
                  placeholder={t($ => $.form.purchaseOrder.placeholder)}
                  loading={loadingPOs}
                  disabled={readOnly}
                />
              )}
            />
          </FormField>
        </div>

        <div className="sm:col-span-2">
          <FormField name="warehouse_id" label={t($ => $.form.warehouse.label)} required>
            <Controller
              control={control}
              name="warehouse_id"
              render={({ field }) => (
                <Combobox
                  options={warehouseOptions}
                  value={field.value || null}
                  onChange={field.onChange}
                  placeholder={t($ => $.form.warehouse.placeholder)}
                  loading={loadingWarehouses}
                  disabled={readOnly}
                />
              )}
            />
          </FormField>
        </div>

        <FormField name="receipt_date" label={t($ => $.form.receiptDate)} required>
          <Input type="date" disabled={readOnly} {...register('receipt_date')} />
        </FormField>

        <div className="sm:col-span-2">
          <FormField name="notes" label={t($ => $.form.notes.label)}>
            <textarea
              rows={2}
              placeholder={t($ => $.form.notes.placeholder)}
              disabled={readOnly}
              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
              {...register('notes')}
            />
          </FormField>
        </div>
      </div>

      {/* ── Supplier invoice ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-foreground mb-3 text-sm font-semibold">{t($ => $.form.supplierInvoice.title)}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField name="supplier_invoice_number" label={t($ => $.form.supplierInvoice.number)}>
            <Input
              type="text"
              placeholder="INV-001"
              disabled={readOnly}
              {...register('supplier_invoice_number')}
            />
          </FormField>

          <FormField name="supplier_invoice_date" label={t($ => $.form.supplierInvoice.date)}>
            <Input type="date" disabled={readOnly} {...register('supplier_invoice_date')} />
          </FormField>

          <div className="sm:col-span-2">
            <FormField name="invoice_attachment" label={t($ => $.form.supplierInvoice.attachment)}>
              {readOnly ? (
                invoiceAttachmentPath ? (
                  <a
                    href={invoiceAttachmentPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center gap-1.5 text-sm underline"
                  >
                    <Paperclip className="size-3.5" />
                    {t($ => $.form.supplierInvoice.viewAttachment)}
                  </a>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    ref={invoiceInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setValue('invoice_attachment', file, { shouldValidate: true });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => invoiceInputRef.current?.click()}
                    className="border-input text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm"
                  >
                    <Paperclip className="size-3.5" />
                    {invoiceAttachment instanceof File
                      ? invoiceAttachment.name
                      : invoiceAttachmentPath
                        ? t($ => $.form.supplierInvoice.changeAttachment)
                        : t($ => $.form.supplierInvoice.uploadAttachment)}
                  </button>
                  {(invoiceAttachment instanceof File || invoiceAttachmentPath) && (
                    <button
                      type="button"
                      onClick={() => {
                        setValue('invoice_attachment', null);
                        setValue('invoice_attachment_path', null);
                        if (invoiceInputRef.current) invoiceInputRef.current.value = '';
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-muted-foreground mt-1 text-xs">{t($ => $.form.supplierInvoice.attachmentHint)}</p>
            </FormField>
          </div>
        </div>
      </div>

      {/* ── Invoice financials ───────────────────────────────────────────── */}
      <div>
        <h3 className="text-foreground mb-3 text-sm font-semibold">{t($ => $.form.invoiceFinancials.title)}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField name="invoice_total_amount" label={t($ => $.form.invoiceFinancials.totalAmount)}>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              disabled={readOnly}
              {...register('invoice_total_amount')}
            />
          </FormField>
          <FormField name="paid_amount" label={t($ => $.form.invoiceFinancials.paidAmount)}>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              disabled={readOnly}
              {...register('paid_amount')}
            />
          </FormField>
          <FormField name="freight_amount" label={t($ => $.form.invoiceFinancials.freight)}>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              disabled={readOnly}
              {...register('freight_amount')}
            />
          </FormField>
          <FormField name="tax_amount" label={t($ => $.form.invoiceFinancials.tax)}>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              disabled={readOnly}
              {...register('tax_amount')}
            />
          </FormField>
          <FormField name="additional_costs" label={t($ => $.form.invoiceFinancials.additionalCosts)}>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              disabled={readOnly}
              {...register('additional_costs')}
            />
          </FormField>
        </div>
      </div>

      {/* ── Payment information ──────────────────────────────────────────── */}
      <div>
        <h3 className="text-foreground mb-3 text-sm font-semibold">{t($ => $.form.paymentInfo.title)}</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField name="payment_status" label={t($ => $.form.paymentInfo.status)}>
            <select disabled={readOnly} className={selectClass} {...register('payment_status')}>
              <option value="unpaid">{t($ => $.paymentStatus.unpaid)}</option>
              <option value="partially_paid">{t($ => $.paymentStatus.partiallyPaid)}</option>
              <option value="paid">{t($ => $.paymentStatus.paid)}</option>
            </select>
          </FormField>

          <FormField name="payment_method" label={t($ => $.form.paymentInfo.method)}>
            <select disabled={readOnly} className={selectClass} {...register('payment_method')}>
              <option value="">—</option>
              <option value="cash">{t($ => $.paymentMethod.cash)}</option>
              <option value="bank_transfer">{t($ => $.paymentMethod.bankTransfer)}</option>
              <option value="cheque">{t($ => $.paymentMethod.cheque)}</option>
              <option value="wallet">{t($ => $.paymentMethod.wallet)}</option>
              <option value="credit">{t($ => $.paymentMethod.credit)}</option>
              <option value="other">{t($ => $.paymentMethod.other)}</option>
            </select>
          </FormField>

          <FormField name="payment_terms_days" label={t($ => $.form.paymentInfo.termsDays)}>
            <select disabled={readOnly} className={selectClass} {...register('payment_terms_days')}>
              <option value="">—</option>
              <option value="0">{t($ => $.form.paymentInfo.termsImmediate)}</option>
              <option value="7">Net 7</option>
              <option value="15">Net 15</option>
              <option value="30">Net 30</option>
              <option value="60">Net 60</option>
              <option value="90">Net 90</option>
            </select>
          </FormField>

          <FormField name="payment_due_date" label={t($ => $.form.paymentInfo.dueDate)}>
            <Input
              type="date"
              disabled={readOnly}
              {...register('payment_due_date')}
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
