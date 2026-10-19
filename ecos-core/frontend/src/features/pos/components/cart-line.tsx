import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { Minus, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CartLine } from '@/features/pos/types';

export type CartLineHandle = {
  startEdit: () => void;
};

type CartLineProps = {
  line: CartLine;
  onRemove: (lineId: string) => void;
  onQtyChange?: (lineId: string, qty: number) => void;
  disabled?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
};

export const CartLineRow = forwardRef<CartLineHandle, CartLineProps>(
  function CartLineRow({ line, onRemove, onQtyChange, disabled, isSelected, onSelect }, ref) {
    const { money } = useFormatter();
    const qty = parseFloat(line.quantity);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isEditing) {
        inputRef.current?.select();
      }
    }, [isEditing]);

    function startEdit() {
      if (disabled || !onQtyChange) return;
      setEditValue(String(qty));
      setIsEditing(true);
    }

    function commitEdit() {
      setIsEditing(false);
      const n = parseFloat(editValue);
      if (!isNaN(n) && n > 0 && n !== qty) {
        onQtyChange?.(line.id, n);
      }
    }

    function handleEditKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
      if (e.key === 'Escape') { setIsEditing(false); }
    }

    useImperativeHandle(ref, () => ({ startEdit }), [disabled, onQtyChange, qty]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div
        id={line.id}
        role="option"
        aria-selected={isSelected}
        className={cn(
          'flex items-center gap-1 rounded-md px-1 py-0.5 cursor-pointer',
          isSelected
            ? 'bg-primary/10 ring-1 ring-primary/40'
            : 'hover:bg-accent/50',
        )}
        onClick={onSelect}
      >
        {/* Qty controls — min 44×44px touch targets */}
        <div className="flex items-center shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            disabled={disabled || qty <= 1}
            onClick={(e) => { e.stopPropagation(); onQtyChange?.(line.id, qty - 1); }}
            tabIndex={-1}
            aria-label={`Decrease quantity for ${line.product_name}`}
          >
            <Minus className="size-3" />
          </Button>

          {/* Tap/click to enter qty directly */}
          {isEditing ? (
            <input
              ref={inputRef}
              type="number"
              min="0.01"
              step="any"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleEditKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-10 rounded border border-primary bg-background text-center text-sm tabular-nums font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label={`Quantity for ${line.product_name}`}
            />
          ) : (
            <button
              className="w-7 text-center text-sm tabular-nums font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
              title="Click to edit quantity"
              onClick={(e) => { e.stopPropagation(); startEdit(); }}
              disabled={disabled}
              tabIndex={0}
              aria-label={`Quantity ${qty} for ${line.product_name}. Click to edit.`}
            >
              {qty}
            </button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onQtyChange?.(line.id, qty + 1); }}
            tabIndex={-1}
            aria-label={`Increase quantity for ${line.product_name}`}
          >
            <Plus className="size-3" />
          </Button>
        </div>

        {/* Product info */}
        <div className="flex-1 min-w-0 py-1">
          <p className="truncate text-sm font-medium">{line.product_name}</p>
          <p className="text-xs text-muted-foreground">{line.sku}</p>
        </div>

        {/* Line total + delete */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-sm font-semibold tabular-nums">
            {money(Number(line.line_total.amount), line.line_total.currency)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 text-muted-foreground/50 hover:text-destructive focus-visible:text-destructive"
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onRemove(line.id); }}
            tabIndex={-1}
            aria-label={`Remove ${line.product_name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  },
);
