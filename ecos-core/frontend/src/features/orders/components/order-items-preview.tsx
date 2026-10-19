import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { getMediaUrl } from '@/lib/media';
import type { OrderLine } from '../types/order';

type Props = { lines: OrderLine[] };

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function OrderItemsPreview({ lines }: Props) {
  const { t } = useTranslation('orders');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  function toggle() {
    if (!open && triggerRef.current) {
      const rect   = triggerRef.current.getBoundingClientRect();
      const panelW = 340;
      let left = rect.left + window.scrollX;
      if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
      setPos({ top: rect.bottom + window.scrollY + 4, left });
    }
    setOpen((v) => !v);
  }

  const count      = lines.length;
  const grandTotal = lines.reduce((s, l) => s + l.line_total, 0);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        onMouseDown={(e) => e.stopPropagation()}
        className="tabular-nums font-medium text-xs hover:text-primary transition-colors"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t($ => $.itemsPreview.title, { count })}
      >
        {count}
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={t($ => $.itemsPreview.title, { count })}
              style={{ position: 'absolute', top: pos.top, left: pos.left, zIndex: 9999, width: 340 }}
              className="rounded-lg border bg-popover text-popover-foreground shadow-lg"
            >
              {/* Header */}
              <div className="border-b px-3 py-2">
                <p className="text-xs font-semibold">{t($ => $.itemsPreview.title, { count })}</p>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-[10px] font-medium text-muted-foreground">
                <span className="w-7" />
                <span>{t($ => $.itemsPreview.colProduct)}</span>
                <span className="text-end">{t($ => $.itemsPreview.colQtyPrice)}</span>
                <span className="w-16 text-end">{t($ => $.itemsPreview.colTotal)}</span>
              </div>

              {/* Lines */}
              <ul className="divide-y max-h-72 overflow-y-auto">
                {lines.map((line) => {
                  const imgUrl = getMediaUrl(line.product?.image_url) ?? null;
                  return (
                    <li key={line.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-3 py-2">
                      {/* Image */}
                      {imgUrl ? (
                        <img src={imgUrl} alt="" className="size-7 rounded object-cover shrink-0" />
                      ) : (
                        <div className="size-7 rounded bg-muted shrink-0" />
                      )}

                      {/* Name + SKU */}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium leading-tight">
                          {line.product?.name ?? t($ => $.itemsPreview.unknownProduct)}
                        </p>
                        {line.product?.sku ? (
                          <p className="font-mono text-[9px] text-muted-foreground leading-tight">
                            {line.product.sku}
                          </p>
                        ) : null}
                      </div>

                      {/* Qty × Unit Price */}
                      <p className="text-end text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {line.quantity}
                        {line.product?.unit_name ? ` ${line.product.unit_name}` : ''}
                        {' × '}
                        {fmt(line.unit_price)}
                      </p>

                      {/* Line Total */}
                      <p className="w-16 text-end text-xs font-semibold tabular-nums">
                        {fmt(line.line_total)}
                      </p>
                    </li>
                  );
                })}
              </ul>

              {/* Products Total footer */}
              <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t($ => $.itemsPreview.productsTotal)}
                </span>
                <span className="text-sm font-bold tabular-nums">{fmt(grandTotal)}</span>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
