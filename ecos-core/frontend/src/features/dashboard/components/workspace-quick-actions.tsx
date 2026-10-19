import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  ClipboardList,
  Factory,
  Package,
  ShoppingCart,
  UserPlus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/router/routes';

import type enDashboard from '@/i18n/locales/en/dashboard.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type DashboardLabel = ($: typeof enDashboard) => string;


// ── Action definitions ─────────────────────────────────────────────────────





interface QuickAction {
  id:       string;
  icon:     LucideIcon;
  titleKey: DashboardLabel;
  descKey:  DashboardLabel;
  to:       string;
  color:    string;
  badge?:   string;
}

const ACTIONS: QuickAction[] = [
  {
    id:       'create-order',
    icon:     ShoppingCart,
    titleKey: ($) => $.quickActionsWidget.createOrder,
    descKey:  ($) => $.quickActionsWidget.createOrderDesc,
    to:       ROUTES.ordersNew,
    color:    'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  {
    id:       'receive-inventory',
    icon:     Package,
    titleKey: ($) => $.quickActionsWidget.receiveInventory,
    descKey:  ($) => $.quickActionsWidget.receiveInventoryDesc,
    to:       ROUTES.goodsReceiptsNew,
    color:    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    id:       'launch-wave',
    icon:     Factory,
    titleKey: ($) => $.quickActionsWidget.launchWave,
    descKey:  ($) => $.quickActionsWidget.launchWaveDesc,
    to:       ROUTES.waveWorkspace,
    color:    'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  {
    id:       'transfer-stock',
    icon:     ArrowLeftRight,
    titleKey: ($) => $.quickActionsWidget.transferStock,
    descKey:  ($) => $.quickActionsWidget.transferStockDesc,
    to:       ROUTES.stockTransfers,
    color:    'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  },
  {
    id:       'add-customer',
    icon:     UserPlus,
    titleKey: ($) => $.quickActionsWidget.addCustomer,
    descKey:  ($) => $.quickActionsWidget.addCustomerDesc,
    to:       ROUTES.customers,
    color:    'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    id:       'purchase-materials',
    icon:     ClipboardList,
    titleKey: ($) => $.quickActionsWidget.purchaseMaterials,
    descKey:  ($) => $.quickActionsWidget.purchaseMaterialsDesc,
    to:       ROUTES.purchaseMaterials,
    color:    'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export function WorkspaceQuickActions() {
  const { t } = useTranslation('dashboard');

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {ACTIONS.map((action) => (
        <Link
          key={action.id}
          to={action.to}
          className={cn(
            'group flex flex-col gap-2 rounded-xl border bg-card p-3.5 transition-all',
            'hover:shadow-md hover:border-border/80',
          )}
        >
          <div className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
            action.color,
          )}>
            <action.icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">
              {t(action.titleKey)}
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              {t(action.descKey)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
