import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  Download,
  Factory,
  LayoutDashboard,
  Package,
  PackageCheck,
  Settings,
  ShoppingBag,
  Sparkles,
  Truck,
  Upload,
  Users,
  Warehouse,
} from 'lucide-react';

import type { Command, CommandGroup, CommandGroupMeta } from './command-types';

// ── Group display metadata ─────────────────────────────────────────────────────
//
// Labels are stored as i18n keys (namespace `command-palette`) and resolved at
// render time by the consumer via t(meta.labelKey) — keeping this a plain module
// while staying reactive to language changes.

export const COMMAND_GROUP_META: Record<CommandGroup, CommandGroupMeta> = {
  navigation: { label: ($) => $.groups.navigation, icon: LayoutDashboard },
  actions:    { label: ($) => $.groups.actions,    icon: ShoppingBag },
  search:     { label: ($) => $.groups.search,     icon: Package },
  recent:     { label: ($) => $.groups.recent,     icon: ClipboardList },
  favorites:  { label: ($) => $.groups.favorites,  icon: Warehouse },
  ai:         { label: ($) => $.groups.ai,         icon: Sparkles },
};

/** Groups shown in the empty-state (no search query). */
export const EMPTY_STATE_GROUPS: CommandGroup[] = ['recent', 'favorites', 'actions'];

/** Render order for groups when search results are displayed. */
export const SEARCH_GROUP_ORDER: CommandGroup[] = [
  'navigation',
  'actions',
  'search',
  'recent',
  'favorites',
];

// ── Default command factory ────────────────────────────────────────────────────

/**
 * Creates the default ECOS ERP command set.
 *
 * Accepts `t` (from useTranslation('command-palette')) so every user-facing
 * title/description is resolved through the i18n layer — the resolved strings
 * are what the palette filters on, so search works in the active language.
 *
 * Accepts `navigate` from React Router so navigation commands can push routes,
 * and `onClose` so commands can dismiss the palette after execution.
 *
 * This factory is called inside CommandProvider (which lives inside the Router).
 *
 * Integration pattern for modules:
 *   Modules export their own command factory following the same signature:
 *
 *     export function createOrdersCommands(
 *       t: TFunction<'command-palette'>,
 *       navigate: NavigateFunction,
 *       onClose: () => void,
 *       openCreateDrawer: () => void,
 *     ): Command[] { ... }
 *
 *   Then register at mount via useRegisterCommands('orders', createOrdersCommands(...)).
 *
 * Extension points (future):
 *   Add `context: { companyId, warehouseId, permissions }` parameter
 *   to enable permission-aware and workspace-scoped command filtering.
 */
export function createDefaultCommands(
  t: TFunction<'command-palette'>,
  navigate: NavigateFunction,
  onClose: () => void,
): Command[] {
  /** Navigate to route and close the palette. */
  const go = (path: string) => () => { navigate(path); onClose(); };

  /** Stub action — closes palette. Wired to real handler when feature is implemented. */
  const stub = () => { onClose(); };

  return [
    // ── Navigation ────────────────────────────────────────────────────────────
    {
      id: 'nav.dashboard',
      title: t($ => $.nav.dashboard.title),
      description: t($ => $.nav.dashboard.description),
      group: 'navigation',
      icon: LayoutDashboard,
      keywords: ['home', 'overview', 'kpi'],
      action: go('/dashboard'),
    },
    {
      id: 'nav.orders',
      title: t($ => $.nav.orders.title),
      description: t($ => $.nav.orders.description),
      group: 'navigation',
      icon: ShoppingBag,
      keywords: ['sales', 'commerce'],
      action: go('/orders'),
    },
    {
      id: 'nav.fulfillments',
      title: t($ => $.nav.fulfillments.title),
      description: t($ => $.nav.fulfillments.description),
      group: 'navigation',
      icon: PackageCheck,
      keywords: ['shipping', 'dispatch', 'fulfillment', 'delivery'],
      action: go('/fulfillments'),
    },
    {
      id: 'nav.customers',
      title: t($ => $.nav.customers.title),
      description: t($ => $.nav.customers.description),
      group: 'navigation',
      icon: Users,
      keywords: ['crm', 'clients', 'contacts', 'commerce'],
      action: go('/customers'),
    },
    {
      id: 'nav.products',
      title: t($ => $.nav.products.title),
      description: t($ => $.nav.products.description),
      group: 'navigation',
      icon: Package,
      keywords: ['catalog', 'sku', 'items', 'goods', 'commerce'],
      action: go('/products'),
    },
    {
      id: 'nav.inventory',
      title: t($ => $.nav.inventory.title),
      description: t($ => $.nav.inventory.description),
      group: 'navigation',
      icon: Boxes,
      keywords: ['stock', 'levels', 'wh', 'stock-ledger'],
      action: go('/inventory'),
    },
    {
      id: 'nav.warehouses',
      title: t($ => $.nav.warehouses.title),
      description: t($ => $.nav.warehouses.description),
      group: 'navigation',
      icon: Warehouse,
      keywords: ['locations', 'storage', 'facilities'],
      action: go('/warehouses'),
    },
    {
      id: 'nav.suppliers',
      title: t($ => $.nav.suppliers.title),
      description: t($ => $.nav.suppliers.description),
      group: 'navigation',
      icon: Truck,
      keywords: ['vendors', 'purchasing', 'procurement'],
      action: go('/suppliers'),
    },
    {
      id: 'nav.purchase-orders',
      title: t($ => $.nav.purchaseOrders.title),
      description: t($ => $.nav.purchaseOrders.description),
      group: 'navigation',
      icon: ClipboardList,
      keywords: ['po', 'procurement', 'purchasing'],
      action: go('/purchase-orders'),
    },
    {
      id: 'nav.companies',
      title: t($ => $.nav.companies.title),
      description: t($ => $.nav.companies.description),
      group: 'navigation',
      icon: Building2,
      keywords: ['org', 'entity', 'organization', 'branch'],
      action: go('/companies'),
    },
    {
      id: 'nav.manufacturing',
      title: t($ => $.nav.manufacturing.title),
      description: t($ => $.nav.manufacturing.description),
      group: 'navigation',
      icon: Factory,
      keywords: ['bom', 'production', 'assembly', 'recipes'],
      action: go('/manufacturing'),
    },
    {
      id: 'nav.reports',
      title: t($ => $.nav.reports.title),
      description: t($ => $.nav.reports.description),
      group: 'navigation',
      icon: BarChart3,
      keywords: ['analytics', 'kpi', 'metrics', 'charts'],
      action: go('/reports'),
    },
    {
      id: 'nav.settings',
      title: t($ => $.nav.settings.title),
      description: t($ => $.nav.settings.description),
      group: 'navigation',
      icon: Settings,
      keywords: ['config', 'preferences', 'integrations'],
      action: go('/settings'),
    },

    // ── Quick Actions ─────────────────────────────────────────────────────────
    {
      id: 'action.order.new',
      title: t($ => $.actions.orderNew.title),
      description: t($ => $.actions.orderNew.description),
      group: 'actions',
      icon: ShoppingBag,
      shortcut: '⌘N',
      keywords: ['create', 'sale', 'add'],
      action: stub,
    },
    {
      id: 'action.customer.new',
      title: t($ => $.actions.customerNew.title),
      description: t($ => $.actions.customerNew.description),
      group: 'actions',
      icon: Users,
      keywords: ['create', 'add', 'crm', 'contact'],
      action: stub,
    },
    {
      id: 'action.product.new',
      title: t($ => $.actions.productNew.title),
      description: t($ => $.actions.productNew.description),
      group: 'actions',
      icon: Package,
      keywords: ['create', 'catalog', 'sku', 'add'],
      action: stub,
    },
    {
      id: 'action.supplier.new',
      title: t($ => $.actions.supplierNew.title),
      description: t($ => $.actions.supplierNew.description),
      group: 'actions',
      icon: Truck,
      keywords: ['create', 'vendor', 'add'],
      action: stub,
    },
    {
      id: 'action.warehouse.new',
      title: t($ => $.actions.warehouseNew.title),
      description: t($ => $.actions.warehouseNew.description),
      group: 'actions',
      icon: Warehouse,
      keywords: ['create', 'location', 'add'],
      action: stub,
    },
    {
      id: 'action.company.new',
      title: t($ => $.actions.companyNew.title),
      description: t($ => $.actions.companyNew.description),
      group: 'actions',
      icon: Building2,
      keywords: ['create', 'org', 'entity', 'add'],
      action: stub,
    },
    {
      id: 'action.import',
      title: t($ => $.actions.import.title),
      description: t($ => $.actions.import.description),
      group: 'actions',
      icon: Upload,
      keywords: ['csv', 'excel', 'upload', 'bulk'],
      action: stub,
      soon: true,
    },
    {
      id: 'action.export',
      title: t($ => $.actions.export.title),
      description: t($ => $.actions.export.description),
      group: 'actions',
      icon: Download,
      keywords: ['csv', 'excel', 'download', 'bulk'],
      action: stub,
      soon: true,
    },

    // ── Favorites ─────────────────────────────────────────────────────────────
    // Real navigation favorites. User-pinned records populate this group at
    // runtime via module command registration.
    {
      id: 'fav.orders',
      title: t($ => $.favorites.orders.title),
      description: t($ => $.favorites.orders.description),
      group: 'favorites',
      icon: ShoppingBag,
      action: go('/orders'),
    },
    {
      id: 'fav.inventory',
      title: t($ => $.favorites.inventory.title),
      description: t($ => $.favorites.inventory.description),
      group: 'favorites',
      icon: Boxes,
      action: go('/inventory'),
    },

    // ── AI — reserved ─────────────────────────────────────────────────────────
    {
      id: 'ai.assistant',
      title: t($ => $.ai.assistant.title),
      description: t($ => $.ai.assistant.description),
      group: 'ai',
      icon: Sparkles,
      keywords: ['ai', 'assistant', 'ask', 'intelligence', 'chat', 'copilot'],
      action: stub,
      soon: true,
    },
  ];
}
