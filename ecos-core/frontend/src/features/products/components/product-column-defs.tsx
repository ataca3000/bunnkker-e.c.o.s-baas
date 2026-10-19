import { useRef, useState } from 'react';
import { Edit, Eye, Loader2, MoreHorizontal, Package, Power, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ds/use-toast';
import { ROUTES } from '@/router/routes';

import { getMediaUrl } from '@/lib/media';

import type { DataGridColumnDef } from '@/components/data-grid/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { ChannelCell } from './badges/channel-badge';
import { PublishBadge } from './badges/publish-badge';
import { SyncBadge } from './badges/sync-badge';
import { marginColorClass } from '@/features/products/lib/pricing-utils';
import { productsService } from '@/features/products/services/products-service';
import type { Product } from '../types/product';
import type { TFunction } from 'i18next';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PendingCostBadge() {
  const { t } = useTranslation('products');
  return (
    <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
      {t($ => $.colDefs.pendingCost)}
    </span>
  );
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(d));
}

// PART 6: 3-state for finished goods (manufacturing_availability), 2-state for other types (stock_status)
function StockStatusCell({ product }: { product: Product }) {
  const { t } = useTranslation('products');
  if (!product) return <span className="text-muted-foreground text-xs">—</span>;
  if (product.product_type === 'finished_good') {
    const mav = product.manufacturing_availability;
    if (mav === 'instock') {
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
          {t($ => $.colDefs.mfgInStock)}
        </Badge>
      );
    }
    if (mav === 'outofstock') {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
          {t($ => $.colDefs.mfgOutOfStock)}
        </Badge>
      );
    }
    if (mav === 'recipe_missing') {
      return (
        <Badge className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700">
          {t($ => $.colDefs.mfgRecipeMissing)}
        </Badge>
      );
    }
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const status = product.stock_status;
  if (status === 'instock') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
        {t($ => $.stockStatus.instock)}
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800">
      {t($ => $.stockStatus.outofstock)}
    </Badge>
  );
}

// ── Inline Edit ───────────────────────────────────────────────────────────────

type InlineEditNumberProps = {
  product: Product;
  value: number | null | undefined;
  onSave: (id: string, value: number) => Promise<void>;
  format?: (v: number) => string;
  suffix?: string;
  min?: number;
  step?: number;
};

function InlineEditNumber({
  product,
  value,
  onSave,
  format,
  suffix = '',
  min = 0,
  step = 0.01,
}: InlineEditNumberProps) {
  const { t } = useTranslation('products');
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setLocalVal(value != null ? String(value) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = async () => {
    const n = parseFloat(localVal);
    if (!isNaN(n) && n >= min) {
      setSaving(true);
      try {
        await onSave(product.id, n);
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } catch {
        toast.error(t($ => $.toasts.inlineSaveFailed));
      } finally {
        setSaving(false);
        setEditing(false);
      }
    } else {
      setEditing(false);
    }
  };

  if (saving) {
    return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={min}
        step={step}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void commit(); }
          if (e.key === 'Escape') setEditing(false);
        }}
        onBlur={() => void commit()}
        autoFocus
        className="h-7 w-24 rounded border border-input bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label={t($ => $.colDefs.editValue)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title={t($ => $.colDefs.clickToEdit)}
      className="group/inline flex items-center gap-0.5 rounded px-1 py-0.5 text-sm tabular-nums transition-colors hover:bg-accent"
    >
      <span className="font-medium">
        {value != null ? (format ? format(value) : fmt(value)) : '—'}
        {value != null ? suffix : ''}
      </span>
      <Edit className="size-2.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/inline:opacity-60" aria-hidden />
    </button>
  );
}

// ── Callbacks ─────────────────────────────────────────────────────────────────

export type ProductColumnCallbacks = {
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onStatusToggle: (product: Product) => void;
  onViewRecipe?: (product: Product) => void;   // PART 8: opens drawer on Recipe tab
  onCreateRecipe?: (product: Product) => void; // PART 8: navigates to create-recipe
};

// ── t function type ───────────────────────────────────────────────────────────

type TFn = TFunction<'products'>;

// ── Factory ───────────────────────────────────────────────────────────────────

export function createProductColumns(
  callbacks: ProductColumnCallbacks,
  t: TFn,
): DataGridColumnDef<Product>[] {
  const { onView, onEdit, onDelete, onStatusToggle, onViewRecipe, onCreateRecipe } = callbacks;

  return [
    // ── Image ─────────────────────────────────────────────────────────────────
    {
      key: 'image',
      label: t($ => $.colDefs.image),
      alwaysVisible: false,
      defaultVisible: true,
      width: 56,
      skeletonClassName: 'size-9 rounded',
      cell: (product) =>
        getMediaUrl(product.image_url) ? (
          <img src={getMediaUrl(product.image_url)!} alt="" className="size-9 rounded border object-cover" />
        ) : (
          <div className="flex size-9 items-center justify-center rounded border bg-muted">
            <Package className="size-4 text-muted-foreground" />
          </div>
        ),
    },

    // ── Name (pinned left) ────────────────────────────────────────────────────
    {
      key: 'name',
      label: t($ => $.colDefs.name),
      alwaysVisible: true,
      pin: 'left',
      width: 220,
      sortable: true,
      skeletonClassName: 'h-4 w-36',
      cell: (product) => (
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onView(product)}
            className="max-w-[200px] truncate text-start text-sm font-medium transition-colors hover:text-primary"
            title={product.name}
          >
            {product.name}
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">{product.sku}</span>
        </div>
      ),
    },

    // ── Category ──────────────────────────────────────────────────────────────
    {
      key: 'category',
      label: t($ => $.colDefs.category),
      defaultVisible: true,
      skeletonClassName: 'h-4 w-20',
      cell: (product) => (
        <span className="text-xs text-muted-foreground">{product.category?.name ?? '—'}</span>
      ),
    },

    // ── Brand ─────────────────────────────────────────────────────────────────
    {
      key: 'brand',
      label: t($ => $.colDefs.brand),
      defaultVisible: true,
      skeletonClassName: 'h-4 w-20',
      cell: (product) => {
        const brand = product.brand;
        if (!brand) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium">{brand.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{brand.code}</span>
          </div>
        );
      },
    },

    // ── Channels ──────────────────────────────────────────────────────────────
    {
      key: 'channels',
      label: t($ => $.colDefs.channels),
      defaultVisible: true,
      skeletonClassName: 'h-5 w-28',
      cell: (product) => <ChannelCell channels={product.channels} />,
    },

    // ── Product Cost ──────────────────────────────────────────────────────────
    {
      key: 'product_cost',
      label: t($ => $.colDefs.productCost),
      defaultVisible: true,
      align: 'end',
      skeletonClassName: 'h-4 w-14',
      cellClassName: 'tabular-nums',
      cell: (product) => {
        const cost = product.effective_cost;
        if (cost == null) return <PendingCostBadge />;
        const isRecipeBased = product.has_recipe === true && product.product_cost != null;
        return (
          <span
            className="text-sm tabular-nums"
            title={isRecipeBased ? 'Recipe-calculated cost' : 'Purchase cost'}
          >
            {fmt(cost)}
          </span>
        );
      },
    },

    // ── Regular Price ─────────────────────────────────────────────────────────
    {
      key: 'regular_price',
      label: t($ => $.colDefs.regularPrice),
      defaultVisible: true,
      sortable: true,
      align: 'end',
      skeletonClassName: 'h-4 w-14',
      cellClassName: 'tabular-nums',
      cell: (product) => <span className="font-medium">{fmt(product.regular_price)}</span>,
    },

    // ── Sale Price (inline editable) ─────────────────────────────────────────
    {
      key: 'sale_price',
      label: t($ => $.colDefs.salePrice),
      defaultVisible: true,
      align: 'end',
      skeletonClassName: 'h-4 w-14',
      cellClassName: 'tabular-nums',
      cell: (product) => (
        <InlineEditNumber
          product={product}
          value={product.sale_price}
          onSave={(id, val) => productsService.patch(id, { sale_price: val }).then(() => {})}
        />
      ),
    },

    // ── Markup % (inline editable — saves as new regular_price) ──────────────
    {
      key: 'markup_pct',
      label: t($ => $.colDefs.markupPct),
      defaultVisible: true,
      align: 'end',
      skeletonClassName: 'h-4 w-10',
      cellClassName: 'tabular-nums',
      cell: (product) => {
        const cost = product.effective_cost;
        if (cost == null || cost <= 0) return <PendingCostBadge />;
        return (
          <InlineEditNumber
            product={product}
            value={product.markup_pct ?? null}
            format={(v) => `${v.toFixed(0)}`}
            suffix="%"
            step={1}
            onSave={(id, markup) => {
              // Compute target price from backend-provided effective_cost + user-entered markup.
              const newRegularPrice = Math.round(cost * (1 + markup / 100) * 100) / 100;
              return productsService.patch(id, { regular_price: newRegularPrice }).then(() => {});
            }}
          />
        );
      },
    },

    // ── Gross Profit % ───────────────────────────────────────────────────────
    {
      key: 'gross_profit',
      label: t($ => $.colDefs.grossProfit),
      defaultVisible: true,
      align: 'end',
      skeletonClassName: 'h-4 w-10',
      cellClassName: 'tabular-nums',
      cell: (product) => {
        const pct = product.gross_profit_pct;
        if (pct == null) return product.effective_cost == null ? <PendingCostBadge /> : <span className="text-muted-foreground text-xs">—</span>;
        return (
          <span className={`text-sm font-medium ${marginColorClass(pct)}`}>
            {pct.toFixed(1)}%
          </span>
        );
      },
    },

    // ── Final Margin % ────────────────────────────────────────────────────────
    {
      key: 'final_margin',
      label: t($ => $.colDefs.finalMargin),
      defaultVisible: true,
      align: 'end',
      skeletonClassName: 'h-4 w-10',
      cellClassName: 'tabular-nums',
      cell: (product) => {
        const pct = product.final_margin_pct;
        if (pct == null) return product.effective_cost == null ? <PendingCostBadge /> : <span className="text-muted-foreground text-xs">—</span>;
        const hasSale = product.sale_price != null && product.sale_price > 0;
        return (
          <span
            className={`text-sm font-medium ${marginColorClass(pct)}`}
            title={hasSale ? t($ => $.colDefs.basedOnSalePrice) : t($ => $.colDefs.basedOnRegularPrice)}
          >
            {pct.toFixed(1)}%{hasSale ? ' ↓' : ''}
          </span>
        );
      },
    },

    // ── Stock Status (PART 9: In Stock / Out of Stock only) ────────────────────
    {
      key: 'stock_status',
      label: t($ => $.colDefs.stockStatus),
      defaultVisible: true,
      skeletonClassName: 'h-5 w-20 rounded-full',
      cell: (product) => <StockStatusCell product={product} />,
    },

    // ── Recipe (PART 8: clickable) ────────────────────────────────────────────
    {
      key: 'recipe',
      label: t($ => $.colDefs.recipe),
      defaultVisible: true,
      skeletonClassName: 'h-5 w-24 rounded-full',
      cell: (product) => {
        if (product.product_type !== 'finished_good') {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        if (product.has_recipe) {
          return (
            <button
              type="button"
              onClick={() => (onViewRecipe ? onViewRecipe(product) : onView(product))}
              className="cursor-pointer transition-opacity hover:opacity-80"
              title={t($ => $.colDefs.viewRecipeTitle)}
            >
              <Badge className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 gap-1">
                {t($ => $.colDefs.recipeAvailable)}
              </Badge>
            </button>
          );
        }
        return (
          <button
            type="button"
            onClick={() => (onCreateRecipe ? onCreateRecipe(product) : onView(product))}
            className="cursor-pointer transition-opacity hover:opacity-80"
            title={t($ => $.colDefs.createRecipeTitle)}
          >
            <Badge className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 gap-1">
              {t($ => $.colDefs.recipeMissing)}
            </Badge>
          </button>
        );
      },
    },

    // ── SKU (hidden by default) ───────────────────────────────────────────────
    {
      key: 'sku',
      label: t($ => $.colDefs.sku),
      alwaysVisible: false,
      defaultVisible: false,
      width: 108,
      sortable: true,
      skeletonClassName: 'h-4 w-16',
      cell: (product) => (
        <button
          type="button"
          onClick={() => onView(product)}
          className="font-mono text-xs font-medium transition-colors hover:text-primary"
        >
          {product.sku}
        </button>
      ),
    },

    // ── Published (hidden by default) ─────────────────────────────────────────
    {
      key: 'is_published',
      label: t($ => $.colDefs.isPublished),
      defaultVisible: false,
      skeletonClassName: 'h-5 w-20 rounded-md',
      cell: (product) => <PublishBadge published={product.is_published} />,
    },

    // ── Sync Status (hidden by default) ───────────────────────────────────────
    {
      key: 'sync_status',
      label: t($ => $.colDefs.sync),
      defaultVisible: false,
      skeletonClassName: 'h-5 w-16 rounded-md',
      cell: (product) => <SyncBadge status={product.sync_status} />,
    },

    // ── Updated At (hidden by default) ────────────────────────────────────────
    {
      key: 'updated_at',
      label: t($ => $.colDefs.updatedAt),
      defaultVisible: false,
      sortable: true,
      skeletonClassName: 'h-4 w-20',
      cell: (product) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmtDate(product.updated_at)}
        </span>
      ),
    },

    // ── Pricing Review ────────────────────────────────────────────────────────
    {
      key: 'pricing_review',
      label: t($ => $.colDefs.priceReview),
      defaultVisible: true,
      skeletonClassName: 'h-5 w-20 rounded-full',
      cell: (product) => {
        if (product.pending_review === true) {
          return (
            <Link
              to={ROUTES.costManagementPriceReview}
              className="inline-flex"
              title={t($ => $.colDefs.openPriceReviewCenter)}
            >
              <Badge className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 gap-1 cursor-pointer hover:opacity-80 transition-opacity">
                {t($ => $.colDefs.reviewRequired)}
              </Badge>
            </Link>
          );
        }
        if (product.pending_review === false) {
          return (
            <Badge className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 gap-1">
              {t($ => $.colDefs.ok)}
            </Badge>
          );
        }
        return <span className="text-muted-foreground text-xs">—</span>;
      },
    },

    // ── Row Actions (pinned right) ────────────────────────────────────────────
    {
      key: 'actions',
      label: '',
      alwaysVisible: true,
      pin: 'right',
      width: 40,
      skeletonClassName: 'h-7 w-7 rounded',
      cellClassName: 'text-end',
      cell: (product) => (
        <div className="flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={t($ => $.colDefs.actionsFor, { name: product.name })}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onView(product)}>
                <Eye className="size-3.5" />
                {t($ => $.colDefs.view)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(product)}>
                <Edit className="size-3.5" />
                {t($ => $.colDefs.edit)}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onStatusToggle(product)}>
                <Power className="size-3.5" />
                {product.is_active ? t($ => $.colDefs.deactivate) : t($ => $.colDefs.activate)}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(product)}>
                <Trash2 className="size-3.5" />
                {t($ => $.colDefs.delete)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];
}
