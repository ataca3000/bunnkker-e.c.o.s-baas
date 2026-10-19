import { useMemo, useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAllShippingRules, usePatchOrder } from '@/features/orders/hooks/use-orders';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { ShippingPricingRule } from '@/features/orders/types/order';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

type OrderAreaCellProps = {
  orderId: string;
  area: string | null;
  governorate: string | null;
};

function govOptions(rules: ShippingPricingRule[]): string[] {
  return [...new Set(rules.map((r) => r.governorate))].sort();
}

function cityOptions(rules: ShippingPricingRule[], gov: string | null): string[] {
  if (!gov) return [];
  return [...new Set(
    rules.filter((r) => r.governorate === gov && r.city != null).map((r) => r.city!),
  )].sort();
}

function areaOptions(rules: ShippingPricingRule[], gov: string | null, city: string | null): string[] {
  if (!gov) return [];
  const rows = rules.filter((r) => r.governorate === gov && r.area != null);
  const scoped = city ? rows.filter((r) => r.city === city || r.city == null) : rows;
  return [...new Set(scoped.map((r) => r.area!))].sort();
}

/**
 * Inline area picker: Governorate → City (optional) → Area cascade.
 * Selecting an area auto-saves and shows Saving / Saved ✓ / Failed ✕ feedback.
 */
export function OrderAreaCell({ orderId, area, governorate }: OrderAreaCellProps) {
  const [open, setOpen] = useState(false);
  const [govVal, setGovVal] = useState<string | null>(governorate);
  const [cityVal, setCityVal] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const patch = usePatchOrder();
  const { data: rules = [] } = useAllShippingRules();

  const govs   = useMemo(() => govOptions(rules), [rules]);
  const cities = useMemo(() => cityOptions(rules, govVal), [rules, govVal]);
  const areas  = useMemo(() => areaOptions(rules, govVal, cityVal), [rules, govVal, cityVal]);

  const handleOpen = (next: boolean) => {
    if (next) {
      setGovVal(governorate);
      setCityVal(null);
    }
    setOpen(next);
  };

  const handleGovChange = (val: string) => {
    setGovVal(val || null);
    setCityVal(null);
  };

  const handleAreaSelect = (selected: string) => {
    setOpen(false);
    setSaveState('saving');
    patch.mutate(
      { id: orderId, data: { area: selected, governorate: govVal ?? undefined } },
      {
        onSuccess: () => {
          setSaveState('saved');
          setTimeout(() => setSaveState('idle'), 2000);
        },
        onError: () => {
          setSaveState('failed');
          setTimeout(() => setSaveState('idle'), 2000);
        },
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={saveState === 'saving'}
          className={cn(
            'group flex items-center gap-1 text-xs transition-colors',
            area ? 'text-foreground hover:text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label={area ? `Area: ${area}. Click to edit` : 'Set area'}
        >
          <span>{area ?? '—'}</span>
          {saveState === 'idle'   && <Pencil  className="size-2.5 opacity-0 transition-opacity group-hover:opacity-60" />}
          {saveState === 'saving' && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          {saveState === 'saved'  && <Check   className="size-3 text-emerald-500" />}
          {saveState === 'failed' && <X       className="size-3 text-red-500" />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-60 space-y-2 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Governorate */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Governorate
          </p>
          <select
            value={govVal ?? ''}
            onChange={(e) => handleGovChange(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">— Select Governorate —</option>
            {govs.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* City — only shown when there are cities for this governorate */}
        {cities.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              City
            </p>
            <select
              value={cityVal ?? ''}
              onChange={(e) => setCityVal(e.target.value || null)}
              className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— All Cities —</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* Area list */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Area
          </p>
          {!govVal ? (
            <p className="text-[11px] italic text-muted-foreground">Select a governorate first.</p>
          ) : areas.length === 0 ? (
            <p className="text-[11px] italic text-muted-foreground">No areas configured for this governorate.</p>
          ) : (
            <div className="max-h-40 divide-y overflow-y-auto rounded border border-input">
              {areas.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => handleAreaSelect(a)}
                  className={cn(
                    'flex w-full items-center px-2 py-1 text-start text-xs transition-colors hover:bg-accent',
                    a === area ? 'bg-accent/60 font-medium' : '',
                  )}
                >
                  <span className="flex-1">{a}</span>
                  {a === area && <Check className="size-3 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
