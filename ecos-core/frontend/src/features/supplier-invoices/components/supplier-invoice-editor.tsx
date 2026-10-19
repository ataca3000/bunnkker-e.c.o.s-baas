import { useCallback, useEffect, useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Zap } from 'lucide-react';
import { toast } from '@/components/ds/use-toast';

import { Combobox } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useSupplierOptions } from '@/features/purchase-orders/hooks/use-supplier-options';
import { useWarehouseOptions } from '@/features/goods-receipts/hooks/use-warehouse-options';
import { useProductsQuery } from '@/features/products/hooks/use-products';
import { useCreateSupplierInvoice } from '@/features/supplier-invoices/hooks/use-supplier-invoices';
import type {
  CreateSupplierInvoicePayload,
  SupplierInvoiceLinePayload,
} from '@/features/supplier-invoices/types/supplier-invoice';

type LineState = {
  product_id: string;
  product_name: string;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
};

const EMPTY_LINE: LineState = {
  product_id:   '',
  product_name: '',
  description:  '',
  quantity:     '1',
  unit_price:   '',
  tax_rate:     '15',
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SupplierInvoiceEditor({ open, onOpenChange }: Props) {
  const { currency } = useFormatter();
  const { t } = useTranslation('supplier-invoices');
  const { data: supplierOptions = [] } = useSupplierOptions();
  const { data: warehouseOptions = [] } = useWarehouseOptions();
  const { data: productsData }          = useProductsQuery({ per_page: 200 });
  const createMutation                  = useCreateSupplierInvoice();

  const productOptions = (productsData?.items ?? []).map(p => ({
    value: p.id,
    label: `${p.sku} — ${p.name}`,
  }));

  const [supplierId,    setSupplierId]    = useState('');
  const [warehouseId,   setWarehouseId]   = useState('');
  const [invoiceDate,   setInvoiceDate]   = useState(new Date().toISOString().slice(0, 10));
  const [dueDate,       setDueDate]       = useState('');
  const [supplierRef,   setSupplierRef]   = useState('');
  const [freight,       setFreight]       = useState('0');
  const [additional,    setAdditional]    = useState('0');
  const [notes,         setNotes]         = useState('');
  const [lines,         setLines]         = useState<LineState[]>([{ ...EMPTY_LINE }]);

  useEffect(() => {
    if (!open) {
      setSupplierId('');
      setWarehouseId('');
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setDueDate('');
      setSupplierRef('');
      setFreight('0');
      setAdditional('0');
      setNotes('');
      setLines([{ ...EMPTY_LINE }]);
    }
  }, [open]);

  const addLine = () => setLines(prev => [...prev, { ...EMPTY_LINE }]);

  const removeLine = (i: number) =>
    setLines(prev => prev.filter((_, idx) => idx !== i));

  const updateLine = useCallback((i: number, field: keyof LineState, value: string) => {
    setLines(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'product_id') {
        const opt = productOptions.find(p => p.value === value);
        if (opt) next[i].product_name = opt.label;
      }
      return next;
    });
  }, [productOptions]);

  const lineTotal = (line: LineState) => {
    const qty   = parseFloat(line.quantity)   || 0;
    const price = parseFloat(line.unit_price) || 0;
    const tax   = parseFloat(line.tax_rate)   || 0;
    const sub   = qty * price;
    return sub + (sub * tax / 100);
  };

  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0)
    + (parseFloat(freight) || 0)
    + (parseFloat(additional) || 0);

  const handleSubmit = async () => {
    if (!supplierId) { toast.error(t($ => $.editor.toast.supplierRequired)); return; }
    if (!warehouseId) { toast.error(t($ => $.editor.toast.warehouseRequired)); return; }
    if (!invoiceDate) { toast.error(t($ => $.editor.toast.invoiceDateRequired)); return; }
    const validLines = lines.filter(l => l.product_id && parseFloat(l.quantity) > 0 && parseFloat(l.unit_price) >= 0);
    if (validLines.length === 0) {
      toast.error(t($ => $.editor.toast.atLeastOneItem));
      return;
    }

    const payload: CreateSupplierInvoicePayload = {
      supplier_id:         supplierId,
      warehouse_id:        warehouseId,
      invoice_date:        invoiceDate,
      due_date:            dueDate || null,
      supplier_invoice_ref: supplierRef || null,
      freight_amount:      parseFloat(freight) || 0,
      additional_costs:    parseFloat(additional) || 0,
      notes:               notes || null,
      lines: validLines.map((l): SupplierInvoiceLinePayload => ({
        product_id:   l.product_id,
        description:  l.description || null,
        quantity:     parseFloat(l.quantity),
        unit_price:   parseFloat(l.unit_price),
        tax_rate:     parseFloat(l.tax_rate) || 0,
      })),
    };

    await createMutation.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            {t($ => $.editor.title)}
          </SheetTitle>
          <p className="text-xs text-gray-500">
            {t($ => $.editor.subtitle)}
          </p>
        </SheetHeader>

        <div className="space-y-5">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t($ => $.editor.fields.supplier)}</Label>
              <div className="mt-1">
                <Combobox
                  options={supplierOptions}
                  value={supplierId}
                  onChange={setSupplierId}
                  placeholder={t($ => $.editor.placeholders.selectSupplier)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t($ => $.editor.fields.warehouse)}</Label>
              <div className="mt-1">
                <Combobox
                  options={warehouseOptions}
                  value={warehouseId}
                  onChange={setWarehouseId}
                  placeholder={t($ => $.editor.placeholders.selectWarehouse)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t($ => $.editor.fields.invoiceDate)}</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">{t($ => $.editor.fields.dueDate)}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{t($ => $.editor.fields.supplierRef)}</Label>
              <Input
                value={supplierRef}
                onChange={e => setSupplierRef(e.target.value)}
                placeholder={t($ => $.editor.placeholders.supplierRef)}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold uppercase">{t($ => $.editor.items.title)}</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addLine}>
                <Plus className="w-3 h-3" />
                {t($ => $.editor.items.addItem)}
              </Button>
            </div>

            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 px-1">
                <span className="col-span-4 text-xs text-gray-400">{t($ => $.editor.items.columns.product)}</span>
                <span className="col-span-2 text-xs text-gray-400">{t($ => $.editor.items.columns.qty)}</span>
                <span className="col-span-2 text-xs text-gray-400">{t($ => $.editor.items.columns.unitPrice)}</span>
                <span className="col-span-2 text-xs text-gray-400">{t($ => $.editor.items.columns.vatPct)}</span>
                <span className="col-span-1 text-xs text-gray-400 text-end">{t($ => $.editor.items.columns.total)}</span>
                <span className="col-span-1" />
              </div>

              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <Combobox
                      options={productOptions}
                      value={line.product_id}
                      onChange={v => updateLine(i, 'product_id', v)}
                      placeholder={t($ => $.editor.placeholders.selectProduct)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={line.quantity}
                      onChange={e => updateLine(i, 'quantity', e.target.value)}
                      className="h-9 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unit_price}
                      onChange={e => updateLine(i, 'unit_price', e.target.value)}
                      className="h-9 text-sm text-right"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={line.tax_rate}
                      onChange={e => updateLine(i, 'tax_rate', e.target.value)}
                      className="h-9 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-1 text-end">
                    <span className="text-sm font-medium text-gray-700">
                      {lineTotal(line).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                      onClick={() => removeLine(i)}
                      disabled={lines.length === 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Cost additions + summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t($ => $.editor.additionalCosts.freight)}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={freight}
                  onChange={e => setFreight(e.target.value)}
                  className="mt-1 h-9 text-sm text-right"
                />
              </div>
              <div>
                <Label className="text-xs">{t($ => $.editor.additionalCosts.additionalCosts)}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={additional}
                  onChange={e => setAdditional(e.target.value)}
                  className="mt-1 h-9 text-sm text-right"
                />
              </div>
              <div>
                <Label className="text-xs">{t($ => $.editor.fields.notes)}</Label>
                <Input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t($ => $.editor.fields.notesPlaceholder)}
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2 self-start">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t($ => $.editor.summary.subtotal)}</span>
                <span>{lines.reduce((s, l) => s + lineTotal(l), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {parseFloat(freight) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t($ => $.editor.summary.freight)}</span>
                  <span>{parseFloat(freight).toLocaleString()}</span>
                </div>
              )}
              {parseFloat(additional) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t($ => $.editor.summary.additionalCosts)}</span>
                  <span>{parseFloat(additional).toLocaleString()}</span>
                </div>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between text-sm font-semibold">
                <span>{t($ => $.editor.summary.grandTotal)} ({currency})</span>
                <span className="text-gray-900">{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <Button
              className="flex-1 gap-1.5"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              <Zap className="w-3.5 h-3.5" />
              {createMutation.isPending ? t($ => $.editor.buttons.creating) : t($ => $.editor.buttons.create)}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t($ => $.editor.buttons.cancel)}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
