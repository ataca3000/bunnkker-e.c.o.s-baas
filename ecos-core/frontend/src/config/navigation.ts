import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardList,
  DollarSign,
  FlaskConical,
  LayoutDashboard,
  Layers2,
  LineChart,
  Link2,
  ListOrdered,
  ListTree,
  Map,
  Megaphone,
  Network,
  Package,
  PackageCheck,
  PackageOpen,
  Route,
  Settings,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  TrendingUp,
  Truck,
  Warehouse,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ROUTES } from '@/router/routes';

export type NavItem = {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', path: ROUTES.dashboard, icon: LayoutDashboard },
    ],
  },
  {
    label: 'Organization',
    items: [
      { key: 'organization', label: 'Organization', path: ROUTES.organization, icon: Building2 },
    ],
  },
  {
    label: 'Commerce',
    items: [
      { key: 'orders',    label: 'Orders',    path: ROUTES.orders,    icon: ShoppingBag  },
      { key: 'products',  label: 'Products',  path: ROUTES.products,  icon: Package      },
      { key: 'customers', label: 'Customers', path: ROUTES.customers, icon: ShoppingCart },
    ],
  },
  {
    label: 'Shipping',
    items: [
      { key: 'fulfillments', label: 'Fulfillments', path: ROUTES.fulfillments, icon: PackageCheck },
    ],
  },
  {
    label: 'Purchasing',
    items: [
      { key: 'suppliers', label: 'Suppliers', path: ROUTES.suppliers, icon: Truck },
      { key: 'purchase-orders', label: 'Purchase Orders', path: ROUTES.purchaseOrders, icon: ClipboardList },
      { key: 'goods-receipts', label: 'Goods Receipts', path: ROUTES.goodsReceipts, icon: PackageOpen },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { key: 'stock-ledger', label: 'Stock Ledger', path: ROUTES.stockLedger, icon: BookOpen },
      { key: 'inventory-dashboard', label: 'Inv. Dashboard', path: ROUTES.inventoryDashboard, icon: Activity },
      { key: 'abc-classifications', label: 'ABC Classification', path: ROUTES.inventoryAbcClassifications, icon: Tag },
      { key: 'cycle-count-planner', label: 'Cycle Planner', path: ROUTES.inventoryCycleCountPlanner, icon: CalendarClock },
      { key: 'variance-analytics', label: 'Variance Analytics', path: ROUTES.inventoryVarianceAnalytics, icon: LineChart },
      { key: 'warehouse-performance', label: 'WH Performance', path: ROUTES.inventoryWarehousePerformance, icon: Warehouse },
    ],
  },
  {
    label: 'External Integrations',
    items: [
      { key: 'product-mappings', label: 'Product Mapping', path: ROUTES.productMappings, icon: Link2 },
      { key: 'sync-logs', label: 'Sync Logs', path: ROUTES.syncLogs, icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Manufacturing',
    items: [
      { key: 'boms', label: 'Bills of Materials', path: ROUTES.boms, icon: ListTree },
    ],
  },
  {
    label: 'Preparation OS',
    items: [
      { key: 'wave-workspace',        label: 'Wave Workspace',    path: ROUTES.waveWorkspace,        icon: Layers2      },
      { key: 'wave-product-demand',   label: 'Product Demand',    path: ROUTES.waveProductDemand,    icon: Package      },
      { key: 'wave-raw-materials',    label: 'Raw Materials',     path: ROUTES.waveRawMaterials,     icon: FlaskConical },
      { key: 'wave-missing',          label: 'Missing Materials', path: ROUTES.waveMissingMaterials, icon: AlertTriangle },
      { key: 'wave-orders',           label: 'Wave Orders',       path: ROUTES.waveOrders,           icon: ShoppingCart },
      { key: 'wave-settings',         label: 'Wave Settings',     path: ROUTES.waveSettings,         icon: Settings2    },
    ],
  },
  {
    label: 'Distribution OS',
    items: [
      { key: 'distribution-board', label: 'Distribution Board', path: ROUTES.distributionBoard, icon: Route },
    ],
  },
  {
    label: 'Loading OS',
    items: [
      { key: 'loading-os-dashboard', label: 'Loading Dashboard', path: ROUTES.loadingOsDashboard, icon: Truck },
      { key: 'dispatch-gate',        label: 'Dispatch Gate',     path: ROUTES.dispatchGate,       icon: ShieldCheck },
    ],
  },
  {
    label: 'Shipping — Geography & Distribution',
    items: [
      { key: 'logistics-geography',               label: 'Egypt Geography',       path: ROUTES.logisticsGeography,            icon: Map          },
      { key: 'logistics-distribution-zones',      label: 'Distribution Zones',    path: ROUTES.logisticsDistributionZones,    icon: Network      },
      { key: 'logistics-distribution-planning',   label: 'Distribution Planning', path: ROUTES.logisticsDistributionPlanning, icon: ListOrdered  },
    ],
  },
  {
    label: 'Driver Mobile',
    items: [
      { key: 'driver-home', label: 'Driver Home', path: ROUTES.driverHome, icon: Smartphone },
    ],
  },
  {
    label: 'Marketing OS',
    items: [
      { key: 'marketing',                  label: 'Overview',          path: ROUTES.marketing,                 icon: Megaphone   },
      { key: 'marketing-intelligence',     label: 'Intelligence',      path: ROUTES.marketingIntelligence,     icon: BarChart3   },
      { key: 'marketing-campaigns-analytics', label: 'Campaigns',     path: ROUTES.marketingCampaignAnalytics, icon: TrendingUp  },
      { key: 'marketing-ad-analytics',     label: 'Ads',               path: ROUTES.marketingAdAnalytics,      icon: Activity    },
      { key: 'marketing-creative-analytics', label: 'Creatives',      path: ROUTES.marketingCreativeAnalytics, icon: Zap         },
      { key: 'marketing-trends',           label: 'Trends',            path: ROUTES.marketingTrends,           icon: LineChart   },
      { key: 'marketing-budget',           label: 'Budget',            path: ROUTES.marketingBudget,           icon: DollarSign  },
      { key: 'marketing-reports',          label: 'Reports',           path: ROUTES.marketingReports,          icon: ListTree    },
      { key: 'marketing-settings',         label: 'Mktg. Settings',    path: ROUTES.marketingSettings,         icon: Settings2   },
    ],
  },
  {
    label: 'Insights',
    items: [{ key: 'reports', label: 'Reports', path: ROUTES.reports, icon: BarChart3 }],
  },
  {
    label: 'System',
    items: [{ key: 'settings', label: 'Settings', path: ROUTES.settings, icon: Settings }],
  },
];

/** Flat list of all navigation items (for lookups by path). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Find the navigation item matching a pathname. */
export function findNavItemByPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.path === pathname);
}
