import { useMemo, useState } from 'react';
import { AlertTriangle, Lock, Package, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Product } from '@/features/products/types/product';
import { getMediaUrl } from '@/lib/media';

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function resolvedPrice(p: Product): number | null {
  return p.sale_price ?? p.regular_price ?? null;
}

const PAGE_SIZE = 30;

type Props = {
  products: Product[];
  onAdd: (product: Product) => void;
  isLoading?: boolean;
};

export function ProductBrowser({ products, onAdd, isLoading = false }: Props) {
  const { t } = useTranslation('orders');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)),
    );
  }, [products, search]);

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const hiddenCount = filtered.length - visible.length;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        {t($ => $.productBrowser.loading)}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
        <Package className="size-8 opacity-30" />
        <span>{t($ => $.productBrowser.noProducts)}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t($ => $.productBrowser.searchPlaceholder)}
          className="pl-8 text-sm"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowAll(false);
          }}
        />
      </div>

      {filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t($ => $.productBrowser.noResults, { query: search })}
        </p>
      )}

      {/* Product grid */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} onAdd={onAdd} />
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
        >
          {t($ => $.productBrowser.showMore, { count: hiddenCount })}
        </button>
      )}
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────────────────────

function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const { t } = useTranslation('orders');
  const price = resolvedPrice(product);
  const imgUrl = getMediaUrl(product.image_url);
  const isOutOfStock = product.stock_status === 'outofstock';
  const hasPendingReview = Boolean(product.pending_review);
  const isPriceLocked = price !== null;

  return (
    <div
      className={cn(
        'group flex gap-3 rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm',
        isOutOfStock && 'opacity-60',
      )}
    >
      {/* Thumbnail */}
      <div className="shrink-0">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={product.name}
            className="size-12 rounded object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded bg-muted">
            <Package className="size-5 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight">{product.name}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{product.sku}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* Stock */}
          {isOutOfStock ? (
            <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">{t($ => $.productBrowser.outOfStock)}</Badge>
          ) : product.available_qty != null ? (
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
              {t($ => $.productBrowser.available, { qty: product.available_qty })}
            </span>
          ) : null}

          {/* Price */}
          {price != null ? (
            <span className="flex items-center gap-0.5 text-[11px] font-medium">
              {isPriceLocked && <Lock className="size-2.5 text-muted-foreground" />}
              {fmt(price)}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground italic">{t($ => $.productBrowser.noPrice)}</span>
          )}

          {/* Unit */}
          {product.unit?.name && (
            <span className="text-[11px] text-muted-foreground">/ {product.unit.name}</span>
          )}
        </div>

        {/* Badges */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {hasPendingReview && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertTriangle className="size-2.5 shrink-0" />
              {t($ => $.productBrowser.priceReviewPending)}
            </span>
          )}
        </div>
      </div>

      {/* Add button */}
      <div className="flex shrink-0 items-start pt-0.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => onAdd(product)}
        >
          <Plus className="size-3" />
          {t($ => $.productBrowser.add)}
        </Button>
      </div>
    </div>
  );
}
