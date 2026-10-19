import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  Factory,
  Package,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/router/routes';
import type { ExecutiveDashboardData } from '../services/executive-dashboard.service';

import type enDashboard from '@/i18n/locales/en/dashboard.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. The selector is the same expression the
 * compiler validates at an inline call site, kept in the table.
 */
type DashboardLabel = ($: typeof enDashboard) => string;


// ── Workspace definitions ──────────────────────────────────────────────────



interface WorkspaceLink {
  id:       string;
  labelKey: DashboardLabel;
  icon:     LucideIcon;
  color:    string;       // icon color class
  bgColor:  string;       // icon container background
  href:     string;
  getCount?: (data: ExecutiveDashboardData) => number;
}

const WORKSPACES: WorkspaceLink[] = [
  {
    id:       'orders',
    labelKey: ($) => $.workspaces.orders,
    icon:     ShoppingCart,
    color:    'text-indigo-500',
    bgColor:  'bg-indigo-500/10',
    href:     ROUTES.orders,
    getCount: (d) => d.sales.pending_count,
  },
  {
    id:       'inventory',
    labelKey: ($) => $.workspaces.inventory,
    icon:     Package,
    color:    'text-emerald-500',
    bgColor:  'bg-emerald-500/10',
    href:     ROUTES.inventory,
  },
  {
    id:       'manufacturing',
    labelKey: ($) => $.workspaces.manufacturing,
    icon:     Factory,
    color:    'text-violet-500',
    bgColor:  'bg-violet-500/10',
    href:     ROUTES.waveWorkspace,
    getCount: (d) => d.operations.active_waves,
  },
  {
    id:       'procurement',
    labelKey: ($) => $.workspaces.procurement,
    icon:     ShoppingBag,
    color:    'text-amber-500',
    bgColor:  'bg-amber-500/10',
    href:     ROUTES.procurementHub,
  },
  {
    id:       'crm',
    labelKey: ($) => $.workspaces.crm,
    icon:     Users,
    color:    'text-pink-500',
    bgColor:  'bg-pink-500/10',
    href:     ROUTES.customers,
  },
  {
    id:       'marketing',
    labelKey: ($) => $.workspaces.marketing,
    icon:     BarChart3,
    color:    'text-rose-500',
    bgColor:  'bg-rose-500/10',
    href:     ROUTES.marketing,
  },
  {
    id:       'shipping',
    labelKey: ($) => $.workspaces.shipping,
    icon:     Truck,
    color:    'text-cyan-500',
    bgColor:  'bg-cyan-500/10',
    href:     ROUTES.distributionBoard,
    getCount: (d) => d.shipping.failed_today,
  },
  {
    id:       'finance',
    labelKey: ($) => $.workspaces.finance,
    icon:     CreditCard,
    color:    'text-teal-500',
    bgColor:  'bg-teal-500/10',
    href:     ROUTES.supplierInvoices,
  },
];

// ── Workspace shortcut item ────────────────────────────────────────────────

function WorkspaceItem({ ws, data }: { ws: WorkspaceLink; data?: ExecutiveDashboardData }) {
  const { t } = useTranslation('dashboard');
  const Icon  = ws.icon;
  const count = data && ws.getCount ? ws.getCount(data) : 0;
  const hasAlert = count > 0;

  return (
    <Link
      to={ws.href}
      className="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50 active:bg-muted"
    >
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', ws.bgColor)}>
        <Icon className={cn('h-3.5 w-3.5', ws.color)} />
      </div>
      <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">
        {t(ws.labelKey)}
      </span>
      {hasAlert && (
        <span className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums',
          ws.id === 'shipping' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        )}>
          {count}
        </span>
      )}
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  data?: ExecutiveDashboardData;
}

export function DashboardWorkspaceNav({ data }: Props) {
  return (
    <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-4 lg:grid-cols-8">
      {WORKSPACES.map((ws) => (
        <WorkspaceItem key={ws.id} ws={ws} data={data} />
      ))}
    </div>
  );
}
