import { useTranslation } from 'react-i18next';

import type { CustomerIntelligenceFilter } from '@/features/orders/types/order';
import { cn } from '@/lib/utils';

type Props = {
  value: CustomerIntelligenceFilter[];
  onChange: (next: CustomerIntelligenceFilter[]) => void;
};

const FILTERS: Array<{ key: CustomerIntelligenceFilter; emoji: string }> = [
  { key: 'first_order',   emoji: '🆕' },
  { key: 'repeated',      emoji: '🔁' },
  { key: 'more_than_5',   emoji: '📦' },
  { key: 'more_than_10',  emoji: '⭐' },
  { key: 'has_cancelled', emoji: '❌' },
  { key: 'has_returned',  emoji: '↩️' },
  { key: 'has_rejected',  emoji: '🚫' },
  { key: 'incomplete',    emoji: '⏳' },
];

export function OrderCustomerIntelligence({ value, onChange }: Props) {
  const { t } = useTranslation('orders');
  const selected = new Set(value);

  const ciLabel: Record<CustomerIntelligenceFilter, string> = {
    first_order:   t($ => $.customerIntelligence.first_order),
    repeated:      t($ => $.customerIntelligence.repeated),
    more_than_5:   t($ => $.customerIntelligence.more_than_5),
    more_than_10:  t($ => $.customerIntelligence.more_than_10),
    has_cancelled: t($ => $.customerIntelligence.has_cancelled),
    has_returned:  t($ => $.customerIntelligence.has_returned),
    has_rejected:  t($ => $.customerIntelligence.has_rejected),
    incomplete:    t($ => $.customerIntelligence.incomplete),
  };

  function toggle(key: CustomerIntelligenceFilter) {
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(Array.from(next));
  }

  return (
    <div className="border-b bg-muted/30 px-4 py-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {t($ => $.customerIntelligence.title)}
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t($ => $.customerIntelligence.title)}>
        {FILTERS.map(({ key, emoji }) => {
          const active = selected.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent',
              )}
            >
              <span>{emoji}</span>
              {ciLabel[key]}
            </button>
          );
        })}
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground px-2.5 py-1 text-xs text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
          >
            {t($ => $.filters.clearAll)}
          </button>
        )}
      </div>
    </div>
  );
}
