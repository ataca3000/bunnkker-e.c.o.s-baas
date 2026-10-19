import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Combobox } from '@/components/crud/combobox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePaymentMethods, useShippingCompanies } from '@/features/orders/hooks/use-orders';
import { useProductOptions } from '@/features/orders/hooks/use-product-options';
import type { DatePreset } from '@/features/orders/types/order';
import { cn } from '@/lib/utils';

export type AdvancedFilterValues = {
  productId: string | null;
  paymentMethod: string | null;
  paymentStatus: 'paid' | 'partial' | 'unpaid' | null;
  hasPaymentProof: boolean | null;
  reservationStatus: 'reserved' | 'not_reserved' | null;
  shippingCompany: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  datePreset: DatePreset | null;
  governorate: string | null;
  city: string | null;
  zone: string | null;
  minAmount: string | null;
  maxAmount: string | null;
};

type Props = {
  values: AdvancedFilterValues;
  onChange: (next: AdvancedFilterValues) => void;
  onClear: () => void;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium text-muted-foreground">{children}</span>
  );
}

function computeDates(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  };

  switch (preset) {
    case 'today':
      return { from: fmt(today), to: fmt(today) };
    case 'yesterday': {
      const y = daysAgo(1);
      return { from: fmt(y), to: fmt(y) };
    }
    case 'last_7_days':
      return { from: fmt(daysAgo(6)), to: fmt(today) };
    case 'last_30_days':
      return { from: fmt(daysAgo(29)), to: fmt(today) };
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: fmt(start), to: fmt(today) };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end   = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(start), to: fmt(end) };
    }
    default:
      return { from: '', to: '' };
  }
}

const DATE_PRESETS: DatePreset[] = [
  'today', 'yesterday', 'last_7_days', 'last_30_days', 'this_month', 'last_month', 'custom',
];

export function OrderAdvancedFilters({ values, onChange, onClear }: Props) {
  const { t } = useTranslation('orders');
  const { data: productOptions = [], isLoading: loadingProducts } = useProductOptions();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: shippingCompanies = [] } = useShippingCompanies();

  function set<K extends keyof AdvancedFilterValues>(key: K, val: AdvancedFilterValues[K]) {
    onChange({ ...values, [key]: val });
  }

  function applyPreset(preset: DatePreset) {
    if (preset === 'custom') {
      onChange({ ...values, datePreset: 'custom' });
      return;
    }
    const { from, to } = computeDates(preset);
    onChange({ ...values, datePreset: preset, dateFrom: from || null, dateTo: to || null });
  }

  const hasAny = Object.values(values).some(Boolean);

  const paymentOptions = paymentMethods.map((m) => ({ value: m, label: m }));
  const shippingOptions = shippingCompanies.map((s) => ({ value: s, label: s }));

  return (
    <div className="border-b bg-muted/30 px-4 py-3 space-y-3">
      {/* Date presets row */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <FieldLabel>{t($ => $.filters.dateRange)}</FieldLabel>
          {hasAny ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear} className="h-6 px-2 text-xs">
              <X className="size-3 mr-1" />
              {t($ => $.filters.clearAll)}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                values.datePreset === preset
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent',
              )}
            >
              {t($ => $.filters.datePreset[preset])}
            </button>
          ))}
        </div>

        {/* Manual date inputs — shown when preset is custom or dates are set without preset */}
        {(values.datePreset === 'custom' || values.datePreset === null) && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <FieldLabel>{t($ => $.filters.dateFrom)}</FieldLabel>
              <input
                type="date"
                value={values.dateFrom ?? ''}
                onChange={(e) => {
                  onChange({ ...values, dateFrom: e.target.value || null, datePreset: 'custom' });
                }}
                className={cn(
                  'h-8 w-full rounded-md border border-input bg-background px-3 text-sm',
                  'text-foreground focus:outline-none focus:ring-1 focus:ring-ring',
                )}
              />
            </div>
            <div>
              <FieldLabel>{t($ => $.filters.dateTo)}</FieldLabel>
              <input
                type="date"
                value={values.dateTo ?? ''}
                min={values.dateFrom ?? undefined}
                onChange={(e) => {
                  onChange({ ...values, dateTo: e.target.value || null, datePreset: 'custom' });
                }}
                className={cn(
                  'h-8 w-full rounded-md border border-input bg-background px-3 text-sm',
                  'text-foreground focus:outline-none focus:ring-1 focus:ring-ring',
                )}
              />
            </div>
          </div>
        )}
      </div>

      {/* Other filters row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {/* Governorate */}
        <div>
          <FieldLabel>{t($ => $.filters.governorate)}</FieldLabel>
          <input
            type="text"
            value={values.governorate ?? ''}
            onChange={(e) => set('governorate', e.target.value || null)}
            placeholder={t($ => $.filters.allGovernorates)}
            className={cn(
              'h-8 w-full rounded-md border border-input bg-background px-3 text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            )}
          />
          {values.governorate ? (
            <button
              type="button"
              onClick={() => set('governorate', null)}
              className="mt-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              {t($ => $.filters.clearField)}
            </button>
          ) : null}
        </div>

        {/* City */}
        <div>
          <FieldLabel>{t($ => $.filters.city)}</FieldLabel>
          <input
            type="text"
            value={values.city ?? ''}
            onChange={(e) => set('city', e.target.value || null)}
            placeholder={t($ => $.filters.allCities)}
            className={cn(
              'h-8 w-full rounded-md border border-input bg-background px-3 text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            )}
          />
          {values.city ? (
            <button
              type="button"
              onClick={() => set('city', null)}
              className="mt-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              {t($ => $.filters.clearField)}
            </button>
          ) : null}
        </div>

        {/* Zone */}
        <div>
          <FieldLabel>{t($ => $.filters.zone)}</FieldLabel>
          <input
            type="text"
            value={values.zone ?? ''}
            onChange={(e) => set('zone', e.target.value || null)}
            placeholder={t($ => $.filters.allZones)}
            className={cn(
              'h-8 w-full rounded-md border border-input bg-background px-3 text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            )}
          />
        </div>

        {/* Payment Status */}
        <div>
          <FieldLabel>{t($ => $.filters.paymentStatus)}</FieldLabel>
          <Select
            value={values.paymentStatus ?? ''}
            onValueChange={(v) => set('paymentStatus', (v || null) as AdvancedFilterValues['paymentStatus'])}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t($ => $.filters.all)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t($ => $.filters.all)}</SelectItem>
              <SelectItem value="paid">{t($ => $.filters.paid)}</SelectItem>
              <SelectItem value="partial">{t($ => $.filters.partial)}</SelectItem>
              <SelectItem value="unpaid">{t($ => $.filters.unpaid)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Reservation Status */}
        <div>
          <FieldLabel>{t($ => $.filters.inventory)}</FieldLabel>
          <Select
            value={values.reservationStatus ?? ''}
            onValueChange={(v) => set('reservationStatus', (v || null) as AdvancedFilterValues['reservationStatus'])}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t($ => $.filters.all)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t($ => $.filters.all)}</SelectItem>
              <SelectItem value="reserved">{t($ => $.filters.reserved)}</SelectItem>
              <SelectItem value="not_reserved">{t($ => $.filters.notReserved)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Has Payment Proof */}
        <div>
          <FieldLabel>{t($ => $.filters.paymentProof)}</FieldLabel>
          <Select
            value={values.hasPaymentProof === null ? '' : values.hasPaymentProof ? 'yes' : 'no'}
            onValueChange={(v) => set('hasPaymentProof', v === '' ? null : v === 'yes')}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder={t($ => $.filters.any)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t($ => $.filters.any)}</SelectItem>
              <SelectItem value="yes">{t($ => $.filters.withProof)}</SelectItem>
              <SelectItem value="no">{t($ => $.filters.withoutProof)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Amount Range */}
        <div>
          <FieldLabel>{t($ => $.filters.minAmount)}</FieldLabel>
          <input
            type="number"
            min={0}
            value={values.minAmount ?? ''}
            onChange={(e) => set('minAmount', e.target.value || null)}
            placeholder="0"
            className={cn(
              'h-8 w-full rounded-md border border-input bg-background px-3 text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            )}
          />
        </div>

        <div>
          <FieldLabel>{t($ => $.filters.maxAmount)}</FieldLabel>
          <input
            type="number"
            min={0}
            value={values.maxAmount ?? ''}
            onChange={(e) => set('maxAmount', e.target.value || null)}
            placeholder="∞"
            className={cn(
              'h-8 w-full rounded-md border border-input bg-background px-3 text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            )}
          />
        </div>

        {/* Product */}
        <div>
          <FieldLabel>{t($ => $.filters.product)}</FieldLabel>
          <Combobox
            options={productOptions}
            value={values.productId}
            onChange={(v) => set('productId', v)}
            placeholder={t($ => $.filters.allProducts)}
            searchPlaceholder={t($ => $.filters.searchProduct)}
            loading={loadingProducts}
            className="h-8"
          />
          {values.productId ? (
            <button
              type="button"
              onClick={() => set('productId', null)}
              className="mt-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              {t($ => $.filters.clearField)}
            </button>
          ) : null}
        </div>

        {/* Payment Method — dynamic dropdown */}
        <div>
          <FieldLabel>{t($ => $.filters.paymentMethod)}</FieldLabel>
          {paymentOptions.length > 0 ? (
            <Select
              value={values.paymentMethod ?? ''}
              onValueChange={(v) => set('paymentMethod', v || null)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder={t($ => $.filters.allPaymentMethods)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{t($ => $.filters.allPaymentMethods)}</SelectItem>
                {paymentOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <input
              type="text"
              value={values.paymentMethod ?? ''}
              onChange={(e) => set('paymentMethod', e.target.value || null)}
              placeholder={t($ => $.filters.paymentMethodPlaceholder)}
              className={cn(
                'h-8 w-full rounded-md border border-input bg-background px-3 text-sm',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
              )}
            />
          )}
        </div>

        {/* Shipping Company — dynamic combobox */}
        <div>
          <FieldLabel>{t($ => $.filters.shippingCompany)}</FieldLabel>
          {shippingOptions.length > 0 ? (
            <Combobox
              options={shippingOptions}
              value={values.shippingCompany}
              onChange={(v) => set('shippingCompany', v)}
              placeholder={t($ => $.filters.allShippingCompanies)}
              searchPlaceholder={t($ => $.filters.searchShippingCompany)}
              className="h-8"
            />
          ) : (
            <input
              type="text"
              value={values.shippingCompany ?? ''}
              onChange={(e) => set('shippingCompany', e.target.value || null)}
              placeholder={t($ => $.filters.shippingCompanyPlaceholder)}
              className={cn(
                'h-8 w-full rounded-md border border-input bg-background px-3 text-sm',
                'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
              )}
            />
          )}
          {values.shippingCompany ? (
            <button
              type="button"
              onClick={() => set('shippingCompany', null)}
              className="mt-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              {t($ => $.filters.clearField)}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
