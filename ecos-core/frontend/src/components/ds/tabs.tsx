import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type TabItem = {
  key: string;
  label: string;
  content: ReactNode;
  badge?: number | string;
  disabled?: boolean;
};

type TabsProps = {
  tabs: TabItem[];
  activeKey: string;
  onTabChange: (key: string) => void;
  className?: string;
  contentClassName?: string;
};

/**
 * Reusable horizontal tab bar with slot-based content.
 * Framework-independent — no Radix dependency.
 */
export function Tabs({ tabs, activeKey, onTabChange, className, contentClassName }: TabsProps) {
  const active = tabs.find((t) => t.key === activeKey) ?? tabs[0];

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="Tabs"
        className="flex items-center gap-0.5 border-b overflow-x-auto scrollbar-none"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              aria-disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onTabChange(tab.key)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  const dir = e.key === 'ArrowRight' ? 1 : -1;
                  const enabled = tabs.filter((t) => !t.disabled);
                  const idx = enabled.findIndex((t) => t.key === activeKey);
                  const next = enabled[(idx + dir + enabled.length) % enabled.length];
                  if (next) onTabChange(next.key);
                }
              }}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap outline-none',
                'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
                isActive
                  ? 'text-foreground after:bg-primary'
                  : 'text-muted-foreground hover:text-foreground after:bg-transparent',
                tab.disabled && 'pointer-events-none opacity-40',
              )}
            >
              {tab.label}
              {tab.badge !== undefined ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/15 px-1 text-[10px] font-semibold text-primary">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Active panel */}
      {active ? (
        <div
          role="tabpanel"
          id={`panel-${active.key}`}
          aria-labelledby={`tab-${active.key}`}
          className={cn('flex-1', contentClassName)}
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
