import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { useNavigate } from 'react-router-dom';
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Shield,
  Trash2,
  Truck,
  Unlock,
  X,
} from 'lucide-react';

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { FormField, PageHeader } from '@/components/crud';
import { Combobox } from '@/components/crud/combobox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrderCustomerAlerts } from '@/features/orders/components/order-customer-alerts';
import { OrderCustomerIntelligencePanel } from '@/features/orders/components/order-customer-intelligence-panel';
import { OrderCustomerLookupField } from '@/features/orders/components/order-customer-lookup-field';
import { OrderInventoryStatusCard } from '@/features/orders/components/order-inventory-status-card';
import { OrderPaymentSection } from '@/features/orders/components/order-payment-section';
import { BrandConfigHealthCard } from '@/features/orders/components/brand-config-health-card';
import { ProductBrowser } from '@/features/orders/components/product-browser';
import {
  manualOrderSchema,
  toManualPayload,
  type ManualOrderFormValues,
  type ManualOrderLineFormValues,
} from '@/features/orders/components/order-form-schema';
import { useCreateManualOrder, useUpdateManualOrder, useBrandOrderPolicy, useShippingQuote } from '@/features/orders/hooks/use-orders';
import { useOrderDistributionStage } from '@/features/orders/hooks/use-order-distribution-stage';
import { ImpactAnalysisDialog } from '@/features/orders/components/impact-analysis-dialog';
import { OrderDistributionStageBanner } from '@/features/orders/components/order-distribution-stage-banner';
import { SmartStatusSelector } from '@/features/orders/components/smart-status-selector';
import { ordersService } from '@/features/orders/services/orders-service';
import { useProductPricing } from '@/features/orders/hooks/use-product-pricing';
import { useBrandOptions } from '@/features/brands/hooks/use-brand-options';
import {
  useBrandConfigHealth,
  useBrandDeliveryGeography,
  useBrandShippingGovernorates,
  useDeliveryTimeSlots,
} from '@/features/brands/hooks/use-brand-delivery';
import { useBrandShippingCities } from '@/features/brands/hooks/use-brand-shipping';
import { channelsService } from '@/features/channels/services/channels-service';
import { productsService } from '@/features/products/services/products-service';
import { useCompaniesQuery } from '@/features/companies/hooks/use-companies';
import type { CustomerLookupResult, Order } from '@/features/orders/types/order';
import type { Product } from '@/features/products/types/product';
import { getMediaUrl } from '@/lib/media';
import { ROUTES } from '@/router/routes';
import { parseGoogleMapsUrl, isGoogleMapsUrl } from '@/features/orders/utils/google-maps-parser';

const FORM_ID = 'manual-order-form';

const STATUS_LABELS: Record<string, string> = {
  new:               'New',
  in_progress:       'In Progress',
  ready_for_dispatch: 'Ready for Dispatch',
  out_for_delivery:  'Out for Delivery',
  delivered:         'Delivered',
  awaiting_payment:  'Awaiting Payment',
  awaiting_stock:    'Awaiting Stock',
  scheduled:         'Scheduled',
  on_hold:           'On Hold',
  cancelled:         'Cancelled',
  returned:          'Returned',
};

// Statuses managed exclusively by workflow automation — never selectable as manual entry points
const INTERNAL_STATUSES = new Set([
  'ready_for_loading',
]);

const MATCHING_POLICY_LABELS: Record<string, string> = {
  reuse_existing:   'Reuse Existing Customer',
  warn_only:        'Warn on Duplicate',
  block_duplicate:  'Block Duplicate',
  always_create_new:'Always Create New',
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod:           'Cash on Delivery',
  instapay:      'Instapay',
  mobile_wallet: 'Mobile Wallet',
  bank_transfer: 'Bank Transfer',
  credit_card:   'Credit Card',
};


// ── Inline hooks ──────────────────────────────────────────────────────────────

function useChannelsByBrand(brandId: string | null) {
  return useQuery({
    queryKey: ['channels-by-brand', brandId ?? ''],
    queryFn: () => channelsService.list({ brand_id: brandId!, per_page: 100, status: 'active' }),
    enabled: Boolean(brandId),
    staleTime: 5 * 60 * 1000,
    select: (d) => d.items.map((c) => ({ value: c.id, label: c.name })),
  });
}

function useFinishedProducts(channelId: string | null) {
  return useQuery({
    queryKey: ['products-fg-order', channelId ?? ''],
    queryFn: () =>
      productsService
        .list({ channel_id: channelId!, product_type: 'finished_good', per_page: 500, status: 'active' })
        .then((r) => r.items),
    enabled: Boolean(channelId),
    staleTime: 60_000,
  });
}

function useRawMaterials() {
  return useQuery({
    queryKey: ['products-rm-order'],
    queryFn: () =>
      productsService
        .list({ product_type: 'raw_material', per_page: 500, status: 'active' })
        .then((r) => r.items),
    staleTime: 60_000,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return 'Unexpected server error. Please contact your administrator.';
  }
  const data = error.response?.data as Record<string, unknown> | undefined;
  if (!data) {
    return 'Unexpected server error. Please contact your administrator.';
  }
  // Laravel validation errors — collect up to 3 field messages
  if (data.errors && typeof data.errors === 'object') {
    const msgs = Object.values(data.errors as Record<string, string[]>)
      .flat()
      .filter(Boolean)
      .slice(0, 3);
    if (msgs.length > 0) return msgs.join(' ');
  }
  // Backend message (business logic failures, auth errors, etc.)
  if (typeof data.message === 'string' && data.message) {
    return data.message;
  }
  return 'Unexpected server error. Please contact your administrator.';
}

function resolvedProductPrice(p: Product): number | null {
  return p.sale_price ?? p.regular_price ?? null;
}

// ── Progress Indicator ────────────────────────────────────────────────────────

function ProgressIndicator({ steps }: { steps: { label: string; done: boolean }[] }) {
  const allDone = steps.every((s) => s.done);
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-muted/30 px-4 py-2.5">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const isReady = isLast && allDone;
        return (
          <div key={i} className="flex items-center gap-1 shrink-0">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                isReady
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                  : step.done
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground',
              )}
            >
              {step.done ? (
                <CheckCircle2 className="size-3 shrink-0" />
              ) : (
                <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full border text-[10px]">
                  {i + 1}
                </span>
              )}
              {step.label}
            </div>
            {!isLast && <ChevronRight className="size-3 text-muted-foreground shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ── Live Financial Summary ─────────────────────────────────────────────────────

function LiveFinancialSummary() {
  const { t } = useTranslation('orders');
  const lines             = useWatch<ManualOrderFormValues, 'lines'>({ name: 'lines' });
  const discountAmountStr = useWatch<ManualOrderFormValues, 'discount_amount'>({ name: 'discount_amount' });
  const discountType      = useWatch<ManualOrderFormValues, 'discount_type'>({ name: 'discount_type' });
  const shippingCostStr   = useWatch<ManualOrderFormValues, 'shipping_cost'>({ name: 'shipping_cost' });
  const shippingSource    = useWatch<ManualOrderFormValues, 'shipping_cost_source'>({ name: 'shipping_cost_source' });
  const depositAmountStr  = useWatch<ManualOrderFormValues, 'deposit_amount'>({ name: 'deposit_amount' });
  const paymentMethod     = useWatch<ManualOrderFormValues, 'payment_method_manual'>({ name: 'payment_method_manual' });
  const proofPath         = useWatch<ManualOrderFormValues, 'payment_proof_path'>({ name: 'payment_proof_path' });

  const productsTotal = (lines ?? []).reduce(
    (sum, l) => sum + Number(l.quantity || 0) * Number(l.unit_price || 0),
    0,
  );
  const discountRaw  = Number(discountAmountStr || 0);
  const discount     = discountType === 'percentage' ? (productsTotal * discountRaw) / 100 : discountRaw;
  const shipping     = Number(shippingCostStr || 0);
  const deposit      = Number(depositAmountStr || 0);
  const tax          = 0; // Placeholder — tax module not yet active
  const grandTotal   = Math.max(0, productsTotal - discount + shipping + tax);
  const remaining    = Math.max(0, grandTotal - deposit);
  const showShipping = Boolean(shippingSource);

  return (
    <Card className="sticky top-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t($ => $.workspace.summary)}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">{t($ => $.workspace.productsTotal)}</span>
          <span className="font-medium tabular-nums">{fmt(productsTotal)}</span>
        </div>
        {discountType ? (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">
              {t($ => $.workspace.discountLabel)}{discountType === 'percentage' && discountRaw > 0 ? ` (${discountRaw}%)` : ''}
            </span>
            <span className={cn('font-medium tabular-nums', discount > 0 ? 'text-emerald-600' : 'text-muted-foreground/60')}>
              {discount > 0 ? `−${fmt(discount)}` : fmt(0)}
            </span>
          </div>
        ) : null}
        {showShipping ? (
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{t($ => $.workspace.shippingLabel)}</span>
            <span className="font-medium tabular-nums">{fmt(shipping)}</span>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground/60 text-xs">{t($ => $.workspace.tax)}</span>
          <span className="tabular-nums text-muted-foreground/60 text-xs">{t($ => $.workspace.taxNotApplicable)}</span>
        </div>
        <div className="border-t pt-2">
          <div className="flex justify-between gap-3 text-base font-semibold">
            <span>{t($ => $.workspace.grandTotal)}</span>
            <span className="tabular-nums">{fmt(grandTotal)}</span>
          </div>
        </div>
        {deposit > 0 && (
          <>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t($ => $.workspace.depositPaid)}</span>
              <span className="font-medium tabular-nums text-emerald-600">−{fmt(deposit)}</span>
            </div>
            <div className="border-t pt-2">
              <div className="flex justify-between gap-3 font-semibold">
                <span>{t($ => $.workspace.remainingBalance)}</span>
                <span className={cn('tabular-nums', remaining > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                  {fmt(remaining)}
                </span>
              </div>
            </div>
          </>
        )}
        {(paymentMethod || proofPath) && (
          <div className="border-t pt-2 flex flex-col gap-1.5">
            {paymentMethod && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground text-xs">{t($ => $.workspace.paymentLabel)}</span>
                <span className="text-xs font-medium">
                  {t($ => $.workspace.paymentMethodLabels[paymentMethod], { defaultValue: PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod.replace(/_/g, ' ') })}
                </span>
              </div>
            )}
            {proofPath && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground text-xs">{t($ => $.workspace.proofLabel)}</span>
                <span className="text-xs font-medium text-emerald-600">{t($ => $.workspace.uploaded)}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Order Line Row ────────────────────────────────────────────────────────────

type LineError = {
  product_id?: { message?: string };
  quantity?: { message?: string };
  unit_price?: { message?: string };
};

function fieldError(errors: LineError | undefined, field: keyof LineError) {
  const e = errors?.[field];
  return typeof e?.message === 'string' ? e.message : undefined;
}

function ManualLineRow({
  index,
  productMap,
  onRemove,
  canRemove,
  errors: errs,
}: {
  index: number;
  productMap: Map<string, Product>;
  onRemove: () => void;
  canRemove: boolean;
  errors: LineError | undefined;
}) {
  const { t } = useTranslation('orders');
  const { register, setValue, watch } = useFormContext<ManualOrderFormValues>();

  const lines = watch('lines');
  const line = lines[index];
  const productId = line?.product_id ?? '';
  const qty = Number(line?.quantity ?? 0);
  const price = Number(line?.unit_price ?? 0);
  const selectedProduct = productMap.get(productId);

  const { data: pricing } = useProductPricing(productId || null);

  // Initialized to current productId so that the initial mount does NOT trigger a price reset.
  // Effect below only resets when the user actively switches to a different product.
  const prevProductIdRef = useRef<string>(productId);

  useEffect(() => {
    const prev = prevProductIdRef.current;
    prevProductIdRef.current = productId;
    // No-op on first mount (prev === productId) or when cleared
    if (!productId || productId === prev) return;
    setValue(`lines.${index}.unit_price`, '', { shouldValidate: false });
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pricing Engine is authoritative — always overrides the catalog fallback price.
  useEffect(() => {
    if (!productId || pricing?.approved_price == null) return;
    setValue(`lines.${index}.unit_price`, String(pricing.approved_price), { shouldValidate: false });
    if (import.meta.env.DEV) {
       
      console.log('[Pricing]', { productId, approved: pricing.approved_price, source: pricing.source });
    }
  }, [pricing?.approved_price, productId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPriceLocked = pricing?.approved_price != null;
  const imgUrl = getMediaUrl(selectedProduct?.image_url);

  return (
    <tr>
      <td className="py-2 pr-3 align-middle">
        <div className="flex items-center gap-2">
          {imgUrl ? (
            <img src={imgUrl} alt={selectedProduct!.name} className="size-8 rounded object-cover shrink-0" />
          ) : (
            <div className="size-8 rounded bg-muted shrink-0" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{selectedProduct?.name ?? productId}</p>
            <p className="font-mono text-xs text-muted-foreground">{selectedProduct?.sku}</p>
            {pricing?.has_pending_review && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600">
                <AlertTriangle className="size-2.5" />
                {t($ => $.workspace.priceReviewPending)}
              </span>
            )}
          </div>
        </div>
      </td>

      <td className="w-24 py-2 pr-3 align-middle">
        <Input type="number" min="0.0001" step="any" className="h-8 text-sm" {...register(`lines.${index}.quantity`)} />
        {fieldError(errs, 'quantity') && (
          <p className="text-destructive mt-0.5 text-xs">{fieldError(errs, 'quantity')}</p>
        )}
      </td>

      {/* Price: locked to approved — read-only display */}
      <td className="w-28 py-2 pr-3 align-middle">
        <input type="hidden" {...register(`lines.${index}.unit_price`)} />
        <div className="flex h-8 items-center gap-1 rounded-md border bg-muted/50 px-2.5 text-sm font-medium tabular-nums">
          {isPriceLocked && <Lock className="size-3 shrink-0 text-muted-foreground" />}
          <span className={!price ? 'italic text-muted-foreground' : ''}>
            {price > 0 ? fmt(price) : '—'}
          </span>
        </div>
      </td>

      <td className="w-24 py-2 pr-3 align-middle text-end font-medium tabular-nums text-sm">
        {fmt(qty * price)}
      </td>

      <td className="w-10 py-2 align-middle">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-destructive"
          onClick={onRemove}
          disabled={!canRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </td>
    </tr>
  );
}

// ── Products Section ──────────────────────────────────────────────────────────

function ManualOrderProductsSection({
  finishedProducts,
  rawMaterials,
  channelSelected,
  loadingProducts,
  locked = false,
}: {
  finishedProducts: Product[];
  rawMaterials: Product[];
  channelSelected: boolean;
  loadingProducts: boolean;
  locked?: boolean;
}) {
  const { t } = useTranslation('orders');
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<ManualOrderFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch<ManualOrderFormValues, 'lines'>({ name: 'lines' });
  const [showRm, setShowRm] = useState(false);
  const [showBrowser, setShowBrowser] = useState(true);

  const fgProductMap = useMemo(() => new Map(finishedProducts.map((p) => [p.id, p])), [finishedProducts]);
  const rmProductMap = useMemo(() => new Map(rawMaterials.map((p) => [p.id, p])), [rawMaterials]);
  const allProductMap = useMemo(() => new Map([...fgProductMap, ...rmProductMap]), [fgProductMap, rmProductMap]);

  const lineErrors = errors.lines as LineError[] | undefined;

  const fgIndices: number[] = [];
  const rmIndices: number[] = [];
  fields.forEach((_, i) => {
    const pid = (lines ?? [])[i]?.product_id;
    if (pid && rmProductMap.has(pid)) rmIndices.push(i);
    else fgIndices.push(i);
  });

  // Filter out empty placeholder lines from the count
  const filledFgIndices = fgIndices.filter((i) => Boolean((lines ?? [])[i]?.product_id));
  const filledRmIndices = rmIndices.filter((i) => Boolean((lines ?? [])[i]?.product_id));

  // PART 5 — Empty state before channel selected
  if (!channelSelected) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
        {t($ => $.workspace.selectChannelFirst)}
      </div>
    );
  }

  const handleAddProduct = (product: Product) => {
    const existingIdx = (lines ?? []).findIndex((l) => l.product_id === product.id);
    if (existingIdx >= 0) {
      const current = Number((lines ?? [])[existingIdx]?.quantity ?? 0);
      setValue(`lines.${existingIdx}.quantity`, String(current + 1), { shouldValidate: false });
      return;
    }
    const price = resolvedProductPrice(product);
    append({
      product_id: product.id,
      quantity: '1',
      unit_price: price != null ? String(price) : '',
    } as ManualOrderLineFormValues);
    // Collapse browser after adding if there are already products
    if (filledFgIndices.length >= 2) setShowBrowser(false);
  };

  // Locked read-only view — shows existing lines without any editing controls.
  if (locked) {
    const allFilled = (lines ?? []).filter((l) => Boolean(l.product_id));
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-400">
          <Lock className="size-3.5 shrink-0" />
          {t($ => $.workspace.productsLocked)}
        </div>
        {allFilled.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start text-xs text-muted-foreground">
                  <th className="pb-1.5 pr-3 font-medium">{t($ => $.workspace.colProduct)}</th>
                  <th className="w-24 pb-1.5 pr-3 font-medium text-end">{t($ => $.workspace.colQty)}</th>
                  <th className="w-28 pb-1.5 pr-3 font-medium text-end">{t($ => $.workspace.colUnitPrice)}</th>
                  <th className="w-24 pb-1.5 text-end font-medium">{t($ => $.workspace.colTotal)}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {allFilled.map((l, idx) => {
                  const product = allProductMap.get(l.product_id);
                  const qty = Number(l.quantity || 0);
                  const price = Number(l.unit_price || 0);
                  return (
                    <tr key={idx} className="text-sm">
                      <td className="py-2 pr-3 font-medium">{product?.name ?? l.product_id}</td>
                      <td className="py-2 pr-3 text-end tabular-nums text-muted-foreground">{qty}</td>
                      <td className="py-2 pr-3 text-end tabular-nums text-muted-foreground">{fmt(price)}</td>
                      <td className="py-2 text-end tabular-nums font-medium">{fmt(qty * price)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {typeof errors.lines?.message === 'string' && (
        <p className="text-destructive text-xs">{errors.lines.message}</p>
      )}

      {/* PART 3 — Product Browser (collapsible) */}
      <div className="rounded-lg border bg-muted/20">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors rounded-lg"
          onClick={() => setShowBrowser((v) => !v)}
        >
          <span className="flex items-center gap-2">
            {t($ => $.workspace.browseProducts)}
            {finishedProducts.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {finishedProducts.length}
              </Badge>
            )}
          </span>
          {showBrowser ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {showBrowser && (
          <div className="border-t px-4 pb-4 pt-3">
            <ProductBrowser
              products={finishedProducts}
              onAdd={handleAddProduct}
              isLoading={loadingProducts}
            />
          </div>
        )}
      </div>

      {/* FG Order Lines */}
      {filledFgIndices.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t($ => $.workspace.selectedProducts, { count: filledFgIndices.length })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start text-xs text-muted-foreground">
                  <th className="pb-1.5 pr-3 font-medium">{t($ => $.workspace.colProduct)}</th>
                  <th className="w-24 pb-1.5 pr-3 font-medium">{t($ => $.workspace.colQty)}</th>
                  <th className="w-28 pb-1.5 pr-3 font-medium">{t($ => $.workspace.colPrice)}</th>
                  <th className="w-24 pb-1.5 pr-3 text-end font-medium">{t($ => $.workspace.colTotal)}</th>
                  <th className="w-10 pb-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {fgIndices.map((i) => {
                  const pid = (lines ?? [])[i]?.product_id;
                  if (!pid) return null;
                  return (
                    <ManualLineRow
                      key={fields[i].id}
                      index={i}
                      productMap={allProductMap}
                      onRemove={() => remove(i)}
                      canRemove={fields.length > 1}
                      errors={lineErrors?.[i]}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw Materials (collapsible) */}
      <div className="border-t pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowRm((v) => !v)}
        >
          <span>
            {t($ => $.workspace.rawMaterials)}
            {filledRmIndices.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {filledRmIndices.length}
              </span>
            )}
          </span>
          {showRm ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {showRm && (
          <div className="mt-3 flex flex-col gap-3">
            <ProductBrowser products={rawMaterials} onAdd={handleAddProduct} />
            {filledRmIndices.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-start text-xs text-muted-foreground">
                      <th className="pb-1.5 pr-3 font-medium">{t($ => $.workspace.colMaterial)}</th>
                      <th className="w-24 pb-1.5 pr-3 font-medium">{t($ => $.workspace.colQty)}</th>
                      <th className="w-28 pb-1.5 pr-3 font-medium">{t($ => $.workspace.colPrice)}</th>
                      <th className="w-24 pb-1.5 pr-3 text-end font-medium">{t($ => $.workspace.colTotal)}</th>
                      <th className="w-10 pb-1.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rmIndices.map((i) => {
                      const pid = (lines ?? [])[i]?.product_id;
                      if (!pid) return null;
                      return (
                        <ManualLineRow
                          key={fields[i].id}
                          index={i}
                          productMap={allProductMap}
                          onRemove={() => remove(i)}
                          canRemove={fields.length > 1}
                          errors={lineErrors?.[i]}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => append({ product_id: '', quantity: '1', unit_price: '' } as ManualOrderLineFormValues)}
            >
              <Plus className="size-3.5" />
              {t($ => $.workspace.addRawMaterialLine)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Loading spinner ───────────────────────────────────────────────────────────

function InlineSpinner({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="size-3 animate-spin" />
      {label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
  mode?: 'create' | 'edit';
  order?: Order;
};

export function ManualOrderFormWorkspace({ mode = 'create', order }: Props) {
  const { money, currency } = useFormatter();
  const { t } = useTranslation('orders');
  const navigate = useNavigate();
  const createManual  = useCreateManualOrder();
  const updateManual  = useUpdateManualOrder();
  const isEdit = mode === 'edit';
  // Structural lock: products/price/shipping/discount are read-only once an order leaves Pending/AwaitingPayment.
  const isStructurallyLocked = isEdit && order != null && !['new', 'awaiting_payment'].includes(order.status);
  // Terminal: Delivered/Cancelled/Returned are fully read-only.
  const isTerminal = isEdit && order != null && ['delivered', 'cancelled', 'returned'].includes(order.status);

  const [serverError, setServerError] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);
  const userHasSelectedSlotRef = useRef(false);
  const [pendingSubmitValues, setPendingSubmitValues] = useState<ManualOrderFormValues | null>(null);

  // ── Diagnostic: prove component lifecycle across SPA navigation ────────────
  // ROOT-CAUSE LOGGING: if this MOUNT log never appears when navigating to
  // New Order, the component is being REUSED (not remounted) — state bleeds.
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(
        '[FORM-LIFECYCLE] MOUNT — mode:', mode,
        '| orderId:', order?.id ?? '(none)',
        '| delivery_window_id in order prop:', order?.delivery_window_id ?? '(none)',
        '| initial serverError:', serverError,
        '| initial slotError:', slotError,
        '| userHasSelectedSlotRef:', userHasSelectedSlotRef.current,
      );
    }
    return () => {
      if (import.meta.env.DEV) {
        console.log('[FORM-LIFECYCLE] UNMOUNT — mode:', mode, '| orderId:', order?.id ?? '(none)');
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Distribution SSOT: detect if this order is in an active trip before allowing save.
  const { data: distributionStage } = useOrderDistributionStage(isEdit ? (order?.id ?? null) : null, isEdit);
  const [lookupResult, setLookupResult] = useState<CustomerLookupResult>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(isEdit); // edit starts with customer known
  const [brandId, setBrandId] = useState<string | null>(
    isEdit && order?.channel?.brand_id ? order.channel.brand_id : null,
  );
  const [brandName, setBrandName] = useState<string | undefined>(undefined);
  const [overrideUnlocked, setOverrideUnlocked] = useState(
    isEdit && order?.shipping_cost_source === 'override',
  );
  const [shippingGovernorateId, setShippingGovernorateId] = useState<number | null>(null);
  const [shippingCityId, setShippingCityId] = useState<number | null>(null);
  const [showPolicyPanel, setShowPolicyPanel] = useState(false);
  const [locResolving, setLocResolving] = useState(false);
  const [locImported, setLocImported] = useState(
    isEdit && order?.location?.lat != null,
  );
  const [govComboValue, setGovComboValue] = useState<string | null>(null);
  // Tracks the last customer ID for which gov/city auto-select ran — prevents re-firing on list reload
  const customerAutoGovRef = useRef<string | null>(null);
  const [depositEnabled, setDepositEnabled] = useState(
    isEdit && order ? (order.deposit_amount ?? 0) > 0 : false,
  );
  const queryClient = useQueryClient();

  // PART 1 — Companies
  const { data: companiesResult } = useCompaniesQuery({ per_page: 100, status: 'active' });
  const companyOptions = useMemo(
    () => (companiesResult?.items ?? []).map((c) => ({ value: c.id, label: c.name })),
    [companiesResult],
  );

  const form = useForm<ManualOrderFormValues>({
    resolver: zodResolver(manualOrderSchema),
    defaultValues: isEdit && order
      ? {
          channel_id:               order.channel_id ?? undefined,
          status:                   order.status,
          order_date:               order.order_date,
          customer_id:              order.customer_id,
          customer_name:            order.customer?.name ?? undefined,
          customer_phone:           order.billing_phone ?? order.customer?.phone ?? undefined,
          customer_secondary_phone: order.customer?.mobile ?? undefined,
          customer_notes:           order.customer_note ?? undefined,
          governorate:              order.governorate ?? undefined,
          city:                     order.city ?? undefined,
          area:                     order.area ?? undefined,
          shipping_address:         order.shipping_address ?? undefined,
          building:                 order.building ?? undefined,
          floor:                    order.floor ?? undefined,
          apartment:                order.apartment ?? undefined,
          landmark:                 order.landmark ?? undefined,
          address_notes:            order.address_notes ?? undefined,
          delivery_zone_id:         order.delivery_zone_id ?? undefined,
          delivery_zone:            order.delivery_zone ?? undefined,
          delivery_window_id:       order.delivery_window_id ?? undefined,
          delivery_window:          order.delivery_window ?? undefined,
          requested_delivery_date:  order.requested_delivery_date ?? undefined,
          google_maps_lat:          order.location?.lat ?? undefined,
          google_maps_lng:          order.location?.lng ?? undefined,
          google_maps_url:          order.google_maps_url ?? undefined,
          location_source:          order.location_source ?? undefined,
          payment_method_manual:    order.payment_method_manual ?? undefined,
          payment_proof_path:       order.payment_proof_path ?? undefined,
          shipping_cost:            order.shipping_cost != null ? String(order.shipping_cost) : undefined,
          shipping_cost_source:     order.shipping_cost_source ?? undefined,
          discount_type:            order.discount_type ?? undefined,
          discount_amount:          (order.discount_value ?? 0) > 0 ? String(order.discount_value) : undefined,
          deposit_amount:           (order.deposit_amount ?? 0) > 0 ? String(order.deposit_amount) : undefined,
          notes:                    order.notes ?? undefined,
          lines: order.lines.length > 0
            ? order.lines.map((l) => ({
                product_id: l.product_id,
                quantity:   String(l.quantity),
                unit_price: String(l.unit_price),
              }))
            : [{ product_id: '', quantity: '1', unit_price: '' }],
        }
      : {
          status:                   'new',
          order_date:               new Date().toISOString().slice(0, 10),
          requested_delivery_date:  new Date().toISOString().slice(0, 10),
          payment_method_manual:    'cod',
          lines:                    [{ product_id: '', quantity: '', unit_price: '' }],
        },
  });

  const watchedCompanyId      = form.watch('company_id') ?? '';
  const watchedChannelId      = form.watch('channel_id') ?? '';
  const watchedGovernorate    = form.watch('governorate') ?? '';
  const watchedLines          = form.watch('lines');
  const watchedPayment        = form.watch('payment_method_manual');
  const watchedZoneId         = form.watch('delivery_zone_id') ?? '';
  const watchedShipSrc        = form.watch('shipping_cost_source');
  const watchedDeliveryDate   = form.watch('requested_delivery_date') ?? '';
  const watchedDiscountType   = form.watch('discount_type') ?? '';
  const watchedGoogleMapsUrl  = form.watch('google_maps_url') ?? '';

  const today = new Date().toISOString().slice(0, 10);
  const isDeliveryFuture = Boolean(watchedDeliveryDate && watchedDeliveryDate > today);

  // Data loading
  const { data: brandOptions = [], isLoading: loadingBrands } = useBrandOptions(watchedCompanyId || null);
  const { data: channelOptions = [], isLoading: loadingChannels } = useChannelsByBrand(brandId);
  const { data: fgProducts = [], isFetching: loadingProducts } = useFinishedProducts(watchedChannelId || null);
  const { data: rawMaterials = [] } = useRawMaterials();
  const allProductMap = useMemo(
    () => new Map([...fgProducts, ...rawMaterials].map((p) => [p.id, p])),
    [fgProducts, rawMaterials],
  );
  const { data: geography, isFetching: loadingGeo } = useBrandDeliveryGeography(brandId);
  const { data: allTimeSlots = [], isFetching: loadingWindows, refetch: refetchTimeSlots } = useDeliveryTimeSlots(brandId);

  // Phase 1 — Brand order policy (auto-derives status, proof requirements, matching rules)
  const { data: orderPolicy } = useBrandOrderPolicy(brandId);

  // Part 3 — Derive available payment methods from brand policy proof keys.
  // 'cash' is a legacy alias for 'cod' — filtered out to avoid duplicate "Cash / Cash on Delivery".
  const policyPaymentMethods = useMemo(() => {
    if (!orderPolicy?.payment_proof_policy) return undefined;
    return Object.keys(orderPolicy.payment_proof_policy)
      .filter((key) => key !== 'cash')
      .map((key) => ({
        value: key,
        label: t($ => $.workspace.paymentMethodLabels[key], { defaultValue: PAYMENT_METHOD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }),
      }));
   
  }, [orderPolicy, t]);

  // Phase 7 — Brand shipping engine governorates
  const { data: shippingGovernorates = [] } = useBrandShippingGovernorates(brandId);

  // Active delivery time slots only, ordered by display_order (backend already orders)
  const activeTimeSlots = useMemo(
    () => allTimeSlots.filter((s) => s.is_active),
    [allTimeSlots],
  );

  // Cities within the selected governorate (new shipping engine only)
  const { data: shippingCities = [], isFetching: loadingCities } = useBrandShippingCities(
    shippingGovernorateId ? brandId : null,
    shippingGovernorateId,
  );

  // Phase 7 — Shipping engine quote (runs after governorate + optional city selected)
  const { data: shippingQuote, isFetching: quoteFetching } = useShippingQuote(
    brandId && shippingGovernorateId
      ? { brand_id: brandId, governorate_id: shippingGovernorateId, city_id: shippingCityId }
      : null,
  );

  // PART 1 — Brand configuration health check
  const { data: configHealth, isFetching: loadingHealth } = useBrandConfigHealth(brandId);

  // Phase 7 — Use brand shipping governorates (new system) when available, fall back to legacy
  const governorateOptions = useMemo(() => {
    if (shippingGovernorates.length > 0) {
      return shippingGovernorates
        .filter((g) => g.is_enabled)
        .map((g) => ({
          value: String(g.governorate_id),
          label: g.governorate?.name_en ?? g.governorate?.name_ar ?? String(g.governorate_id),
          governorate_id: g.governorate_id,
          shipping_price: g.shipping_price,
        }));
    }
    return (geography?.governorates ?? []).map((g) => ({
      value: g.id,
      label: g.name,
      governorate_id: null as number | null,
      shipping_price: null as number | null,
    }));
  }, [shippingGovernorates, geography]);

  const zoneOptions = useMemo(() => {
    if (!watchedGovernorate || !geography) return [];
    const gov = geography.governorates.find((g) => g.id === watchedGovernorate);
    return (gov?.zones ?? []).map((z) => ({ value: z.id, label: z.name, shipping_cost: z.shipping_cost }));
  }, [geography, watchedGovernorate]);

  const windowOptions = useMemo(
    () => activeTimeSlots.map((s) => ({ value: s.id, label: s.name })),
    [activeTimeSlots],
  );

  const cityOptions = useMemo(
    () => shippingCities
      .filter((c) => c.is_enabled !== false)
      .map((c) => ({
        value: String(c.city_id),
        label: c.city?.name_en ?? c.city?.name_ar ?? String(c.city_id),
      })),
    [shippingCities],
  );

  // Auto-populate shipping cost when legacy zone changes
  useEffect(() => {
    if (!watchedZoneId || overrideUnlocked) return;
    const zone = zoneOptions.find((z) => z.value === watchedZoneId);
    if (zone?.shipping_cost != null) {
      form.setValue('shipping_cost', String(zone.shipping_cost));
      form.setValue('shipping_cost_source', 'auto');
    }
  }, [watchedZoneId, zoneOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coverage-driven shipping sync — coverage_status from backend is the single source of truth.
  // 'covered' → use the quoted price. Any other status → cost must be 0.
  useEffect(() => {
    if (overrideUnlocked || !shippingQuote) return;
     
    if (import.meta.env.DEV) console.log('[Shipping][STEP 3] coverage effect fired:', { coverage_status: shippingQuote.coverage_status, shipping_price: shippingQuote.shipping_price, available: shippingQuote.available });
    if (shippingQuote.coverage_status === 'covered' && shippingQuote.shipping_price != null) {
      form.setValue('shipping_cost', String(shippingQuote.shipping_price));
      form.setValue('shipping_cost_source', 'auto');
    } else {
      form.setValue('shipping_cost', '0', { shouldValidate: false });
      form.setValue('shipping_cost_source', undefined, { shouldValidate: false });
    }
     
    if (import.meta.env.DEV) console.log('[Shipping][STEP 4] shipping_cost set to:', shippingQuote.coverage_status === 'covered' ? shippingQuote.shipping_price : 0);
  }, [shippingQuote?.coverage_status, shippingQuote?.shipping_price, overrideUnlocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edit mode — initialize governorate combo once shipping governorates load (new shipping engine)
  useEffect(() => {
    if (!isEdit || !order?.governorate || shippingGovernorates.length === 0 || govComboValue !== null) return;
    const match = shippingGovernorates.find(
      (g) => g.governorate?.name_en === order.governorate || g.governorate?.name_ar === order.governorate,
    );
    if (match) {
      setGovComboValue(String(match.governorate_id));
      setShippingGovernorateId(match.governorate_id);
    }
  }, [shippingGovernorates, isEdit, order?.governorate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edit mode — initialize governorate combo from legacy geography (fallback when new engine has no data)
  useEffect(() => {
    if (!isEdit || !order?.governorate || shippingGovernorates.length > 0 || govComboValue !== null) return;
    if (!geography?.governorates?.length) return;
    const match = geography.governorates.find((g) => g.name === order.governorate || g.id === order.governorate);
    if (match) setGovComboValue(match.id);
  }, [geography?.governorates, isEdit, order?.governorate, shippingGovernorates.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Edit mode — initialize city ID once cities load.
  // Prefers delivery_zone (canonical) over city (WC legacy) so the combo reflects
  // whatever the last zone-editor or edit-form save committed.
  useEffect(() => {
    if (!isEdit || shippingCities.length === 0 || shippingCityId !== null) return;
    const target = order?.delivery_zone ?? order?.city;
    if (!target) return;
    const match = shippingCities.find(
      (c) => c.city?.name_en === target || c.city?.name_ar === target,
    );
    if (match) setShippingCityId(match.city_id);
  }, [shippingCities, isEdit, order?.delivery_zone, order?.city]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create mode — auto-select governorate from customer profile once shipping govs load
  useEffect(() => {
    if (isEdit || !lookupResult || shippingGovernorates.length === 0) return;
    // Run only once per customer (avoids re-firing when gov list refreshes)
    if (customerAutoGovRef.current === lookupResult.customer.id) return;
    customerAutoGovRef.current = lookupResult.customer.id;

    const defaultAddr = lookupResult.addresses.find((a) => a.is_default) ?? lookupResult.addresses[0];
    const govName = (defaultAddr?.governorate ?? lookupResult.customer.governorate ?? '').trim();
    if (!govName) return;

    const match = shippingGovernorates.find(
      (g) =>
        g.is_enabled &&
        ((g.governorate?.name_en ?? '').toLowerCase() === govName.toLowerCase() ||
          (g.governorate?.name_ar ?? '') === govName),
    );
    if (match) handleGovernorateChange(String(match.governorate_id));
  }, [lookupResult, shippingGovernorates]); // eslint-disable-line react-hooks/exhaustive-deps

  // Create mode — auto-select city from customer profile once cities load (after gov cascade)
  useEffect(() => {
    if (isEdit || !lookupResult || shippingCities.length === 0 || shippingCityId !== null) return;

    const defaultAddr = lookupResult.addresses.find((a) => a.is_default) ?? lookupResult.addresses[0];
    const cityName = (defaultAddr?.city ?? lookupResult.customer.city ?? '').trim();
    if (!cityName) return;

    const match = shippingCities.find(
      (c) =>
        c.is_enabled !== false &&
        ((c.city?.name_en ?? '').toLowerCase() === cityName.toLowerCase() ||
          (c.city?.name_ar ?? '') === cityName),
    );
    if (match) {
      setShippingCityId(match.city_id);
      const name = match.city?.name_en ?? match.city?.name_ar ?? cityName;
      form.setValue('city', name);
      form.setValue('delivery_zone', name);
    }
  }, [lookupResult, shippingCities]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-set initial status from brand entry policy when policy loads
  useEffect(() => {
    if (isEdit || !orderPolicy) return;
    const mp = orderPolicy.source_entry_policies.manual;
    const all = Array.isArray(mp) ? mp : [mp];
    const choices = all.filter((s) => !INTERNAL_STATUSES.has(s));
    const validChoices = choices.length > 0 ? choices : all;
    const first = validChoices[0] ?? 'new';
    const current = form.getValues('status');
    if (!current || !validChoices.includes(current)) {
      form.setValue('status', first);
    }
  }, [orderPolicy, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background slot validation — only fires AFTER the user has explicitly selected a slot.
  // Silent when user hasn't touched the field (satisfies "no error on page load" requirement).
  // Also silent during brand resets (userHasSelectedSlotRef is cleared there).
  useEffect(() => {
    const currentSlotId = form.getValues('delivery_window_id');
    if (import.meta.env.DEV) {
      console.log(
        '[SLOT-EFFECT] activeTimeSlots changed:',
        '| ref:', userHasSelectedSlotRef.current,
        '| delivery_window_id:', currentSlotId ?? '(none)',
        '| activeTimeSlots.length:', activeTimeSlots.length,
        '| slotIds:', activeTimeSlots.map((s) => s.id),
      );
    }
    if (!userHasSelectedSlotRef.current) {
      if (import.meta.env.DEV) console.log('[SLOT-EFFECT] gated — ref is false, no validation');
      return;
    }
    if (!currentSlotId || activeTimeSlots.length === 0) {
      if (import.meta.env.DEV) console.log('[SLOT-EFFECT] gated — no slot selected or list empty');
      return;
    }
    const isValid = activeTimeSlots.some((s) => s.id === currentSlotId);
    if (import.meta.env.DEV) console.log('[SLOT-EFFECT] isValid:', isValid);
    if (!isValid) {
      if (import.meta.env.DEV) console.log('[SLOT-EFFECT] SETTING slotError — slot', currentSlotId, 'not in updated list');
      form.setValue('delivery_window_id', undefined);
      form.setValue('delivery_window', undefined);
      setSlotError(t($ => $.workspace.slotUnavailable));
    }
  }, [activeTimeSlots]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cascade handlers ────────────────────────────────────────────────────────

  const resetDownstreamOfBrand = () => {
    form.setValue('channel_id', undefined);
    form.setValue('governorate', undefined);
    form.setValue('delivery_zone_id', undefined);
    form.setValue('delivery_zone', undefined);
    form.setValue('delivery_window_id', undefined);
    form.setValue('delivery_window', undefined);
    form.setValue('shipping_cost', undefined);
    form.setValue('shipping_cost_source', undefined);
    form.setValue('lines', [{ product_id: '', quantity: '', unit_price: '' }]);
    setSlotError(null);
    userHasSelectedSlotRef.current = false;
    setOverrideUnlocked(false);
    setShippingGovernorateId(null);
    setShippingCityId(null);
    setGovComboValue(null);
  };

  const handleCompanyChange = (value: string | null) => {
    form.setValue('company_id', value ?? '');
    setBrandId(null);
    setBrandName(undefined);
    resetDownstreamOfBrand();
  };

  const handleBrandChange = (value: string | null) => {
    setBrandId(value);
    const opt = brandOptions.find((b) => b.value === value);
    setBrandName(opt?.label);
    resetDownstreamOfBrand();
  };

  const handleChannelChange = (value: string | null) => {
    form.setValue('channel_id', value ?? undefined);
    form.setValue('lines', [{ product_id: '', quantity: '', unit_price: '' }]);
  };

  const handleGovernorateChange = (value: string | null) => {
    const governorateChanged = value !== govComboValue;
    setGovComboValue(value);
    const opt = governorateOptions.find((g) => g.value === value);
    const govName = opt?.label ?? value ?? undefined;
    form.setValue('governorate', govName);
    form.setValue('delivery_zone_id', undefined);
    form.setValue('delivery_zone', undefined);
    form.setValue('shipping_cost_source', undefined);
    // Only clear city when the user actually selects a DIFFERENT governorate.
    // Re-selecting the same one must not wipe out an already-saved city value.
    if (governorateChanged) {
      form.setValue('city', '');
      setShippingCityId(null);
    }
    setOverrideUnlocked(false);
    if (opt?.governorate_id) {
      setShippingGovernorateId(opt.governorate_id);
      // Shipping cost is set ONLY after coverage is confirmed by the quote API.
      // Pre-filling here causes a contradiction when the quote returns needs_review.
    } else {
      setShippingGovernorateId(null);
      form.setValue('shipping_cost', undefined);
    }
  };

  const handleZoneChange = (value: string | null) => {
    form.setValue('delivery_zone_id', value ?? undefined);
    const zone = zoneOptions.find((z) => z.value === value);
    const zoneLabel = zone?.label ?? undefined;
    form.setValue('delivery_zone', zoneLabel);
    form.setValue('city', zoneLabel ?? '');
  };

  const handleWindowChange = (value: string | null) => {
    if (import.meta.env.DEV) console.log('[SLOT-SELECT] handleWindowChange:', value, '| ref before:', userHasSelectedSlotRef.current);
    if (value) userHasSelectedSlotRef.current = true;
    setSlotError(null);
    form.setValue('delivery_window_id', value ?? undefined);
    const slot = activeTimeSlots.find((s) => s.id === value);
    form.setValue('delivery_window', slot?.name ?? undefined);
    if (import.meta.env.DEV) console.log('[SLOT-SELECT] ref after:', userHasSelectedSlotRef.current);
  };

  const handleCityChange = (value: string | null) => {
    const numId = value ? Number(value) : null;
    setShippingCityId(numId);
    const cityEntry = shippingCities.find((c) => c.city_id === numId);
    const cityName = cityEntry?.city?.name_en ?? cityEntry?.city?.name_ar ?? '';
    form.setValue('city', cityName);
    form.setValue('delivery_zone', cityName || undefined);
  };

  // ── Customer handlers ───────────────────────────────────────────────────────

  const handleCustomerFound = (result: CustomerLookupResult) => {
    setLookupResult(result);
    setIsNewCustomer(false);
    if (!result) return;

    // Core identity
    form.setValue('customer_id',              result.customer.id);
    form.setValue('customer_name',            result.customer.name);
    form.setValue('customer_phone',           result.customer.phone ?? '');
    if (result.customer.mobile)               form.setValue('customer_secondary_phone', result.customer.mobile);
    if (result.customer.notes)                form.setValue('customer_notes', result.customer.notes);

    // Prefer the default address; fall back to first address
    const addr = result.addresses.find((a) => a.is_default) ?? result.addresses[0];
    if (addr) {
      if (addr.city)          form.setValue('city', addr.city);
      if (addr.area)          form.setValue('area', addr.area);
      if (addr.address_line)  form.setValue('shipping_address', addr.address_line);
      if (addr.building)      form.setValue('building', addr.building);
      if (addr.floor)         form.setValue('floor', addr.floor);
      if (addr.apartment)     form.setValue('apartment', addr.apartment);
      if (addr.landmark)      form.setValue('landmark', addr.landmark);
      if (addr.address_notes) form.setValue('address_notes', addr.address_notes);
      if (addr.google_maps_url) form.setValue('google_maps_url', addr.google_maps_url);
      if (addr.google_maps_lat != null) {
        form.setValue('google_maps_lat', addr.google_maps_lat);
        form.setValue('google_maps_lng', addr.google_maps_lng ?? undefined);
        form.setValue('location_source', addr.location_source ?? 'google_maps');
        setLocImported(true);
      }
    }
    // Gov/city cascade will fire via the auto-select effects once shippingGovernorates/cities load
  };

  const handleCustomerNotFound = (phone: string) => {
    setLookupResult(null);
    setIsNewCustomer(true);
    form.setValue('customer_id', undefined);
    form.setValue('customer_phone', phone);
  };

  const handleLookupClear = () => {
    setLookupResult(null);
    setIsNewCustomer(false);
    customerAutoGovRef.current = null;
    setLocImported(false);
    form.setValue('customer_id', undefined);
    form.setValue('customer_name', undefined);
    form.setValue('customer_phone', undefined);
    form.setValue('customer_secondary_phone', undefined);
    form.setValue('customer_notes', undefined);
    form.setValue('google_maps_url', '');
    form.setValue('google_maps_lat', undefined);
    form.setValue('google_maps_lng', undefined);
    form.setValue('location_source', undefined);
  };

  const handleOverrideToggle = () => {
    const next = !overrideUnlocked;
    setOverrideUnlocked(next);
    if (!next) {
      const zone = zoneOptions.find((z) => z.value === watchedZoneId);
      if (zone?.shipping_cost != null) {
        form.setValue('shipping_cost', String(zone.shipping_cost));
        form.setValue('shipping_cost_source', 'auto');
      }
    } else {
      form.setValue('shipping_cost_source', 'override');
    }
  };

  // Parts 1+2 — Google Maps URL import handler (supports short URLs via backend resolver)
  const [mapsUrlError, setMapsUrlError] = useState<string | null>(null);

  const handleImportMapsUrl = async () => {
    const url = watchedGoogleMapsUrl.trim();
    if (!url) return;
    if (!isGoogleMapsUrl(url)) {
      setMapsUrlError(t($ => $.workspace.mapsLinkError));
      return;
    }
    setMapsUrlError(null);

    // Try to parse coordinates directly (works for long URLs with embedded coords)
    const coords = parseGoogleMapsUrl(url);
    if (coords) {
      form.setValue('google_maps_lat', coords.lat, { shouldValidate: false });
      form.setValue('google_maps_lng', coords.lng, { shouldValidate: false });
      form.setValue('location_source', 'google_maps', { shouldValidate: false });
      setLocImported(true);
      return;
    }

    // Short URL — resolve via backend proxy then parse final URL
    setLocResolving(true);
    try {
      const result = await ordersService.resolveMapsUrl(url);
      const resolved = parseGoogleMapsUrl(result.resolved_url);
      if (resolved) {
        form.setValue('google_maps_lat', resolved.lat, { shouldValidate: false });
        form.setValue('google_maps_lng', resolved.lng, { shouldValidate: false });
        form.setValue('location_source', 'google_maps', { shouldValidate: false });
        form.setValue('google_maps_url', result.resolved_url, { shouldValidate: false });
        setLocImported(true);
      } else {
        setMapsUrlError(t($ => $.workspace.mapsCoordError));
      }
    } catch {
      setMapsUrlError('Unable to determine customer coordinates from this link.');
    } finally {
      setLocResolving(false);
    }
  };

  const handleClearLocation = () => {
    form.setValue('google_maps_url', '', { shouldValidate: false });
    form.setValue('google_maps_lat', undefined, { shouldValidate: false });
    form.setValue('google_maps_lng', undefined, { shouldValidate: false });
    form.setValue('location_source', undefined, { shouldValidate: false });
    setMapsUrlError(null);
    setLocImported(false);
  };

  const currentLat = form.watch('google_maps_lat');
  const currentLng = form.watch('google_maps_lng');

  const doEditSave = (values: ManualOrderFormValues) => {
    if (!order) return;
    const editPayload = toManualPayload(values);
    if (shippingGovernorateId) editPayload.governorate_id = shippingGovernorateId;
    if (shippingCityId) editPayload.city_id = shippingCityId;
    updateManual.mutate(
      { id: order.id, payload: editPayload },
      {
        onSuccess: () => navigate(`${ROUTES.orders}/${order.id}`),
        onError: (err) => {
          if (axios.isAxiosError(err)) {
            const errors = err.response?.data?.errors as Record<string, unknown> | undefined;
            if (errors?.delivery_window_id) {
               
              if (import.meta.env.DEV) console.log('[SERVER-ERROR] doEditSave onError — delivery_window_id backend rejection');
              form.setValue('delivery_window_id', undefined);
              form.setValue('delivery_window', undefined);
              void queryClient.invalidateQueries({ queryKey: ['brand-delivery-time-slots', brandId ?? ''] });
              void refetchTimeSlots();
              setServerError(t($ => $.workspace.slotExpiredSave));
              return;
            }
          }
           
          if (import.meta.env.DEV) console.log('[SERVER-ERROR] doEditSave onError — generic:', extractMessage(err));
          setServerError(extractMessage(err));
        },
      },
    );
  };

  const handleSubmit = (values: ManualOrderFormValues) => {
     
    if (import.meta.env.DEV) console.log('[Submit][STEP 2] Zod PASSED — handleSubmit entered. lines:', values.lines.length, '| status:', values.status);
    setServerError(null);
    if (isEdit && order) {
      // If order is in an active Distribution stage, show Impact Analysis dialog first.
      if (distributionStage?.is_active) {
        setPendingSubmitValues(values);
        return;
      }
      doEditSave(values);
      return;
    }
     
    if (import.meta.env.DEV) console.log('[Submit][STEP 3] config check — is_ready:', configHealth?.is_ready);
    if (configHealth && !configHealth.is_ready) {
      setServerError(t($ => $.workspace.brandConfigIncomplete));
      return;
    }
    // Financial consistency validation
    const filledLines = values.lines.filter((l) => Boolean(l.product_id));
     
    if (import.meta.env.DEV) console.log('[Submit][STEP 3] financial validation — filledLines:', filledLines.length);
    if (filledLines.length > 0) {
      const productsTotal = filledLines.reduce(
        (s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0),
        0,
      );
      if (productsTotal === 0) {
        setServerError(t($ => $.workspace.pricingZero));
        return;
      }
      const hasZeroPrice = filledLines.some((l) => !l.unit_price || Number(l.unit_price) === 0);
      if (hasZeroPrice) {
         
        if (import.meta.env.DEV) console.log('[Submit][STEP 3] BLOCKED — zero-price line detected:', filledLines.filter((l) => !l.unit_price || Number(l.unit_price) === 0));
        setServerError(t($ => $.workspace.pricingMissing));
        return;
      }
    }
    const shippingCost = Number(values.shipping_cost || 0);
    if (shippingCost > 0 && shippingQuote && shippingQuote.coverage_status !== 'covered') {
       
      if (import.meta.env.DEV) console.log('[Submit][STEP 3] BLOCKED — shipping cost conflict:', { shippingCost, coverage_status: shippingQuote.coverage_status });
      setServerError(t($ => $.workspace.shippingNotCoveredSave));
      return;
    }
     
    if (import.meta.env.DEV) console.log('[Submit][STEP 4] all validations passed — building payload');
    const payload = toManualPayload(values);
    // pass numeric governorate/city IDs for Shipping Engine validation
    if (shippingGovernorateId) payload.governorate_id = shippingGovernorateId;
    if (shippingCityId) payload.city_id = shippingCityId;
     
    if (import.meta.env.DEV) console.log('[Submit][STEP 5] calling createManual.mutate →', { lines: payload.lines, status: payload.status, shipping_cost: payload.shipping_cost, delivery_window_id: payload.delivery_window_id ?? '(none)', delivery_window: payload.delivery_window ?? '(none)' });
    createManual.mutate(payload, {
      onSuccess: (created) => {
         
        if (import.meta.env.DEV) console.log('[Submit][STEP 6] POST /orders/manual SUCCESS — order id:', created.id);
        navigate(`${ROUTES.orders}/${created.id}`);
      },
      onError: (err) => {
         
        if (import.meta.env.DEV) console.log('[Submit][STEP 6] POST /orders/manual FAILED:', err);
        // Part 7 — Delivery window slot no longer valid (deleted/deactivated between form load and submit)
        if (axios.isAxiosError(err)) {
          const errors = err.response?.data?.errors as Record<string, unknown> | undefined;
          if (errors?.delivery_window_id) {
             
            if (import.meta.env.DEV) console.log('[SLOT-ERROR] createManual onError — delivery_window_id backend rejection → setting slotError');
            form.setValue('delivery_window_id', undefined);
            form.setValue('delivery_window', undefined);
            void queryClient.invalidateQueries({ queryKey: ['brand-delivery-time-slots', brandId ?? ''] });
            void refetchTimeSlots();
            // Inline slot error (not the global banner) so it dismisses when user picks a new slot.
            setSlotError(t($ => $.workspace.slotUnavailableRetry));
            return;
          }
        }
         
        if (import.meta.env.DEV) console.log('[SERVER-ERROR] createManual onError — generic:', extractMessage(err));
        setServerError(extractMessage(err));
      },
    });
  };

  const isPending = isEdit ? updateManual.isPending : createManual.isPending;
  const showContentSections = isEdit || ((!configHealth || configHealth.is_ready) && Boolean(brandId));
  const customerResolved = Boolean(lookupResult) || isNewCustomer;
  const hasProductLine = (watchedLines ?? []).some((l) => Boolean(l.product_id));
  const companyLocked = hasProductLine;

  const progressSteps = [
    { label: t($ => $.workspace.progress.context),  done: Boolean(watchedCompanyId) && Boolean(brandId) && Boolean(watchedChannelId) },
    { label: t($ => $.workspace.progress.customer), done: customerResolved },
    { label: t($ => $.workspace.progress.location), done: Boolean(watchedGovernorate) && (shippingGovernorateId !== null || Boolean(watchedZoneId)) },
    { label: t($ => $.workspace.progress.products), done: hasProductLine },
    { label: t($ => $.workspace.progress.payment),  done: Boolean(watchedPayment) },
    {
      label: t($ => $.workspace.progress.ready),
      done:
        Boolean(watchedCompanyId) &&
        Boolean(brandId) &&
        Boolean(watchedChannelId) &&
        customerResolved &&
        Boolean(watchedGovernorate) &&
        (shippingGovernorateId !== null || Boolean(watchedZoneId)) &&
        hasProductLine &&
        Boolean(watchedPayment) &&
        (configHealth?.is_ready ?? false),
    },
  ];

  return (
    <FormProvider {...form}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={isEdit ? t($ => $.workspace.editOrderTitle, { number: order?.order_number ?? '' }) : t($ => $.workspace.newTitle)}
          breadcrumbs={[
            { label: t($ => $.workspace.home), to: ROUTES.dashboard },
            { label: t($ => $.workspace.orders), to: ROUTES.orders },
            { label: isEdit ? t($ => $.workspace.editBreadcrumb, { number: order?.order_number ?? '' }) : t($ => $.workspace.newTitle) },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(isEdit && order ? `${ROUTES.orders}/${order.id}` : ROUTES.orders)}
              >
                <ArrowLeft className="size-4" />
                {t($ => $.workspace.cancel)}
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                disabled={isPending || isTerminal || (!isEdit && configHealth !== undefined && !configHealth.is_ready)}
              >
                {isEdit
                  ? (isPending ? t($ => $.workspace.saving) : t($ => $.workspace.save))
                  : (isPending ? t($ => $.workspace.creating) : t($ => $.workspace.create))}
              </Button>
            </div>
          }
        />

        {!isEdit && <ProgressIndicator steps={progressSteps} />}

        {/* Distribution SSOT banner — visible when editing an order assigned to a trip */}
        {isEdit && order ? (
          <OrderDistributionStageBanner orderId={order.id} compact />
        ) : null}

        {/* Impact Analysis Dialog — intercepts save when order is in active distribution stage */}
        {isEdit && order && pendingSubmitValues && distributionStage ? (
          <ImpactAnalysisDialog
            open={pendingSubmitValues !== null}
            stage={distributionStage}
            onConfirm={() => {
              const values = pendingSubmitValues;
              setPendingSubmitValues(null);
              doEditSave(values);
            }}
            onCancel={() => setPendingSubmitValues(null)}
          />
        ) : null}

        <form
          id={FORM_ID}
          onSubmit={(e) => {
             
            if (import.meta.env.DEV) console.log('[Submit][STEP 1] form onSubmit fired — running RHF + Zod');
            return form.handleSubmit(
              handleSubmit,
              (errs) => {
                 
                if (import.meta.env.DEV) console.log('[Submit][STEP 2] Zod FAILED — validation errors:', errs);
                // Silent failures are forbidden — surface the first blocking error to the user.
                const linesMsg = (errs.lines as { message?: string } | undefined)?.message;
                const firstFieldMsg = Object.entries(errs)
                  .filter(([k]) => k !== 'lines')
                  .map(([, v]) => (v as { message?: string })?.message)
                  .filter(Boolean)[0] as string | undefined;
                 
                if (import.meta.env.DEV) console.log('[SERVER-ERROR] onInvalid (Zod) — errors:', errs, '→ message:', linesMsg ?? firstFieldMsg);
                setServerError(linesMsg ?? firstFieldMsg ?? t($ => $.workspace.formError));
              },
            )(e);
          }}
        >
          {serverError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>{t($ => $.workspace.errorLabel)}</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {isTerminal && (
            <Alert className="mb-4 border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/20">
              <Lock className="size-4 text-red-600 dark:text-red-400" />
              <AlertTitle className="text-red-700 dark:text-red-400">{t($ => $.workspace.readOnlyAlert, { status: order?.status_label ?? order?.status })}</AlertTitle>
              <AlertDescription className="text-red-600/80 dark:text-red-400/80">
                {t($ => $.workspace.terminalMessage)}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            <div className="flex min-w-0 flex-col gap-4">

              {/* § 1 — Order Context */}
              <Card>
                <CardContent className="pt-4">
                  {isEdit ? (
                    /* Edit mode: channel | smart status selector | date */
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField name="channel_id_display" label={t($ => $.workspace.fields.salesChannel)}>
                        <div className="flex h-9 items-center gap-1.5 rounded-md border bg-muted/50 px-3 text-sm">
                          <span className="flex-1 truncate">
                            {order?.channel?.name ?? order?.channel_id ?? '—'}
                          </span>
                          <Badge variant="secondary" className="shrink-0 text-[10px]">{t($ => $.workspace.locked)}</Badge>
                        </div>
                      </FormField>

                      <FormField name="status" label={t($ => $.workspace.fields.orderStatus)}>
                        {order ? (
                          <SmartStatusSelector order={order} />
                        ) : (
                          <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">—</div>
                        )}
                      </FormField>

                      <FormField name="order_date" label={t($ => $.workspace.fields.orderDate)}>
                        <Input type="date" {...form.register('order_date')} />
                      </FormField>
                    </div>
                  ) : (
                    /* Create mode: full cascade */
                    <div className="grid gap-3 sm:grid-cols-3">

                      {/* PART 1 — Company selector (locks when products added) */}
                      <FormField name="company_id" label={t($ => $.workspace.fields.company)} required>
                        {companyLocked ? (
                          <div className="flex h-9 items-center gap-1.5 rounded-md border bg-muted/50 px-3 text-sm">
                            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate font-medium">
                              {companyOptions.find((c) => c.value === watchedCompanyId)?.label ?? watchedCompanyId}
                            </span>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">{t($ => $.workspace.locked)}</Badge>
                          </div>
                        ) : (
                          <Controller
                            control={form.control}
                            name="company_id"
                            render={({ field }) => (
                              <Combobox
                                options={companyOptions}
                                value={field.value ?? null}
                                onChange={handleCompanyChange}
                                placeholder={t($ => $.workspace.selectCompany)}
                              />
                            )}
                          />
                        )}
                        {form.formState.errors.company_id && (
                          <p className="mt-1 text-xs text-destructive">
                            {form.formState.errors.company_id.message}
                          </p>
                        )}
                      </FormField>

                      {/* Brand */}
                      <FormField name="brand_id_display" label={t($ => $.workspace.fields.brand)} required>
                        {!watchedCompanyId ? (
                          <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                            {t($ => $.workspace.selectACompanyFirst)}
                          </div>
                        ) : (
                          <div className="relative">
                            <Combobox
                              options={brandOptions}
                              value={brandId}
                              onChange={handleBrandChange}
                              placeholder={t($ => $.workspace.selectBrand)}
                              loading={loadingBrands}
                            />
                          </div>
                        )}
                      </FormField>

                      {/* Sales Channel */}
                      <FormField name="channel_id" label={t($ => $.workspace.fields.salesChannel)} required>
                        {!brandId ? (
                          <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                            {t($ => $.workspace.selectABrandFirst)}
                          </div>
                        ) : loadingChannels ? (
                          <div className="flex h-9 items-center px-1"><InlineSpinner label={t($ => $.workspace.loadingChannels)} /></div>
                        ) : (
                          <Controller
                            control={form.control}
                            name="channel_id"
                            render={({ field }) => (
                              <Combobox
                                options={channelOptions}
                                value={field.value ?? null}
                                onChange={handleChannelChange}
                                placeholder={t($ => $.workspace.selectChannel_ph)}
                              />
                            )}
                          />
                        )}
                      </FormField>

                      {/* Entry Status — always a Select, loaded from brand order policy */}
                      <div>
                        <p className="mb-1 text-xs font-medium text-foreground/80">{t($ => $.workspace.fields.entryStatus)}</p>
                        {!orderPolicy && brandId ? (
                          <div className="flex h-9 items-center px-1"><InlineSpinner label={t($ => $.workspace.loadingPolicy)} /></div>
                        ) : orderPolicy ? (() => {
                          const mp = orderPolicy.source_entry_policies.manual;
                          const all = Array.isArray(mp) ? mp : [mp];
                          const choices = all.filter((s) => !INTERNAL_STATUSES.has(s));
                          const validChoices = choices.length > 0 ? choices : all;
                          return (
                            <Select
                              value={form.watch('status') ?? validChoices[0] ?? ''}
                              onValueChange={(v) => form.setValue('status', v, { shouldDirty: true })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={t($ => $.workspace.selectEntryStatus)} />
                              </SelectTrigger>
                              <SelectContent>
                                {validChoices.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {t($ => $.status[s], { defaultValue: STATUS_LABELS[s] ?? s })}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })() : (
                          <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                            {t($ => $.workspace.selectABrandFirst)}
                          </div>
                        )}
                      </div>

                      {/* Part 1 — Delivery Date (defaults to today) */}
                      <FormField name="requested_delivery_date" label={t($ => $.workspace.fields.deliveryDate)}>
                        <Input type="date" {...form.register('requested_delivery_date')} />
                      </FormField>

                      {/* Part 1 — Future delivery date info banner */}
                      {isDeliveryFuture && (
                        <div className="sm:col-span-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-400">
                          <CalendarDays className="size-3.5 shrink-0" />
                          {t($ => $.workspace.futureDateNote, { status: t($ => $.workspace.rescheduledStatus) })}
                        </div>
                      )}

                      {/* Delivery Time Slot (from Brand Shipping & Delivery) */}
                      <FormField name="delivery_window_id" label={t($ => $.workspace.fields.deliveryTimeSlot)}>
                        {!brandId ? (
                          <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-sm text-muted-foreground">
                            {t($ => $.workspace.selectABrandFirst)}
                          </div>
                        ) : loadingWindows ? (
                          <div className="flex h-9 items-center px-1"><InlineSpinner label={t($ => $.workspace.loadingTimeSlots)} /></div>
                        ) : !loadingWindows && activeTimeSlots.length === 0 ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20 p-2.5 flex flex-col gap-1.5">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              {t($ => $.workspace.noTimeSlots)}
                            </p>
                            <button
                              type="button"
                              onClick={() => navigate(ROUTES.brands)}
                              className="flex items-center gap-1 text-xs text-primary hover:underline w-fit"
                            >
                              <ExternalLink className="size-3" />
                              {t($ => $.workspace.manageTimeSlots)}
                            </button>
                          </div>
                        ) : (
                          <>
                            <Controller
                              control={form.control}
                              name="delivery_window_id"
                              render={({ field }) => (
                                <Combobox
                                  options={windowOptions}
                                  value={field.value ?? null}
                                  onChange={handleWindowChange}
                                  placeholder={t($ => $.workspace.selectTimeSlot)}
                                />
                              )}
                            />
                            {slotError && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                                <AlertTriangle className="size-3 shrink-0" />
                                {slotError}
                              </p>
                            )}
                          </>
                        )}
                      </FormField>
                    </div>
                  )}

                  {/* PART 1 — Brand health check (create mode only, after brand selected) */}
                  {!isEdit && brandId && (
                    <div className="mt-3">
                      {loadingHealth ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="size-3 animate-spin" />
                          {t($ => $.workspace.checkingBrandConfig)}
                        </div>
                      ) : configHealth && !configHealth.is_ready ? (
                        <BrandConfigHealthCard
                          health={configHealth}
                          brandId={brandId}
                          brandName={brandName}
                        />
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* § 2 — Customer & Delivery */}
              {showContentSections && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t($ => $.workspace.customerDelivery)}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {!isEdit && (
                      <OrderCustomerLookupField
                        onFound={handleCustomerFound}
                        onNotFound={handleCustomerNotFound}
                        onClear={handleLookupClear}
                      />
                    )}

                    {lookupResult && (
                      <>
                        <OrderCustomerIntelligencePanel
                          stats={lookupResult.stats}
                          customerName={lookupResult.customer.name}
                          customerId={lookupResult.customer.id}
                        />
                        <OrderCustomerAlerts stats={lookupResult.stats} />
                        {/* Phase 5 — Customer matching policy decision */}
                        {orderPolicy?.customer_matching_policy && (
                          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                            <Shield className="size-3.5 shrink-0 text-primary" />
                            <span>
                              {t($ => $.workspace.policyPrefix)} <span className="font-medium text-foreground">
                                {t($ => $.workspace.matchingPolicies[orderPolicy.customer_matching_policy], { defaultValue: MATCHING_POLICY_LABELS[orderPolicy.customer_matching_policy] ?? orderPolicy.customer_matching_policy })}
                              </span>
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    {(isEdit || isNewCustomer || lookupResult) && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {isNewCustomer && (
                          <div className="sm:col-span-2">
                            <FormField name="customer_name" label={t($ => $.workspace.fields.customerName)} required>
                              <Input placeholder={t($ => $.workspace.fullNamePlaceholder)} {...form.register('customer_name')} />
                              {form.formState.errors.customer_name && (
                                <p className="mt-1 text-xs text-destructive">
                                  {form.formState.errors.customer_name.message}
                                </p>
                              )}
                            </FormField>
                          </div>
                        )}

                        {isNewCustomer && (
                          <FormField name="customer_phone" label={t($ => $.workspace.fields.primaryPhone)}>
                            <Input placeholder={t($ => $.workspace.phonePlaceholder)} {...form.register('customer_phone')} />
                          </FormField>
                        )}

                        <FormField name="customer_secondary_phone" label={t($ => $.workspace.fields.secondaryPhone)}>
                          <Input placeholder={t($ => $.workspace.secondaryPhonePlaceholder)} {...form.register('customer_secondary_phone')} />
                        </FormField>

                        {/* Governorate */}
                        <FormField name="governorate" label={t($ => $.workspace.fields.governorate)} required>
                          {loadingGeo ? (
                            <div className="flex h-9 items-center px-1"><InlineSpinner label={t($ => $.workspace.loadingGeography)} /></div>
                          ) : (
                            <Controller
                              control={form.control}
                              name="governorate"
                              render={() => (
                                <Combobox
                                  options={governorateOptions}
                                  value={govComboValue}
                                  onChange={handleGovernorateChange}
                                  placeholder={governorateOptions.length ? t($ => $.workspace.selectGovernorate) : t($ => $.workspace.noGovernorates)}
                                />
                              )}
                            />
                          )}
                        </FormField>

                        {/* City — shipping engine combobox when new engine active */}
                        {shippingGovernorateId !== null && (
                          <FormField name="city" label={t($ => $.workspace.fields.city)}>
                            {loadingCities ? (
                              <div className="flex h-9 items-center px-1"><InlineSpinner label={t($ => $.workspace.loadingCities)} /></div>
                            ) : cityOptions.length > 0 ? (
                              <Combobox
                                options={cityOptions}
                                value={shippingCityId ? String(shippingCityId) : null}
                                onChange={handleCityChange}
                                placeholder={t($ => $.workspace.selectCity)}
                              />
                            ) : (
                              <div className="flex h-9 items-center rounded-md border border-dashed px-3 text-xs text-muted-foreground">
                                {t($ => $.workspace.allCitiesCovered)}
                              </div>
                            )}
                          </FormField>
                        )}

                        {/* City — free-text fallback when new shipping engine has no data for this governorate
                            Ensures city is always visible/editable in edit mode and legacy geography mode */}
                        {shippingGovernorateId === null && (isEdit || govComboValue !== null) && (
                          <FormField name="city" label={t($ => $.workspace.fields.city)}>
                            <Input
                              placeholder={t($ => $.workspace.cityDistrictPlaceholder)}
                              {...form.register('city')}
                            />
                          </FormField>
                        )}

                        {/* Delivery Zone (only shown when legacy geography available) */}
                        {zoneOptions.length > 0 && (
                          <FormField name="delivery_zone_id" label={t($ => $.workspace.fields.deliveryZone)}>
                            <Controller
                              control={form.control}
                              name="delivery_zone_id"
                              render={({ field }) => (
                                <Combobox
                                  options={zoneOptions}
                                  value={field.value ?? null}
                                  onChange={handleZoneChange}
                                  placeholder={watchedGovernorate ? t($ => $.workspace.selectZone) : t($ => $.workspace.selectGovFirst)}
                                  disabled={!watchedGovernorate}
                                />
                              )}
                            />
                          </FormField>
                        )}

                        {/* Phase 7 — Shipping Engine Preview */}
                        {shippingGovernorateId && (
                          <div className="sm:col-span-2">
                            {quoteFetching ? (
                              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                                <Loader2 className="size-3 animate-spin" />
                                {t($ => $.workspace.checkingShipping)}
                              </div>
                            ) : shippingQuote ? (() => {
                              const cs = shippingQuote.coverage_status ?? (shippingQuote.available ? 'covered' : 'needs_review');
                              const isCovered     = cs === 'covered';
                              const isUnavailable = cs === 'unavailable';
                              const borderBg = isCovered
                                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/30'
                                : isUnavailable
                                ? 'border-red-200 bg-red-50 dark:border-red-800/50 dark:bg-red-950/30'
                                : 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30';
                              const tc = isCovered
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : isUnavailable
                                ? 'text-red-700 dark:text-red-400'
                                : 'text-amber-700 dark:text-amber-400';
                              const coverageLabel = isCovered ? t($ => $.workspace.covered) : isUnavailable ? t($ => $.workspace.unavailable) : t($ => $.workspace.needsReview);
                              return (
                                <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${borderBg}`}>
                                  <Truck className={`size-3.5 shrink-0 mt-0.5 ${tc}`} />
                                  <div className="flex-1 space-y-0.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={`font-medium ${tc}`}>{coverageLabel}</span>
                                      {isCovered && shippingQuote.shipping_price != null && (
                                        <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                          {money(shippingQuote.shipping_price)}
                                        </span>
                                      )}
                                    </div>
                                    {shippingQuote.preferred_provider && (
                                      <div className="text-muted-foreground">{t($ => $.workspace.viaProvider, { provider: shippingQuote.preferred_provider })}</div>
                                    )}
                                    {shippingQuote.delivery_days != null && (
                                      <div className="text-muted-foreground">
                                        {shippingQuote.same_day
                                          ? t($ => $.workspace.sameDayDelivery)
                                          : t($ => $.workspace.estDays, { count: shippingQuote.delivery_days })}
                                      </div>
                                    )}
                                    {shippingQuote.validation_message && (
                                      <div className={tc}>{shippingQuote.validation_message}</div>
                                    )}
                                    {!isCovered && !isUnavailable && (
                                      <div className="text-amber-600 dark:text-amber-400">
                                        {t($ => $.workspace.shippingFlaggedReview)}
                                      </div>
                                    )}
                                    {isUnavailable && (
                                      <div className="text-red-600 dark:text-red-400">
                                        {t($ => $.workspace.shippingAreaNotCovered)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })() : null}
                          </div>
                        )}

                        <input type="hidden" {...form.register('area')} />
                        <input type="hidden" {...form.register('location_source')} />

                        <div className="sm:col-span-2">
                          <FormField name="shipping_address" label={t($ => $.workspace.fields.streetAddress)}>
                            <Input placeholder={t($ => $.workspace.streetAddressPlaceholder)} {...form.register('shipping_address')} />
                          </FormField>
                        </div>

                        {/* Address details — Building / Floor / Apartment / Landmark */}
                        <FormField name="building" label={t($ => $.workspace.fields.building)}>
                          <Input placeholder={t($ => $.workspace.buildingPlaceholder)} {...form.register('building')} />
                        </FormField>

                        <FormField name="floor" label={t($ => $.workspace.fields.floor)}>
                          <Input placeholder={t($ => $.workspace.floorPlaceholder)} {...form.register('floor')} />
                        </FormField>

                        <FormField name="apartment" label={t($ => $.workspace.fields.apartment)}>
                          <Input placeholder={t($ => $.workspace.apartmentPlaceholder)} {...form.register('apartment')} />
                        </FormField>

                        <FormField name="landmark" label={t($ => $.workspace.fields.landmark)}>
                          <Input placeholder={t($ => $.workspace.landmarkPlaceholder)} {...form.register('landmark')} />
                        </FormField>

                        {/* Parts 1+2 — Google Maps URL import with short-URL resolution */}
                        <div className="sm:col-span-2">
                          <FormField name="google_maps_url" label={t($ => $.workspace.fields.gpsLocation)}>
                            {locImported && currentLat != null && currentLng != null ? (
                              /* GPS Location Card — location set */
                              <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20 p-3 flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                                      {t($ => $.workspace.gpsLocationTitle)}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                                    onClick={handleClearLocation}
                                  >
                                    {t($ => $.workspace.replaceLocation)}
                                  </Button>
                                </div>
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="font-mono text-xs text-foreground/80 tabular-nums">
                                    {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => void navigator.clipboard.writeText(`${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`)}
                                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                      title="Copy coordinates"
                                    >
                                      <Copy className="size-3" />
                                      {t($ => $.workspace.copyCoordinates)}
                                    </button>
                                    <a
                                      href={`https://www.google.com/maps?q=${currentLat},${currentLng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                                    >
                                      <ExternalLink className="size-3" />
                                      {t($ => $.workspace.openInMaps)}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* GPS Location Card — no location */
                              <div className="rounded-md border border-dashed p-3 flex flex-col gap-2">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <MapPin className="size-3.5 shrink-0" />
                                  <span className="text-xs font-medium">{t($ => $.workspace.noGpsLocation)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    placeholder={t($ => $.workspace.mapsPlaceholder)}
                                    {...form.register('google_maps_url')}
                                    className="flex-1 h-8 text-sm"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 shrink-0"
                                    onClick={() => void handleImportMapsUrl()}
                                    disabled={!watchedGoogleMapsUrl || locResolving}
                                  >
                                    {locResolving ? (
                                      <Loader2 className="size-3.5 mr-1 animate-spin" />
                                    ) : (
                                      <MapPin className="size-3.5 mr-1" />
                                    )}
                                    {locResolving ? t($ => $.workspace.resolving) : t($ => $.workspace.importLocation)}
                                  </Button>
                                  {watchedGoogleMapsUrl && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={handleClearLocation}
                                    >
                                      <X className="size-3.5" />
                                    </Button>
                                  )}
                                </div>
                                {mapsUrlError && (
                                  <p className="text-xs text-destructive">{mapsUrlError}</p>
                                )}
                              </div>
                            )}
                          </FormField>
                        </div>

                        <div className="sm:col-span-2">
                          <FormField name="customer_notes" label={t($ => $.workspace.fields.customerNotes)}>
                            <textarea
                              rows={2}
                              placeholder={t($ => $.workspace.customerNotesPlaceholder)}
                              className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                              {...form.register('customer_notes')}
                            />
                          </FormField>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* § 3 — Products */}
              {showContentSections && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base">{t($ => $.workspace.productsCard)}</CardTitle>
                      {watchedChannelId && loadingProducts && (
                        <InlineSpinner label={t($ => $.workspace.loadingProducts)} />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ManualOrderProductsSection
                      finishedProducts={fgProducts}
                      rawMaterials={rawMaterials}
                      channelSelected={Boolean(watchedChannelId) || isStructurallyLocked}
                      loadingProducts={loadingProducts && fgProducts.length === 0}
                      locked={isStructurallyLocked}
                    />
                  </CardContent>
                </Card>
              )}

              {/* § 3.5 — Inventory Status Card (TASK-ORDER-INVENTORY-STATUS-001) */}
              {showContentSections && !isEdit && (
                <OrderInventoryStatusCard
                  orderPolicy={orderPolicy}
                  lines={watchedLines ?? []}
                  allProductMap={allProductMap}
                  onViewPolicy={() => setShowPolicyPanel(true)}
                />
              )}

              {/* § 4 — Payment & Shipping */}
              {showContentSections && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{t($ => $.workspace.paymentShipping)}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <OrderPaymentSection
                      paymentProofPolicy={orderPolicy?.payment_proof_policy}
                      paymentMethods={policyPaymentMethods}
                    />

                    {/* Shipping cost — read-only when structurally locked or auto-calculated */}
                    <div className="border-t pt-4">
                      <FormField name="shipping_cost" label={t($ => $.workspace.fields.shippingCost)}>
                        {isStructurallyLocked ? (
                          <div className="flex h-9 items-center justify-between rounded-md border bg-muted/50 px-3 text-sm">
                            <span className="font-medium tabular-nums">
                              {money(Number(form.watch('shipping_cost') || 0))}
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="size-3" />
                              {t($ => $.workspace.locked)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {!overrideUnlocked && watchedShipSrc === 'auto' ? (
                              /* Part 5 — Auto display */
                              <div className="flex h-9 flex-1 items-center justify-between rounded-md border bg-muted/50 px-3 text-sm">
                                <input type="hidden" {...form.register('shipping_cost')} />
                                <span className="font-medium tabular-nums">
                                  {money(Number(form.watch('shipping_cost') || 0))}
                                </span>
                                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="size-3" />
                                  {t($ => $.workspace.calculatedAutomatically)}
                                </span>
                              </div>
                            ) : (
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                {...form.register('shipping_cost')}
                                className="flex-1"
                              />
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={handleOverrideToggle}
                              title={overrideUnlocked ? 'Lock to auto rate' : 'Override shipping cost'}
                            >
                              {overrideUnlocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                            </Button>
                          </div>
                        )}
                        {!isStructurallyLocked && watchedShipSrc === 'override' && (
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-600">
                            <Badge variant="outline" className="border-amber-300 px-1.5 py-0 text-[10px] text-amber-600">
                              {t($ => $.workspace.manualOverride)}
                            </Badge>
                            {t($ => $.workspace.willBeAudited)}
                          </p>
                        )}
                      </FormField>
                    </div>

                    {/* Part 3 — Shipping Summary Card (shows whenever a quote is returned) */}
                    {shippingGovernorateId && shippingQuote && (
                      <div className="rounded-md border bg-muted/20 px-3 py-2.5 text-xs">
                        <p className="mb-1.5 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">{t($ => $.workspace.shippingDetails)}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {/* Coverage — dynamic */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">{t($ => $.workspace.coverageLabel)}</span>
                            {(() => {
                              const cs = shippingQuote.coverage_status ?? (shippingQuote.available ? 'covered' : 'needs_review');
                              if (cs === 'covered') return <span className="font-medium text-emerald-600 dark:text-emerald-400">{t($ => $.workspace.covered)}</span>;
                              if (cs === 'unavailable') return <span className="font-medium text-red-600 dark:text-red-400">{t($ => $.workspace.unavailable)}</span>;
                              return <span className="font-medium text-amber-600 dark:text-amber-400">{t($ => $.workspace.needsReview)}</span>;
                            })()}
                          </div>
                          {/* Provider */}
                          {shippingQuote.preferred_provider && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">{t($ => $.workspace.providerLabel)}</span>
                              <span className="font-medium">{shippingQuote.preferred_provider}</span>
                            </div>
                          )}
                          {/* Delivery Days */}
                          {shippingQuote.delivery_days != null && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">{t($ => $.workspace.etaLabel)}</span>
                              <span className="font-medium">
                                {shippingQuote.same_day ? t($ => $.workspace.sameDay) : t($ => $.workspace.days, { count: shippingQuote.delivery_days })}
                              </span>
                            </div>
                          )}
                          {/* COD Allowed */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">{t($ => $.workspace.codLabel)}</span>
                            <span className={cn('font-medium', shippingQuote.cod_allowed ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                              {shippingQuote.cod_allowed ? t($ => $.workspace.codAllowed) : t($ => $.workspace.codNotAvailable)}
                            </span>
                          </div>
                          {/* Time Slot */}
                          {form.watch('delivery_window') && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">{t($ => $.workspace.timeSlotLabel)}</span>
                              <span className="font-medium">{form.watch('delivery_window')}</span>
                            </div>
                          )}
                          {/* Requested Delivery Date */}
                          {watchedDeliveryDate && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">{t($ => $.workspace.deliveryLabel)}</span>
                              <span className="font-medium">{watchedDeliveryDate}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Discount + Deposit — checkbox-first UX */}
                    <div className="grid gap-4 border-t pt-4 sm:grid-cols-3">
                      {/* Discount */}
                      <div className="sm:col-span-2">
                        {isStructurallyLocked ? (
                          /* Read-only discount display when order is structurally locked */
                          <div>
                            <p className="mb-1.5 text-xs font-medium text-foreground/80">{t($ => $.workspace.fields.discount)}</p>
                            {watchedDiscountType ? (
                              <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm">
                                <span className="font-medium tabular-nums">
                                  {form.watch('discount_amount') || '0'}
                                  {watchedDiscountType === 'percentage' ? '%' : ` ${currency}`}
                                </span>
                                <span className="text-xs capitalize text-muted-foreground">({watchedDiscountType})</span>
                                <Lock className="ms-auto size-3 text-muted-foreground/60" />
                              </div>
                            ) : (
                              <div className="flex h-9 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                                {t($ => $.workspace.noDiscount)}
                                <Lock className="ms-auto size-3 text-muted-foreground/60" />
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Editable discount when order is not locked */
                          <>
                            <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground/80">
                              <input
                                type="checkbox"
                                checked={Boolean(watchedDiscountType)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    form.setValue('discount_type', 'percentage');
                                  } else {
                                    form.setValue('discount_type', '');
                                    form.setValue('discount_amount', '');
                                  }
                                }}
                                className="size-3.5 accent-primary"
                              />
                              {t($ => $.workspace.applyDiscount)}
                            </label>
                            {watchedDiscountType && (
                              <div className="flex flex-wrap items-center gap-3 pl-5">
                                <div className="flex items-center gap-3">
                                  {(['percentage', 'fixed'] as const).map((val) => (
                                    <label key={val} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                      <input
                                        type="radio"
                                        value={val}
                                        {...form.register('discount_type')}
                                        className="size-3.5 accent-primary"
                                      />
                                      {val === 'percentage' ? t($ => $.workspace.percentage) : t($ => $.workspace.fixedAmount)}
                                    </label>
                                  ))}
                                </div>
                                <div className="relative max-w-36">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="0.00"
                                    {...form.register('discount_amount')}
                                    className="pr-8"
                                  />
                                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                                    {watchedDiscountType === 'percentage' ? '%' : currency}
                                  </span>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {/* Deposit */}
                      <div>
                        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground/80">
                          <input
                            type="checkbox"
                            checked={depositEnabled}
                            onChange={(e) => {
                              setDepositEnabled(e.target.checked);
                              if (!e.target.checked) form.setValue('deposit_amount', '');
                            }}
                            className="size-3.5 accent-primary"
                          />
                          {t($ => $.workspace.depositReceived)}
                        </label>
                        {depositEnabled && (
                          <div className="relative max-w-36">
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              {...form.register('deposit_amount')}
                              className="pr-10"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                              {currency}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <FormField name="notes" label={t($ => $.workspace.fields.orderNotes)}>
                        <textarea
                          rows={2}
                          placeholder={t($ => $.workspace.orderNotesPlaceholder)}
                          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                          {...form.register('notes')}
                        />
                      </FormField>
                    </div>
                  </CardContent>
                </Card>
              )}
              {/* Part 9 — Applied Brand Policies (compact summary always visible) */}
              {showContentSections && !isEdit && orderPolicy && (
                <div className="rounded-md border">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-muted/30 transition-colors rounded-md"
                    onClick={() => setShowPolicyPanel((v) => !v)}
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <BookOpen className="size-3.5" />
                      <span className="font-medium">{t($ => $.workspace.appliedPolicies)}</span>
                    </span>
                    {showPolicyPanel ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                  </button>

                  {/* Compact always-visible summary row */}
                  <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800">
                      <CheckCircle2 className="size-2.5" />
                      {(() => {
                        const mp = orderPolicy.source_entry_policies.manual;
                        const ss = Array.isArray(mp) ? mp : [mp];
                        const label = ss.length === 1
                          ? t($ => $.status[ss[0]], { defaultValue: STATUS_LABELS[ss[0]] ?? ss[0] })
                          : t($ => $.workspace.entryStatuses, { count: ss.length });
                        return `${t($ => $.workspace.policy.entryStatus)}: ${label}`;
                      })()}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800">
                      <CheckCircle2 className="size-2.5" />
                      {t($ => $.workspace.policy.customerMatching)}: {t($ => $.workspace.matchingPolicies[orderPolicy.customer_matching_policy], { defaultValue: MATCHING_POLICY_LABELS[orderPolicy.customer_matching_policy] ?? orderPolicy.customer_matching_policy })}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                      orderPolicy.auto_reserve_inventory
                        ? 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:ring-sky-800'
                        : 'bg-muted text-muted-foreground ring-border'
                    }`}>
                      <CheckCircle2 className="size-2.5" />
                      {orderPolicy.auto_reserve_inventory ? t($ => $.workspace.autoReserve) : t($ => $.workspace.manualReserve)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800">
                      <CheckCircle2 className="size-2.5" />
                      {t($ => $.workspace.paymentMethodsCount, { count: Object.keys(orderPolicy.payment_proof_policy).length })}
                    </span>
                  </div>

                  {showPolicyPanel && (
                    <div className="border-t px-4 pb-4 pt-3">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                        <div>
                          <dt className="font-medium text-muted-foreground">{t($ => $.workspace.policy.entryStatus)}</dt>
                          <dd className="mt-0.5 font-medium">{(() => {
                            const mp = orderPolicy.source_entry_policies.manual;
                            const ss = Array.isArray(mp) ? mp : [mp];
                            return ss.map((s) => t($ => $.status[s], { defaultValue: STATUS_LABELS[s] ?? s })).join(', ');
                          })()}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-muted-foreground">{t($ => $.workspace.policy.customerMatching)}</dt>
                          <dd className="mt-0.5 font-medium">{t($ => $.workspace.matchingPolicies[orderPolicy.customer_matching_policy], { defaultValue: MATCHING_POLICY_LABELS[orderPolicy.customer_matching_policy] ?? orderPolicy.customer_matching_policy })}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-muted-foreground">{t($ => $.workspace.policy.autoReserveInventory)}</dt>
                          <dd className="mt-0.5 font-medium">{orderPolicy.auto_reserve_inventory ? t($ => $.workspace.policy.yes) : t($ => $.workspace.policy.no)}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-muted-foreground">{t($ => $.workspace.policy.discountPolicy)}</dt>
                          <dd className="mt-0.5 font-medium capitalize">{orderPolicy.discount_policy.replace(/_/g, ' ')}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="font-medium text-muted-foreground mb-1.5">{t($ => $.workspace.policy.paymentProofRequirements)}</dt>
                          <dd className="flex flex-wrap gap-1.5">
                            {Object.entries(orderPolicy.payment_proof_policy).map(([method, req]) => (
                              <span
                                key={method}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                                  req === 'required'
                                    ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800'
                                    : req === 'optional'
                                    ? 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-800'
                                    : 'bg-muted text-muted-foreground ring-border'
                                }`}
                              >
                                <Info className="size-2.5" />
                                {t($ => $.workspace.paymentMethodLabels[method], { defaultValue: PAYMENT_METHOD_LABELS[method] ?? method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) })}: {req}
                              </span>
                            ))}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right sidebar — sticky summary */}
            <div>
              <LiveFinancialSummary />
            </div>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
