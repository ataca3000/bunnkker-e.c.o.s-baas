/**
 * ECOS i18n TypeScript Augmentation
 *
 * Declares CustomTypeOptions so that useTranslation() is fully typed:
 * key autocomplete and unknown-key errors on every namespace.
 *
 * SELECTOR MODE (EPIC-1 Platform Foundation, Option A2)
 * -----------------------------------------------------
 * `enableSelector: "optimize"` puts i18next in selector mode. Call sites use
 *   t($ => $.some.key)      instead of      t('some.key')
 *
 * Measured on the real application, this cut type instantiations from
 * 175,605,474 to 2,895,778 (-98.35%) and full type-check time from 1,617s to
 * 61.8s (-96.2%) with NO loss of key safety — the compiler validates every
 * selector path exactly as it validated string keys.
 *
 * Crucially the cost is now scale-INDEPENDENT, which is why every namespace is
 * listed here. Under the previous string-key typing, 16 namespaces were
 * deliberately omitted because each one added measurable build cost — leaving
 * them with no key safety at all. That trade-off no longer exists.
 *
 * This file is generated from the English locale directory, which is the
 * canonical key source. Arabic keys must mirror the English structure exactly.
 * Namespaces with an empty JSON object are skipped (an empty selector proxy
 * would make every access a type error).
 */
import 'i18next';

import type enAdmin from '@/i18n/locales/en/admin.json';
import type enAuth from '@/i18n/locales/en/auth.json';
import type enBoms from '@/i18n/locales/en/boms.json';
import type enBranches from '@/i18n/locales/en/branches.json';
import type enBrands from '@/i18n/locales/en/brands.json';
import type enBusinessAccounts from '@/i18n/locales/en/business-accounts.json';
import type enCategories from '@/i18n/locales/en/categories.json';
import type enChannels from '@/i18n/locales/en/channels.json';
import type enClaudeBridge from '@/i18n/locales/en/claude-bridge.json';
import type enCommandPalette from '@/i18n/locales/en/command-palette.json';
import type enCommon from '@/i18n/locales/en/common.json';
import type enCompanies from '@/i18n/locales/en/companies.json';
import type enConversationalCommerce from '@/i18n/locales/en/conversational-commerce.json';
import type enCore from '@/i18n/locales/en/core.json';
import type enCostManagement from '@/i18n/locales/en/cost-management.json';
import type enCustomerEngagement from '@/i18n/locales/en/customer-engagement.json';
import type enCrm from '@/i18n/locales/en/crm.json';
import type enCustomers from '@/i18n/locales/en/customers.json';
import type enDashboard from '@/i18n/locales/en/dashboard.json';
import type enEngineering from '@/i18n/locales/en/engineering.json';
import type enExecutive from '@/i18n/locales/en/executive.json';
import type enFinance from '@/i18n/locales/en/finance.json';
import type enFulfillments from '@/i18n/locales/en/fulfillments.json';
import type enGoodsReceipts from '@/i18n/locales/en/goods-receipts.json';
import type enHome from '@/i18n/locales/en/home.json';
import type enHr from '@/i18n/locales/en/hr.json';
import type enInventory from '@/i18n/locales/en/inventory.json';
import type enInventoryControl from '@/i18n/locales/en/inventory-control.json';
import type enInventoryCount from '@/i18n/locales/en/inventory-count.json';
import type enLogistics from '@/i18n/locales/en/logistics.json';
import type enMarketing from '@/i18n/locales/en/marketing.json';
import type enOperations from '@/i18n/locales/en/operations.json';
import type enOrders from '@/i18n/locales/en/orders.json';
import type enOrganization from '@/i18n/locales/en/organization.json';
import type enPos from '@/i18n/locales/en/pos.json';
import type enProcurement from '@/i18n/locales/en/procurement.json';
import type enProductMappings from '@/i18n/locales/en/product-mappings.json';
import type enProducts from '@/i18n/locales/en/products.json';
import type enPurchaseMaterials from '@/i18n/locales/en/purchase-materials.json';
import type enPurchaseOrders from '@/i18n/locales/en/purchase-orders.json';
import type enRawMaterials from '@/i18n/locales/en/raw-materials.json';
import type enReceivingCenter from '@/i18n/locales/en/receiving-center.json';
import type enRecipes from '@/i18n/locales/en/recipes.json';
import type enSettings from '@/i18n/locales/en/settings.json';
import type enStockLedger from '@/i18n/locales/en/stock-ledger.json';
import type enStockSync from '@/i18n/locales/en/stock-sync.json';
import type enStockTransfers from '@/i18n/locales/en/stock-transfers.json';
import type enSupplierInvoices from '@/i18n/locales/en/supplier-invoices.json';
import type enSupplierReturns from '@/i18n/locales/en/supplier-returns.json';
import type enSuppliers from '@/i18n/locales/en/suppliers.json';
import type enSyncLogs from '@/i18n/locales/en/sync-logs.json';
import type enTeams from '@/i18n/locales/en/teams.json';
import type enUnits from '@/i18n/locales/en/units.json';
import type enWarehouses from '@/i18n/locales/en/warehouses.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    enableSelector: 'optimize';
    defaultNS: 'common';
    resources: {
      admin: typeof enAdmin;
      auth: typeof enAuth;
      boms: typeof enBoms;
      branches: typeof enBranches;
      brands: typeof enBrands;
      'business-accounts': typeof enBusinessAccounts;
      categories: typeof enCategories;
      channels: typeof enChannels;
      'claude-bridge': typeof enClaudeBridge;
      'command-palette': typeof enCommandPalette;
      common: typeof enCommon;
      companies: typeof enCompanies;
      'conversational-commerce': typeof enConversationalCommerce;
      core: typeof enCore;
      'cost-management': typeof enCostManagement;
      'customer-engagement': typeof enCustomerEngagement;
      crm: typeof enCrm;
      customers: typeof enCustomers;
      dashboard: typeof enDashboard;
      engineering: typeof enEngineering;
      executive: typeof enExecutive;
      finance: typeof enFinance;
      fulfillments: typeof enFulfillments;
      'goods-receipts': typeof enGoodsReceipts;
      home: typeof enHome;
      hr: typeof enHr;
      inventory: typeof enInventory;
      'inventory-control': typeof enInventoryControl;
      'inventory-count': typeof enInventoryCount;
      logistics: typeof enLogistics;
      marketing: typeof enMarketing;
      operations: typeof enOperations;
      orders: typeof enOrders;
      organization: typeof enOrganization;
      pos: typeof enPos;
      procurement: typeof enProcurement;
      'product-mappings': typeof enProductMappings;
      products: typeof enProducts;
      'purchase-materials': typeof enPurchaseMaterials;
      'purchase-orders': typeof enPurchaseOrders;
      'raw-materials': typeof enRawMaterials;
      'receiving-center': typeof enReceivingCenter;
      recipes: typeof enRecipes;
      settings: typeof enSettings;
      'stock-ledger': typeof enStockLedger;
      'stock-sync': typeof enStockSync;
      'stock-transfers': typeof enStockTransfers;
      'supplier-invoices': typeof enSupplierInvoices;
      'supplier-returns': typeof enSupplierReturns;
      suppliers: typeof enSuppliers;
      'sync-logs': typeof enSyncLogs;
      teams: typeof enTeams;
      units: typeof enUnits;
      warehouses: typeof enWarehouses;
    };
  }
}
