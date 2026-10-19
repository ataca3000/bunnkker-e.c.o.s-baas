/**
 * ECOS i18n Namespace Registry
 *
 * Single source of truth for every i18n namespace. Adding a namespace here
 * is the only code change required to make it available across the app:
 *
 *   1. Add the namespace name to this array.
 *   2. Create src/i18n/locales/en/<namespace>.json
 *   3. Create src/i18n/locales/ar/<namespace>.json
 *   4. (Optional) Add the namespace type to src/i18n/types.ts for key autocomplete.
 *
 * No changes to i18n.ts, no rebuilds, no configuration — the Vite glob
 * backend picks up new files automatically.
 */
export const NAMESPACES = [
  // ── Core / Shell ──────────────────────────────────────────────────────────
  'common',
  'auth',
  'settings',
  'home',
  'command-palette',

  // ── Organization ──────────────────────────────────────────────────────────
  'companies',
  'branches',
  'warehouses',
  'teams',
  'organization',
  'admin',

  // ── Catalog ───────────────────────────────────────────────────────────────
  'products',
  'categories',
  'units',
  'brands',
  'boms',
  'recipes',
  'raw-materials',
  'purchase-materials',

  // ── Sales & Commerce ──────────────────────────────────────────────────────
  'channels',
  'orders',
  'fulfillments',
  'crm',
  'customers',
  'business-accounts',
  'customer-engagement',
  'conversational-commerce',
  'pos',

  // ── Purchasing & Supply ───────────────────────────────────────────────────
  'suppliers',
  'purchase-orders',
  'goods-receipts',
  'procurement',
  'supplier-invoices',
  'supplier-returns',
  'receiving-center',

  // ── Inventory ─────────────────────────────────────────────────────────────
  'inventory',
  'inventory-control',
  'inventory-count',
  'stock-ledger',
  'stock-sync',
  'stock-transfers',

  // ── Operations & Logistics ────────────────────────────────────────────────
  'operations',
  'logistics',

  // ── Finance & Reporting ───────────────────────────────────────────────────
  'cost-management',
  'dashboard',
  'finance',
  'executive',

  // ── Platform / Integrations ───────────────────────────────────────────────
  'sync-logs',
  'product-mappings',
  'core',
  'claude-bridge',

  // ── Marketing ─────────────────────────────────────────────────────────────
  'marketing',

  // ── HR & Workforce ────────────────────────────────────────────────────────
  'hr',

  // ── Engineering OS ────────────────────────────────────────────────────────
  'engineering',
] as const;

export type Namespace = (typeof NAMESPACES)[number];
export type DefaultNamespace = 'common';
