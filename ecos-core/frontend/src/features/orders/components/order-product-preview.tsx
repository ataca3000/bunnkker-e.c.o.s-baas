import { useState } from 'react';
import { Package } from 'lucide-react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { OrderLine } from '@/features/orders/types/order';

type OrderProductPreviewProps = {
  lines: OrderLine[];
};

/**
 * Part 4 — Product count with hover/click popover showing line items.
 * Displays thumbnail, name, SKU, unit, and qty per line.
 * Supports hover (desktop) and click/touch toggle (tablet/mobile).
 */
export function OrderProductPreview({ lines }: OrderProductPreviewProps) {
  const [open, setOpen] = useState(false);

  if (lines.length === 0) {
    return <span className="tabular-nums font-medium text-muted-foreground">0</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen((v) => !v)}
          className="tabular-nums font-medium underline-offset-2 hover:underline hover:text-primary transition-colors"
          aria-label={`${lines.length} item${lines.length !== 1 ? 's' : ''}. Click to preview`}
        >
          {lines.length}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-64 overflow-y-auto divide-y">
          {lines.map((line) => (
            <div key={line.id} className="flex items-center gap-2.5 px-3 py-2">
              {/* Thumbnail — 40×40 for better visibility */}
              <div className="size-10 shrink-0 overflow-hidden rounded border bg-muted flex items-center justify-center">
                {line.product?.image_url ? (
                  <img
                    src={line.product.image_url}
                    alt={line.product?.name ?? ''}
                    className="size-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Package className="size-4 text-muted-foreground" />
                )}
              </div>

              {/* Product info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium leading-tight">
                  {line.product?.name ?? 'Unknown product'}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {line.product?.sku ? (
                    <span className="font-mono text-[10px] text-muted-foreground">{line.product.sku}</span>
                  ) : null}
                  {line.product?.unit_name ? (
                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
                      {line.product.unit_name}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Qty */}
              <span className="shrink-0 tabular-nums text-xs font-medium text-muted-foreground">
                ×{line.quantity}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
