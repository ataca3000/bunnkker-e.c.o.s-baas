import { Package } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Product } from '@/features/pos/types';

type ProductCardProps = {
  product: Product;
  onClick: (product: Product) => void;
  disabled?: boolean;
};

const STOCK_BADGE: Record<Product['stock_status'], { label: string; variant: string }> = {
  in_stock:     { label: 'In Stock',  variant: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  low_stock:    { label: 'Low',       variant: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  out_of_stock: { label: 'Out',       variant: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export function ProductCard({ product, onClick, disabled }: ProductCardProps) {
  const stock = STOCK_BADGE[product.stock_status];
  const price = product.selling_price != null
    ? `${product.currency ?? ''} ${product.selling_price.toFixed(2)}`
    : '—';

  return (
    <button
      type="button"
      disabled={disabled || product.stock_status === 'out_of_stock'}
      onClick={() => onClick(product)}
      className={cn(
        'group flex flex-col gap-2 rounded-lg border bg-card p-3 text-start transition-all',
        'hover:border-primary/50 hover:shadow-sm active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        (disabled || product.stock_status === 'out_of_stock') &&
          'cursor-not-allowed opacity-50',
      )}
    >
      {/* Icon placeholder */}
      <div className="flex h-12 items-center justify-center rounded-md bg-muted">
        <Package className="size-6 text-muted-foreground" />
      </div>

      {/* Name */}
      <p className="line-clamp-2 text-xs font-medium leading-tight">{product.name}</p>

      {/* Price + stock */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold tabular-nums">{price}</span>
        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', stock.variant)}>
          {stock.label}
        </span>
      </div>
    </button>
  );
}
