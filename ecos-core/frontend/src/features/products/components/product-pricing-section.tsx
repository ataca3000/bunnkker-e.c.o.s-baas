import { useFormContext, useWatch, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Lock, Unlock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  computeGrossProfit,
  computeFinalMargin,
  computeSuggestedPrice,
  getPriceHealth,
  marginColorClass,
} from '@/features/products/lib/pricing-utils';
import type { ProductFormValues } from '@/features/products/components/product-form-schema';
import type { Product } from '@/features/products/types/product';
import { ROUTES } from '@/router/routes';

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ReadOnlyField({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      {note ? <p className="text-[10px] text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function PriceHealthBadge({ marginPct }: { marginPct: number | null }) {
  const { t } = useTranslation('products');
  const tAny = t as (key: string) => string;
  const health = getPriceHealth(marginPct);
  if (!health) return <span className="text-muted-foreground text-xs">—</span>;
  const labelKey = `detailDrawer.priceHealth${health.label.charAt(0).toUpperCase()}${health.label.slice(1)}`;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
        health.cls,
      )}
    >
      {health.emoji} {tAny(labelKey)}
    </span>
  );
}

type Props = {
  existingProduct?: Product | null;
};

export function ProductPricingSection({ existingProduct }: Props) {
  const { t } = useTranslation('products');
  const navigate = useNavigate();
  const { control, setValue } = useFormContext<ProductFormValues>();

  const [manualCost, markupPct, discountPct, regularPrice, salePrice, useBrandPricing] = useWatch({
    control,
    name: ['manual_cost', 'markup_pct', 'discount_pct', 'regular_price', 'sale_price', 'use_brand_pricing'],
  });

  const locked = useBrandPricing === true;
  const hasRecipe = existingProduct?.has_recipe ?? false;

  const effectiveCost: number | null = hasRecipe
    ? (existingProduct?.product_cost ?? null)
    : (manualCost ?? null);

  const markupVal = markupPct ?? 30;
  const discountVal = discountPct ?? 0;
  const suggestedPrice = computeSuggestedPrice(effectiveCost, markupVal);

  // Suggested sale price preview — live from discount% and regular price
  const suggestedSalePrice: number | null =
    regularPrice != null && regularPrice > 0 && discountVal > 0
      ? parseFloat((regularPrice * (1 - discountVal / 100)).toFixed(2))
      : null;

  const grossProfitPct = computeGrossProfit(regularPrice, effectiveCost);
  const finalMarginPct = computeFinalMargin(regularPrice, salePrice, effectiveCost);

  const pricingSource = hasRecipe
    ? { label: 'Recipe', date: existingProduct?.active_recipe?.updated_at ?? existingProduct?.updated_at }
    : { label: 'Manual Override', date: existingProduct?.updated_at };

  const fmtDate = (d: string | null | undefined) =>
    d ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(d)) : null;

  return (
    <div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-4">
      {/* Header with Use Brand Defaults toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t($ => $.pricingSection.title)}</p>
        <Controller
          control={control}
          name="use_brand_pricing"
          render={({ field }) => (
            <label
              className="flex cursor-pointer items-center gap-1.5 select-none"
              aria-label="Use brand defaults for pricing"
            >
              {field.value ? (
                <Lock className="size-3.5 text-primary" aria-hidden />
              ) : (
                <Unlock className="size-3.5 text-muted-foreground" aria-hidden />
              )}
              <input
                type="checkbox"
                className="sr-only"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
              />
              <span
                className={cn(
                  'inline-flex h-5 w-9 items-center rounded-full border transition-colors',
                  field.value ? 'border-primary bg-primary' : 'border-border bg-background',
                )}
              >
                <span
                  className={cn(
                    'inline-block size-3.5 rounded-full bg-white shadow transition-transform',
                    field.value ? 'translate-x-4' : 'translate-x-0.5',
                  )}
                />
              </span>
              <span className="text-xs text-muted-foreground">
                {field.value ? t($ => $.pricingSection.brandDefaults) : t($ => $.pricingSection.custom)}
              </span>
            </label>
          )}
        />
      </div>

      {/* Locked-mode indicator */}
      {locked && (
        <div className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
          <Lock className="size-3" aria-hidden />
          {t($ => $.pricingSection.brandDefaultsLocked)}
        </div>
      )}

      {/* 1. Current Product Cost */}
      <div className="rounded-lg border bg-primary/5 border-primary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t($ => $.pricingSection.currentProductCost)}
          </p>
          {hasRecipe ? (
            <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              {t($ => $.pricingSection.liveFromRecipe)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 border-slate-200 bg-slate-50 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
              {t($ => $.pricingSection.manual)}
            </span>
          )}
        </div>

        {hasRecipe ? (
          <p className="text-xl font-semibold tabular-nums">{fmt(effectiveCost)}</p>
        ) : (
          <Controller
            control={control}
            name="manual_cost"
            render={({ field }) => (
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))
                }
                className="h-9 w-40 text-base font-semibold tabular-nums"
                aria-label="Manual product cost"
              />
            )}
          />
        )}
      </div>

      {/* 2. Markup % + Suggested Price (only when cost is known) */}
      {effectiveCost != null && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 items-end">
          {/* Markup % */}
          <div className="flex flex-col gap-1">
            <label
              className={cn('text-xs', locked ? 'text-muted-foreground/60' : 'text-muted-foreground')}
              htmlFor="form-markup-pct"
            >
              {t($ => $.pricingSection.markupPct)}
            </label>
            <Controller
              control={control}
              name="markup_pct"
              render={({ field }) => (
                <Input
                  id="form-markup-pct"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="30"
                  value={field.value ?? ''}
                  readOnly={locked}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))
                  }
                  className={cn('h-8 text-sm', locked && 'pointer-events-none bg-muted/50 text-muted-foreground')}
                  aria-readonly={locked}
                />
              )}
            />
          </div>

          <ReadOnlyField label={t($ => $.pricingSection.suggestedRegular)} value={fmt(suggestedPrice)} />

          {suggestedPrice != null && !locked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs self-end sm:col-start-4"
              onClick={() => {
                const rounded = parseFloat(suggestedPrice.toFixed(2));
                setValue('regular_price', rounded, { shouldValidate: false });
                if (discountVal > 0) {
                  const newSale = parseFloat((rounded * (1 - discountVal / 100)).toFixed(2));
                  setValue('sale_price', newSale, { shouldValidate: false });
                }
              }}
            >
              {t($ => $.pricingSection.applyBtn)}
            </Button>
          )}
        </div>
      )}

      {/* 3. Regular Price → Discount % → Sale Price */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Regular Price */}
        <div className="flex flex-col gap-1">
          <label
            className={cn('text-xs', locked ? 'text-muted-foreground/60' : 'text-muted-foreground')}
            htmlFor="form-regular-price"
          >
            {t($ => $.pricingSection.regularPrice)}
          </label>
          <Controller
            control={control}
            name="regular_price"
            render={({ field }) => (
              <Input
                id="form-regular-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={field.value ?? ''}
                readOnly={locked}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseFloat(e.target.value);
                  field.onChange(v);
                  if (!locked && discountVal > 0 && v != null && v > 0) {
                    const newSale = parseFloat((v * (1 - discountVal / 100)).toFixed(2));
                    setValue('sale_price', newSale, { shouldValidate: false });
                  }
                }}
                className={cn('h-8 text-sm', locked && 'pointer-events-none bg-muted/50 text-muted-foreground')}
                aria-readonly={locked}
              />
            )}
          />
        </div>

        {/* Discount % */}
        <div className="flex flex-col gap-1">
          <label
            className={cn('text-xs', locked ? 'text-muted-foreground/60' : 'text-muted-foreground')}
            htmlFor="form-discount-pct"
          >
            {t($ => $.pricingSection.discountPct)}
          </label>
          <Controller
            control={control}
            name="discount_pct"
            render={({ field }) => (
              <Input
                id="form-discount-pct"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="0"
                value={field.value ?? ''}
                readOnly={locked}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseFloat(e.target.value);
                  field.onChange(v);
                  if (!locked && regularPrice != null && regularPrice > 0) {
                    const d = v ?? 0;
                    const newSale = d > 0
                      ? parseFloat((regularPrice * (1 - d / 100)).toFixed(2))
                      : null;
                    setValue('sale_price', newSale, { shouldValidate: false });
                  }
                }}
                className={cn('h-8 text-sm', locked && 'pointer-events-none bg-muted/50 text-muted-foreground')}
                aria-readonly={locked}
              />
            )}
          />
        </div>

        {/* Sale Price */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label
              className={cn('text-xs', locked ? 'text-muted-foreground/60' : 'text-muted-foreground')}
              htmlFor="form-sale-price"
            >
              {t($ => $.pricingSection.salePrice)}
            </label>
            {suggestedSalePrice != null && !locked && (
              <span className="text-[10px] text-muted-foreground">
                ≈ {fmt(suggestedSalePrice)}
              </span>
            )}
          </div>
          <Controller
            control={control}
            name="sale_price"
            render={({ field }) => (
              <Input
                id="form-sale-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={field.value ?? ''}
                readOnly={locked}
                onChange={(e) =>
                  field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))
                }
                className={cn('h-8 text-sm', locked && 'pointer-events-none bg-muted/50 text-muted-foreground')}
                aria-readonly={locked}
              />
            )}
          />
        </div>
      </div>

      {/* 4. Gross Profit % + Final Margin % */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border bg-card p-2.5">
          <p className="text-[10px] text-muted-foreground mb-0.5">{t($ => $.pricingSection.grossProfitPct)}</p>
          <p
            className={cn(
              'text-base font-semibold tabular-nums',
              grossProfitPct != null ? marginColorClass(grossProfitPct) : 'text-muted-foreground',
            )}
          >
            {grossProfitPct != null ? `${grossProfitPct.toFixed(1)}%` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t($ => $.pricingSection.regularFormula)}</p>
        </div>

        <div className="rounded-md border bg-card p-2.5">
          <p className="text-[10px] text-muted-foreground mb-0.5">{t($ => $.pricingSection.finalMarginPct)}</p>
          <p
            className={cn(
              'text-base font-semibold tabular-nums',
              finalMarginPct != null ? marginColorClass(finalMarginPct) : 'text-muted-foreground',
            )}
          >
            {finalMarginPct != null ? `${finalMarginPct.toFixed(1)}%` : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {salePrice ? t($ => $.pricingSection.saleFormula) : t($ => $.pricingSection.regularFormula)}
          </p>
        </div>
      </div>

      {/* 5. Price Health */}
      <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
        <p className="text-xs text-muted-foreground">{t($ => $.pricingSection.priceHealth)}</p>
        <PriceHealthBadge marginPct={finalMarginPct} />
      </div>

      {/* 6. Pricing Source */}
      {existingProduct && (
        <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
          <div>
            <p className="text-[10px] text-muted-foreground">{t($ => $.pricingSection.pricingSource)}</p>
            <p className="text-xs font-medium mt-0.5">{pricingSource.label}</p>
          </div>
          {pricingSource.date && (
            <p className="text-[10px] text-muted-foreground">{fmtDate(pricingSource.date)}</p>
          )}
        </div>
      )}

      {/* 7. Pending Pricing Review */}
      {existingProduct?.pending_review ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-800 dark:bg-amber-950/40">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {t($ => $.pricingSection.pendingReview)}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 shrink-0 gap-1 text-xs"
            onClick={() => navigate(ROUTES.costManagementPriceReview)}
          >
            <ArrowUpRight className="size-3" />
            {t($ => $.pricingSection.openPriceReview)}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
