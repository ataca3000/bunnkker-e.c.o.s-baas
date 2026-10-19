import type { ComponentType } from 'react';

import type enCommon from '@/i18n/locales/en/common.json';
import {
  Boxes,
  Building2,
  ClipboardList,
  Package,
  Plus,
  ShoppingBag,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── Action definitions ────────────────────────────────────────────────────────

/**
 * Display text lives in `common.create`, keyed by `key` and `groupKey`, the same
 * contract module navigation uses. The structure here carries keys, icons and
 * behaviour — no copy — so an action whose key has no translation is a build
 * error rather than a label falling back to English (BUG-GL-003).
 */
type CreateActionKey = keyof (typeof enCommon)['create']['actions'];
type CreateGroupKey = keyof (typeof enCommon)['create']['groups'];

type CreateAction = {
  key: CreateActionKey;
  icon: ComponentType<{ className?: string }>;
  shortcut?: string;
  disabled?: boolean;
  soon?: boolean;
};

type CreateGroup = {
  groupKey: CreateGroupKey;
  iconClass: string;
  actions: CreateAction[];
};

const CREATE_GROUPS: CreateGroup[] = [
  {
    groupKey: 'commerce',
    iconClass: 'bg-primary/10 text-primary',
    actions: [
      { key: 'order', icon: ShoppingBag, shortcut: '⌘N' },
      { key: 'customer', icon: Users },
      { key: 'product', icon: Package },
    ],
  },
  {
    groupKey: 'inventory',
    iconClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    actions: [
      { key: 'purchase-order', icon: ClipboardList },
      { key: 'supplier', icon: Truck },
      { key: 'stock-adjustment', icon: Boxes, disabled: true, soon: true },
    ],
  },
  {
    groupKey: 'administration',
    iconClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    actions: [
      { key: 'warehouse', icon: Warehouse },
      { key: 'company', icon: Building2 },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function SmartCreate() {
  const { t } = useTranslation('common');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="h-9 gap-1.5 px-3"
          aria-label={t(($) => $.create.ariaLabel)}
        >
          <Plus className="size-4" aria-hidden />
          <span className="hidden lg:inline">{t(($) => $.create.new)}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-2">
        {CREATE_GROUPS.map((group, gi) => (
          <div key={group.groupKey}>
            {gi > 0 ? <DropdownMenuSeparator className="my-1.5" /> : null}

            <DropdownMenuLabel className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t(($) => $.create.groups[group.groupKey])}
            </DropdownMenuLabel>

            <div className="space-y-0.5">
              {group.actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    type="button"
                    role="menuitem"
                    disabled={action.disabled}
                    onClick={() => {
                      // Extension point: navigate or open drawer per action key
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2 py-2 text-start transition-colors',
                      action.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent',
                    )}
                  >
                    {/* Icon badge */}
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md',
                        action.disabled ? 'bg-muted text-muted-foreground' : group.iconClass,
                      )}
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>

                    {/* Label + description */}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight">
                        {t(($) => $.create.actions[action.key].label)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t(($) => $.create.actions[action.key].description)}
                      </span>
                    </span>

                    {/* Shortcut or Soon badge */}
                    {action.soon ? (
                      <span className="shrink-0 rounded-full border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[9px] font-medium text-primary/70">
                        {t(($) => $.create.soon)}
                      </span>
                    ) : action.shortcut ? (
                      <kbd
                        aria-label={t(($) => $.create.shortcut, { keys: action.shortcut })}
                        className="shrink-0 select-none rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {action.shortcut}
                      </kbd>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
