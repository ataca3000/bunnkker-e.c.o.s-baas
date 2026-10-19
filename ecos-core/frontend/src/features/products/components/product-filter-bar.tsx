import { useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ProductCategorySelect } from '@/features/products/components/product-category-select';
import { useWarehouseOptions } from '@/features/products/hooks/use-warehouse-options';
import { brandsService } from '@/features/brands/services/brands-service';
import { channelsService } from '@/features/channels/services/channels-service';
import type { ManufacturingAvailabilityFilter, ProductStatusFilter, ProductStockStatusFilter } from '@/features/products/types/product';
import { cn } from '@/lib/utils';

export type ProductFilters = {
  category_id: string | null;
  brand_id: string | null;      // ADR-013: brand is direct product owner
  warehouse_id: string | null;
  channel_id: string | null;
  status: ProductStatusFilter;
  stock_status: ProductStockStatusFilter;
  is_published: boolean | null;
  low_stock: boolean;
  has_images: boolean | null;
  not_synced: boolean;
  has_recipe: 'true' | 'false' | null;
  manufacturing_ready: boolean;
  needs_pricing_review: boolean;
  low_margin: boolean;
  manufacturing_availability: ManufacturingAvailabilityFilter;
};

export const DEFAULT_FILTERS: ProductFilters = {
  category_id: null,
  brand_id: null,
  warehouse_id: null,
  channel_id: null,
  status: 'all',
  stock_status: '',
  is_published: null,
  low_stock: false,
  has_images: null,
  not_synced: false,
  has_recipe: null,
  manufacturing_ready: false,
  needs_pricing_review: false,
  low_margin: false,
  manufacturing_availability: '',
};

function hasActiveFilters(f: ProductFilters): boolean {
  return (
    f.category_id !== null ||
    f.brand_id !== null ||
    f.warehouse_id !== null ||
    f.channel_id !== null ||
    f.status !== 'all' ||
    f.stock_status !== '' ||
    f.is_published !== null ||
    f.low_stock ||
    f.has_images !== null ||
    f.not_synced ||
    f.has_recipe !== null ||
    f.manufacturing_ready ||
    f.needs_pricing_review ||
    f.low_margin ||
    f.manufacturing_availability !== ''
  );
}

// ── Internal hooks ─────────────────────────────────────────────────────────────

function useBrandFilterOptions() {
  return useQuery({
    queryKey: ['brand-filter-options'],
    queryFn: () => brandsService.list({ per_page: 100, sort_by: 'name', sort_dir: 'asc', status: 'active' }),
    staleTime: 5 * 60_000,
    select: (data) => data.items.map((b) => ({ value: b.id, label: b.name })),
  });
}

/**
 * Channel options scoped to a specific brand (via brand_id filter).
 * Falls back to all channels when no brand is selected.
 * Separate query key per brand so React Query caches each scope independently.
 */
function useScopedChannelOptions(brandId: string | null) {
  return useQuery({
    queryKey: ['channel-filter-options', brandId ?? 'all'],
    queryFn: async () => {
      const result = await channelsService.list({
        per_page: 200,
        ...(brandId ? { brand_id: brandId } : {}),
      });
      return result.items.map((c) => ({ value: c.id, label: c.name }));
    },
    staleTime: 60_000,
  });
}

// ── Presentational components ──────────────────────────────────────────────────

type NativeSelectProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
};

function FilterSelect({ label, value, onChange, children }: NativeSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-8 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs',
          'focus:outline-none focus:ring-2 focus:ring-ring/50',
          'dark:bg-input/30',
        )}
      >
        {children}
      </select>
    </div>
  );
}

type ToggleChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function ToggleChip({ label, active, onClick }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-foreground hover:bg-accent',
      )}
    >
      {label}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type ProductFilterBarProps = {
  filters: ProductFilters;
  onChange: (f: Partial<ProductFilters>) => void;
  onClear: () => void;
};

export function ProductFilterBar({ filters, onChange, onClear }: ProductFilterBarProps) {
  const { t } = useTranslation('products');
  const [showMore, setShowMore] = useState(false);

  const { data: brandOptions = [] }   = useBrandFilterOptions();
  // Channel options are scoped to the selected brand — empty brand = all channels
  const { data: channelOptions = [] } = useScopedChannelOptions(filters.brand_id);
  const { data: warehouseOptions = [] } = useWarehouseOptions();

  const active = hasActiveFilters(filters);

  function handleBrandChange(brandId: string) {
    // Changing brand resets channel because the old selection may not belong to the new brand
    onChange({ brand_id: brandId || null, channel_id: null });
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      {/* Primary row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">{t($ => $.filterBar.category)}</label>
          <ProductCategorySelect
            value={filters.category_id}
            onChange={(v) => onChange({ category_id: v })}
            placeholder={t($ => $.filterBar.allCategories)}
            className="h-8 text-sm"
          />
        </div>

        {/* Brand — appears before Channel per ADR-013 ownership hierarchy */}
        <FilterSelect
          label={t($ => $.filterBar.brand)}
          value={filters.brand_id ?? ''}
          onChange={handleBrandChange}
        >
          <option value="">{t($ => $.filterBar.allBrands)}</option>
          {brandOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </FilterSelect>

        {/* Channel — scoped to selected brand when a brand is chosen */}
        <FilterSelect
          label={filters.brand_id ? t($ => $.filterBar.channelBrand) : t($ => $.filterBar.channel)}
          value={filters.channel_id ?? ''}
          onChange={(v) => onChange({ channel_id: v || null })}
        >
          <option value="">
            {filters.brand_id ? t($ => $.filterBar.allBrandChannels) : t($ => $.filterBar.allChannels)}
          </option>
          {channelOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </FilterSelect>

        <FilterSelect
          label={t($ => $.filterBar.status)}
          value={filters.status}
          onChange={(v) => onChange({ status: v as ProductStatusFilter })}
        >
          <option value="all">{t($ => $.filterBar.allStatuses)}</option>
          <option value="active">{t($ => $.filterBar.active)}</option>
          <option value="inactive">{t($ => $.filterBar.inactive)}</option>
        </FilterSelect>

        {/* Action buttons */}
        <div className="ms-auto flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowMore((v) => !v)}
          >
            <SlidersHorizontal className="size-3.5" />
            {t($ => $.filterBar.more)}
            {showMore ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </Button>
          {active ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <X className="size-3.5" />
              {t($ => $.filterBar.clear)}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Smart Filter chips */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {/* Manufacturing Availability */}
        <ToggleChip
          label={t($ => $.filterBar.mfgInStock)}
          active={filters.manufacturing_availability === 'instock'}
          onClick={() => onChange({ manufacturing_availability: filters.manufacturing_availability !== 'instock' ? 'instock' : '' })}
        />
        <ToggleChip
          label={t($ => $.filterBar.mfgOutOfStock)}
          active={filters.manufacturing_availability === 'outofstock'}
          onClick={() => onChange({ manufacturing_availability: filters.manufacturing_availability !== 'outofstock' ? 'outofstock' : '' })}
        />
        <ToggleChip
          label={t($ => $.filterBar.mfgRecipeMissing)}
          active={filters.manufacturing_availability === 'recipe_missing'}
          onClick={() => onChange({ manufacturing_availability: filters.manufacturing_availability !== 'recipe_missing' ? 'recipe_missing' : '' })}
        />

        <span className="h-4 w-px bg-border mx-0.5" aria-hidden />

        {/* Recipe */}
        <ToggleChip
          label={t($ => $.filterBar.hasRecipe)}
          active={filters.has_recipe === 'true'}
          onClick={() => onChange({ has_recipe: filters.has_recipe !== 'true' ? 'true' : null })}
        />
        <ToggleChip
          label={t($ => $.filterBar.missingRecipe)}
          active={filters.has_recipe === 'false'}
          onClick={() => onChange({ has_recipe: filters.has_recipe !== 'false' ? 'false' : null })}
        />

        <span className="h-4 w-px bg-border mx-0.5" aria-hidden />

        {/* Publish */}
        <ToggleChip
          label={t($ => $.filterBar.published)}
          active={filters.is_published === true}
          onClick={() => onChange({ is_published: filters.is_published !== true ? true : null })}
        />
        <ToggleChip
          label={t($ => $.filterBar.unpublished)}
          active={filters.is_published === false}
          onClick={() => onChange({ is_published: filters.is_published !== false ? false : null })}
        />

        <span className="h-4 w-px bg-border mx-0.5" aria-hidden />

        {/* Lifecycle */}
        <ToggleChip
          label={t($ => $.filterBar.priceReviewRequired)}
          active={filters.needs_pricing_review}
          onClick={() => onChange({ needs_pricing_review: !filters.needs_pricing_review })}
        />
        <ToggleChip
          label={t($ => $.filterBar.mfgReady)}
          active={filters.manufacturing_ready}
          onClick={() => onChange({ manufacturing_ready: !filters.manufacturing_ready })}
        />
        <ToggleChip
          label={t($ => $.filterBar.lowMargin)}
          active={filters.low_margin}
          onClick={() => onChange({ low_margin: !filters.low_margin })}
        />
      </div>

      {/* Secondary row (More filters) */}
      {showMore ? (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3">
          <FilterSelect
            label={t($ => $.filterBar.warehouse)}
            value={filters.warehouse_id ?? ''}
            onChange={(v) => onChange({ warehouse_id: v || null })}
          >
            <option value="">{t($ => $.filterBar.allWarehouses)}</option>
            {warehouseOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </FilterSelect>

          <FilterSelect
            label={t($ => $.filterBar.stockStatus)}
            value={filters.stock_status}
            onChange={(v) => onChange({ stock_status: v as ProductStockStatusFilter })}
          >
            <option value="">{t($ => $.filterBar.allStock)}</option>
            <option value="instock">{t($ => $.filterBar.instock)}</option>
            <option value="outofstock">{t($ => $.filterBar.outofstock)}</option>
          </FilterSelect>

          <FilterSelect
            label={t($ => $.filterBar.hasImages)}
            value={filters.has_images === null ? '' : String(filters.has_images)}
            onChange={(v) => onChange({ has_images: v === '' ? null : v === 'true' })}
          >
            <option value="">{t($ => $.filterBar.allStock)}</option>
            <option value="true">{t($ => $.filterBar.withImages)}</option>
            <option value="false">{t($ => $.filterBar.withoutImages)}</option>
          </FilterSelect>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t($ => $.filterBar.other)}</span>
            <div className="flex items-center gap-1.5">
              <ToggleChip
                label={t($ => $.filterBar.lowStock)}
                active={filters.low_stock}
                onClick={() => onChange({ low_stock: !filters.low_stock })}
              />
              <ToggleChip
                label={t($ => $.filterBar.notSynced)}
                active={filters.not_synced}
                onClick={() => onChange({ not_synced: !filters.not_synced })}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
