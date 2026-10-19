import { cn } from '@/lib/utils';

export type DrawerTabItem = {
  key: string;
  label: string;
  badge?: number | string;
  disabled?: boolean;
};

type DrawerTabsProps = {
  tabs: DrawerTabItem[];
  activeKey: string;
  onTabChange: (key: string) => void;
  className?: string;
};

/**
 * Tab strip for use inside PageFormDrawer.
 *
 * Renders ONLY the tab strip — no panel content.
 * Place this in the `tabs` slot of PageFormDrawer; the active panel
 * content lives in the drawer body (children).
 *
 * Sticky below the drawer header, edge-to-edge, horizontally scrollable on mobile.
 * Arrow-key navigation between tabs.
 *
 * Usage:
 *   <PageFormDrawer
 *     tabs={
 *       <DrawerTabs
 *         tabs={[
 *           { key: 'details',  label: 'Details' },
 *           { key: 'activity', label: 'Activity', badge: 3 },
 *           { key: 'files',    label: 'Files', disabled: true },
 *         ]}
 *         activeKey={activeTab}
 *         onTabChange={setActiveTab}
 *       />
 *     }
 *   >
 *     {activeTab === 'details'  && <DetailsPanel />}
 *     {activeTab === 'activity' && <ActivityPanel />}
 *   </PageFormDrawer>
 */
export function DrawerTabs({ tabs, activeKey, onTabChange, className }: DrawerTabsProps) {
  const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const enabled = tabs.filter((t) => !t.disabled);
    const idx = enabled.findIndex((t) => t.key === key);
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = enabled[(idx + dir + enabled.length) % enabled.length];
    if (next) onTabChange(next.key);
  };

  return (
    <div
      className={cn(
        'border-b bg-background',
        className,
      )}
    >
      <div
        role="tablist"
        aria-label="Drawer sections"
        className="flex items-center gap-0.5 overflow-x-auto px-4 scrollbar-none sm:px-6"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              id={`drawer-tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`drawer-panel-${tab.key}`}
              aria-disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onTabChange(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, tab.key)}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap',
                'outline-none transition-colors',
                'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
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
    </div>
  );
}
