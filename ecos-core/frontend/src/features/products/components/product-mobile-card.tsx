import { Eye, Package, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { getMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';

import { PublishBadge } from './badges/publish-badge';
import { StockStatusBadge } from './stock-status-badge';
import type { Product } from '../types/product';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Props ─────────────────────────────────────────────────────────────────────

type ProductMobileCardProps = {
  product: Product;
  isSelected?: boolean;
  isFocused?: boolean;
  onView: (product: Product) => void;
  onEdit?: (product: Product) => void;
  onSelect?: (id: string, checked: boolean) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Mobile-optimised card for a single product.
 * Shown below the `md` breakpoint in UniversalDataGrid's renderMobileCard slot.
 */
export function ProductMobileCard({
  product,
  isSelected = false,
  isFocused = false,
  onView,
  onEdit,
  onSelect,
}: ProductMobileCardProps) {
  const { t } = useTranslation('products');

  return (
    <div
      role="listitem"
      aria-selected={isSelected}
      data-focused={isFocused || undefined}
      className={cn(
        'relative border-b last:border-0 p-3.5 transition-colors',
        isSelected ? 'bg-primary/5' : 'bg-card',
        isFocused && 'outline outline-1 -outline-offset-1 outline-primary/50',
      )}
    >
      {/* Checkbox */}
      {onSelect ? (
        <div className="absolute left-3.5 top-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(product.id, e.target.checked)}
            className="size-4 cursor-pointer rounded accent-primary"
            aria-label={`Select ${product.name}`}
          />
        </div>
      ) : null}

      {/* Main content row */}
      <button
        type="button"
        className={cn('flex w-full items-start gap-3 text-start', onSelect && 'pl-7')}
        onClick={() => onView(product)}
        aria-label={`View ${product.name}`}
      >
        {/* Thumbnail */}
        {getMediaUrl(product.image_url) ? (
          <img
            src={getMediaUrl(product.image_url)!}
            alt=""
            className="size-12 shrink-0 rounded border object-cover"
          />
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded border bg-muted">
            <Package className="size-5 text-muted-foreground" />
          </div>
        )}

        {/* Details */}
        <div className="min-w-0 flex-1">
          {/* Row 1: Name + Price */}
          <div className="mb-0.5 flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium leading-tight" title={product.name}>
              {product.name}
            </p>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatPrice(product.regular_price)}
            </span>
          </div>

          {/* Row 2: SKU */}
          <p className="mb-1.5 font-mono text-[11px] text-muted-foreground">{product.sku}</p>

          {/* Row 3: Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <StockStatusBadge status={product.stock_status} />
            <PublishBadge published={product.is_published} />
          </div>
        </div>
      </button>

      {/* Quick actions */}
      <div className={cn('mt-2.5 flex items-center justify-end gap-0.5', onSelect && 'pl-7')}>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={(e) => { e.stopPropagation(); onView(product); }}
          aria-label={t($ => $.mobileCard.viewProduct)}
        >
          <Eye className="size-3.5" />
        </Button>
        {onEdit ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={(e) => { e.stopPropagation(); onEdit(product); }}
            aria-label={t($ => $.mobileCard.editProduct)}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
