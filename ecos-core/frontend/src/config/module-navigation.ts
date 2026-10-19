import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Cpu,
  DollarSign,
  DoorOpen,
  Factory,
  FileSignature,
  FlaskConical,
  Globe,
  LayoutDashboard,
  Layers,
  Layers2,
  Link2,
  ListOrdered,
  ListTree,
  Map,
  Gauge,
  MapPin,
  Megaphone,
  MessageSquare,
  MessageCircle,
  Monitor,
  Network,
  Package,
  PackageCheck,
  Percent,
  PiggyBank,
  Wallet,
  Bell,
  History,
  PackageOpen,
  Radio,
  RotateCcw,
  Zap,
  Ruler,
  Settings,
  Shield,
  ShoppingBag,
  Search,
  ShoppingCart,
  Tag,
  Tags,
  TrendingUp,
  Truck,
  UserPlus,
  Users as UsersIcon,
  Warehouse,
  SearchCheck,
  GitBranch,
  Wifi,
  ShieldCheck,
  ListChecks,
  BarChart2,
  Bot,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { ROUTES } from '@/router/routes';
import type enCommon from '@/i18n/locales/en/common.json';

/**
 * Navigation display text lives in the `common` namespace. Typing the keys
 * against it makes the translation the source of truth in the compiler as well
 * as at runtime: a nav item whose key has no translation is a build error, not
 * a label silently falling back to English.
 */
export type NavItemKey = keyof (typeof enCommon)['nav']['items'];
export type NavGroupKey = keyof (typeof enCommon)['nav']['groups'];

export type ModuleId =
  | 'dashboard'
  | 'commerce'
  | 'shipping'
  | 'pos'
  | 'inventory'
  | 'purchasing'
  | 'finance'
  | 'crm'
  | 'customerEngagement'
  | 'omnichannel'
  | 'manufacturing'
  | 'operations'
  | 'marketing'
  | 'core'
  | 'logistics'
  | 'hr'
  | 'reports'
  | 'administration'
  | 'engineering'
  | 'executive';

/**
 * A regular navigation link inside a module sidebar.
 *
 * There is no label field, optional or otherwise. Display text comes from
 * `common.nav.items`, keyed by `key`, and `NavItemKey` is derived from that
 * namespace — so a key without a translation is a compile error, not a label
 * quietly falling back to English.
 */
export type ModuleNavLink = {
  key: NavItemKey;
  path: string;
  icon: LucideIcon;
  isSection?: false;
};

/** A section header divider (not a clickable link). */
export type ModuleNavSection = {
  key: NavItemKey;
  isSection: true;
};

export type ModuleNavItem = ModuleNavLink | ModuleNavSection;

/**
 * A module in the rail.
 *
 * Display text comes from `common.nav.groups`, keyed by `id`. No label or
 * railLabel field exists: the rail and the sidebar both resolve the same group
 * key, so a second source of text could only ever disagree with the first.
 */
export type AppModule = {
  id: ModuleId;
  icon: LucideIcon;
  defaultPath: string;
  items: ModuleNavItem[];
};

const ALL_MODULES: AppModule[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    defaultPath: ROUTES.dashboard,
    items: [],
  },
  {
    // The Executive Platform board. Read-only, and every panel it draws is
    // already permission-gated per domain inside the page — a viewer who holds
    // none of those permissions sees the board with no panels, so the module
    // gate below decides whether the entry appears at all.
    id: 'executive',
    icon: Gauge,
    defaultPath: ROUTES.executiveDashboard,
    items: [{ key: 'executive-board', path: ROUTES.executiveDashboard, icon: LayoutDashboard }],
  },
  {
    id: 'pos',
    icon: Monitor,
    defaultPath: ROUTES.pos,
    items: [],
  },
  {
    id: 'commerce',
    icon: ShoppingBag,
    defaultPath: ROUTES.orders,
    items: [
      { key: 'orders', path: ROUTES.orders, icon: ShoppingBag },
      { key: 'products', path: ROUTES.products, icon: Package },
      { key: 'customers', path: ROUTES.customers, icon: ShoppingCart },
    ],
  },
  {
    id: 'inventory',
    icon: Package,
    defaultPath: ROUTES.inventoryDashboard,
    items: [
      { key: 'inv-dashboard', path: ROUTES.inventoryDashboard, icon: LayoutDashboard },
      { key: 'raw-materials', path: ROUTES.rawMaterials, icon: FlaskConical },
      { key: 'recipes', path: ROUTES.recipes, icon: ListTree },
      { key: 'price-review', path: ROUTES.costManagementPriceReview, icon: SearchCheck },
      { key: 'stock-ledger', path: ROUTES.stockLedger, icon: BookOpen },
      { key: 'inventory-count', path: ROUTES.inventoryCount, icon: ClipboardList },
      { key: 'waste-investigations', path: ROUTES.wasteInvestigations, icon: AlertTriangle },
      { key: 'warehouse-liabilities', path: ROUTES.warehouseLiabilities, icon: Shield },
      // Phase 1.1 — Stock Transfers deferred; restore entry above to re-enable (PKG-TRANSFERS-001)
      // Master Data section
      { key: 'master-data-section', isSection: true },
      { key: 'categories', path: ROUTES.inventoryCategories, icon: Tag },
      { key: 'units', path: ROUTES.inventoryUnits, icon: Ruler },
    ],
  },
  {
    id: 'operations',
    icon: TrendingUp,
    defaultPath: ROUTES.waveWorkspace,
    items: [{ key: 'wave-workspace', path: ROUTES.waveWorkspace, icon: Layers2 }],
  },
  {
    id: 'shipping',
    icon: PackageCheck,
    defaultPath: ROUTES.fulfillments,
    items: [
      { key: 'fulfillments', path: ROUTES.fulfillments, icon: PackageCheck },
      { key: 'carriers-section', isSection: true },
      { key: 'logistics-shipping-companies', path: ROUTES.logisticsShippingCompanies, icon: Truck },
      { key: 'logistics-carriers', path: ROUTES.logisticsCarrierAccounts, icon: Truck },
      { key: 'logistics-automation', path: ROUTES.logisticsAutomation, icon: GitBranch },
      { key: 'logistics-intelligence', path: ROUTES.logisticsIntelligence, icon: Activity },
      { key: 'logistics-fuel-review', path: ROUTES.logisticsFuelReview, icon: Gauge },
      { key: 'logistics-drivers', path: ROUTES.logisticsDrivers, icon: UsersIcon },
      { key: 'logistics-vehicles', path: ROUTES.logisticsVehicles, icon: Truck },
      { key: 'fleet-section', isSection: true },
      { key: 'logistics-fleet', path: ROUTES.logisticsFleet, icon: Gauge },
      { key: 'network-section', isSection: true },
      { key: 'logistics-network', path: ROUTES.logisticsNetwork, icon: Network },
      { key: 'dispatch-section', isSection: true },
      { key: 'logistics-dispatch', path: ROUTES.logisticsDispatch, icon: Radio },
      { key: 'logistics-dispatch-exec', path: ROUTES.logisticsDispatchExecution, icon: Zap },
      {
        key: 'logistics-dispatch-board',
        path: ROUTES.logisticsDispatchBoard,
        icon: LayoutDashboard,
      },
      { key: 'operations-section', isSection: true },
      { key: 'logistics-operations', path: ROUTES.logisticsOperations, icon: Activity },
      { key: 'logistics-ops-dashboards', path: ROUTES.logisticsOpsDashboards, icon: Gauge },
      { key: 'logistics-ops-alerts', path: ROUTES.logisticsOpsAlerts, icon: Bell },
      { key: 'logistics-ops-activity', path: ROUTES.logisticsOpsActivity, icon: History },
      { key: 'logistics-ops-readiness', path: ROUTES.logisticsOpsReadiness, icon: ShieldCheck },
      { key: 'logistics-enterprise', path: ROUTES.logisticsEnterprise, icon: LayoutDashboard },
      { key: 'geo-section', isSection: true },
      { key: 'egypt-geography', path: ROUTES.logisticsGeography, icon: Map },
      { key: 'dist-section', isSection: true },
      {
        key: 'logistics-distribution-zones',
        path: ROUTES.logisticsDistributionZones,
        icon: Network,
      },
      {
        key: 'logistics-distribution-plan',
        path: ROUTES.logisticsDistributionPlanning,
        icon: ListOrdered,
      },
      { key: 'delivery-section', isSection: true },
      { key: 'logistics-delivery', path: ROUTES.logisticsDelivery, icon: MapPin },
    ],
  },
  {
    id: 'purchasing',
    icon: Truck,
    defaultPath: ROUTES.procurementHub,
    items: [
      { key: 'procurement-hub', path: ROUTES.procurementHub, icon: LayoutDashboard },
      { key: 'suppliers', path: ROUTES.suppliers, icon: Truck },
      { key: 'material-requests', path: ROUTES.materialRequests, icon: ClipboardList },
      { key: 'purchases', path: ROUTES.purchases, icon: ShoppingCart },
      { key: 'supplier-invoices', path: ROUTES.supplierInvoices, icon: DollarSign },
      { key: 'receiving-center', path: ROUTES.receivingCenter, icon: PackageOpen },
      { key: 'supplier-returns', path: ROUTES.supplierReturns, icon: RotateCcw },
    ],
  },
  {
    id: 'finance',
    icon: DollarSign,
    defaultPath: ROUTES.accounting,
    items: [
      { key: 'finance-executive', path: ROUTES.accounting, icon: LayoutDashboard },
      { key: 'finance-coa', path: ROUTES.financeChartOfAccounts, icon: ListTree },
      { key: 'finance-journals', path: ROUTES.financeJournals, icon: BookOpen },
      { key: 'finance-statements', path: ROUTES.financeStatements, icon: BarChart3 },
      { key: 'finance-ar', path: ROUTES.financeReceivables, icon: DollarSign },
      { key: 'finance-ap', path: ROUTES.financePayables, icon: ShoppingCart },
      { key: 'finance-treasury', path: ROUTES.financeCashBanking, icon: Wallet },
      { key: 'finance-fiscal', path: ROUTES.financeFiscalClosing, icon: CalendarDays },
      { key: 'finance-budgets', path: ROUTES.financeBudgets, icon: PiggyBank },
      { key: 'finance-tax', path: ROUTES.financeTaxVat, icon: Percent },
    ],
  },
  {
    id: 'marketing',
    icon: Megaphone,
    defaultPath: ROUTES.marketing,
    items: [
      { key: 'mkt-dashboard', path: ROUTES.marketing, icon: LayoutDashboard },
      { key: 'mkt-initiatives', path: ROUTES.marketingInitiatives, icon: Briefcase },
      { key: 'mkt-init-exec', path: ROUTES.marketingInitiativeDash, icon: BarChart3 },
      { key: 'mkt-campaigns', path: ROUTES.marketingCampaigns, icon: TrendingUp },
      { key: 'mkt-camp-dash', path: ROUTES.marketingCampaignDash, icon: TrendingUp },
      { key: 'mkt-assets', path: ROUTES.marketingAssets, icon: Zap },
      { key: 'mkt-connect', path: ROUTES.marketingConnectMeta, icon: Link2 },
      { key: 'studio', path: ROUTES.campaignStudio, icon: Layers },
      { key: 'studio-dash', path: ROUTES.campaignStudioDashboard, icon: BarChart3 },
      { key: 'studio-gov', path: ROUTES.campaignGovernance, icon: Shield },
      // Marketing Automation Platform
      { key: 'automation', path: ROUTES.automationWorkspace, icon: GitBranch },
      { key: 'automation-segs', path: ROUTES.audienceSegments, icon: UsersIcon },
      { key: 'automation-dash', path: ROUTES.automationDashboard, icon: Activity },
      { key: 'automation-gov', path: ROUTES.automationGovernance, icon: Shield },
      { key: 'cep-section', isSection: true },
      { key: 'cep-inbox', path: ROUTES.customerEngagement, icon: MessageSquare },
      { key: 'cep-dashboard', path: ROUTES.cepDashboard, icon: LayoutDashboard },
      { key: 'cep-leads', path: ROUTES.cepLeads, icon: UserPlus },
      { key: 'bae-section-group', isSection: true },
      { key: 'bae-section', isSection: true },
      { key: 'bae-journey', path: ROUTES.businessAttribution, icon: Activity },
      { key: 'bae-timeline', path: ROUTES.baeTimeline, icon: BarChart3 },
    ],
  },
  {
    id: 'crm',
    icon: UsersIcon,
    defaultPath: ROUTES.crmCustomers,
    items: [
      { key: 'crm-customers', path: ROUTES.crmCustomers, icon: UsersIcon },
      { key: 'crm-executive', path: ROUTES.crmExecutive, icon: BarChart3 },
    ],
  },
  {
    id: 'manufacturing',
    icon: Factory,
    defaultPath: ROUTES.recipes,
    items: [{ key: 'production-orders', path: ROUTES.recipes, icon: ClipboardList }],
  },
  {
    id: 'omnichannel',
    icon: MessageCircle,
    defaultPath: ROUTES.omnichannelInbox,
    items: [
      { key: 'omni-inbox', path: ROUTES.omnichannelInbox, icon: MessageCircle },
      { key: 'omni-dashboard', path: ROUTES.omnichannelDashboard, icon: LayoutDashboard },
      { key: 'omni-config', isSection: true },
      { key: 'omni-providers', path: ROUTES.omnichannelProviders, icon: Wifi },
      { key: 'omni-macros', path: ROUTES.omnichannelMacros, icon: Zap },
      { key: 'omni-routing', path: ROUTES.omnichannelRouting, icon: GitBranch },
    ],
  },
  {
    id: 'logistics',
    icon: Truck,
    defaultPath: ROUTES.logisticsGeography,
    items: [],
  },
  {
    // HR & Workforce OS — EPIC H1 + H2
    id: 'hr',
    icon: UsersIcon,
    defaultPath: ROUTES.hr,
    items: [
      { key: 'hr-workforce', path: ROUTES.hr, icon: Gauge },
      { key: 'hr-people', isSection: true },
      { key: 'hr-employees', path: ROUTES.hrEmployees, icon: UsersIcon },
      { key: 'hr-org-chart', path: ROUTES.hrOrganizationChart, icon: Network },
      { key: 'hr-structure', path: ROUTES.hrStructure, icon: ListTree },
      { key: 'hr-time', isSection: true },
      { key: 'hr-attendance', path: ROUTES.hrAttendance, icon: ClipboardList },
      { key: 'hr-leave', path: ROUTES.hrLeave, icon: CalendarDays },
      { key: 'hr-pay', isSection: true },
      { key: 'hr-comp', path: ROUTES.hrCompensation, icon: DollarSign },
      { key: 'hr-commission', path: ROUTES.hrCommissionRules, icon: Zap },
      { key: 'hr-explain', path: ROUTES.hrCompensationExplainability, icon: Search },
      { key: 'hr-perf', path: ROUTES.hrPerformance, icon: TrendingUp },
      { key: 'hr-talent', isSection: true },
      { key: 'hr-recruit', path: ROUTES.hrRecruitment, icon: UserPlus },
      { key: 'hr-offers', path: ROUTES.hrOffers, icon: FileSignature },
      { key: 'hr-tags', path: ROUTES.hrApplicantTags, icon: Tags },
      { key: 'hr-recruit-analytics', path: ROUTES.hrRecruitmentAnalytics, icon: BarChart2 },
      { key: 'hr-exits', path: ROUTES.hrExits, icon: DoorOpen },
      { key: 'hr-exec', path: ROUTES.hrExecutive, icon: BarChart3 },
      { key: 'hr-analytics', path: ROUTES.hrAnalytics, icon: BarChart2 },
    ],
  },
  {
    id: 'reports',
    icon: BarChart3,
    defaultPath: ROUTES.reports,
    items: [],
  },
  {
    id: 'administration',
    icon: Settings,
    defaultPath: ROUTES.organization,
    items: [
      { key: 'org-section', isSection: true },
      { key: 'organization', path: ROUTES.organization, icon: Building2 },
      { key: 'companies', path: ROUTES.companies, icon: Building2 },
      { key: 'brands', path: ROUTES.brands, icon: Layers },
      { key: 'business-accounts', path: ROUTES.businessAccounts, icon: Briefcase },
      { key: 'channels', path: ROUTES.channels, icon: Globe },
      { key: 'warehouses', path: ROUTES.warehouses, icon: Warehouse },
      { key: 'branches', path: ROUTES.branches, icon: Building2 },
      { key: 'branch-coverage', path: ROUTES.branchCoverage, icon: MapPin },
      { key: 'teams', path: ROUTES.teams, icon: UsersIcon },
      { key: 'users-section', isSection: true },
      { key: 'users', path: ROUTES.users, icon: UsersIcon },
      { key: 'roles', path: ROUTES.roles, icon: Shield },
      { key: 'settings', path: ROUTES.settings, icon: Settings },
      { key: 'config-section', isSection: true },
      { key: 'configuration-os', path: ROUTES.configurationOs, icon: Cpu },
      { key: 'integrations-section', isSection: true },
      { key: 'product-mappings', path: ROUTES.productMappings, icon: Link2 },
      { key: 'sync-logs', path: ROUTES.syncLogs, icon: ArrowLeftRight },
    ],
  },
  {
    id: 'engineering',
    icon: ShieldCheck,
    defaultPath: ROUTES.engineeringDashboard,
    items: [
      { key: 'eng-ws-section', isSection: true },
      { key: 'eng-workspace', path: ROUTES.engineeringWorkspace, icon: LayoutDashboard },
      { key: 'eng-section', isSection: true },
      { key: 'eng-dashboard', path: ROUTES.engineeringDashboard, icon: BarChart2 },
      { key: 'eng-runs', path: ROUTES.engineeringRuns, icon: ListChecks },
      { key: 'eng-findings', path: ROUTES.engineeringFindings, icon: AlertTriangle },
      { key: 'eng-rm-section', isSection: true },
      { key: 'eng-pipeline', path: ROUTES.engineeringPipeline, icon: Zap },
      { key: 'eng-pipeline-h', path: ROUTES.engineeringPipelineHistory, icon: History },
      { key: 'eng-analytics', path: ROUTES.engineeringAnalytics, icon: BarChart2 },
      { key: 'eng-notify', path: ROUTES.engineeringNotifications, icon: Bell },
      { key: 'eng-releases-section', isSection: true },
      { key: 'eng-releases', path: ROUTES.engineeringReleases, icon: GitBranch },
      { key: 'eng-cluster-section', isSection: true },
      { key: 'eng-cluster', path: ROUTES.engineeringCluster, icon: Cpu },
      { key: 'eng-ai-section', isSection: true },
      { key: 'eng-ai-supervisor', path: ROUTES.engineeringAiSupervisor, icon: Bot },
      { key: 'eng-repair', path: ROUTES.engineeringRepair, icon: Wrench },
    ],
  },
];

/**
 * Modules hidden from navigation for the Commerce & Operations go-live scope
 * (TASK-GOLIVE-BLOCKERS-001, BLOCKER-2). Navigation only — backends/routes are
 * untouched; a direct URL still resolves. Remove an id here once its UI is
 * production-ready.
 *   • finance      — Accounting UI not built (backend F1–F5 complete, no frontend)
 *   • crm          — Advanced CRM UI not built (service/sales/loyalty/intelligence)
 *   • engineering  — AI Platform experimental (no LLM logic wired)
 * (Stock Transfers was already removed from the Inventory sidebar.)
 */
/**
 * Modules hidden from navigation for the go-live shell.
 *
 * Hiding is navigation-only: routes still resolve by direct URL, so nothing is
 * deleted and nothing needs re-registering when a module is brought back.
 *
 *   • pos            — not in the go-live scope
 *   • manufacturing  — not in the go-live scope
 *   • engineering    — internal platform tooling, temporarily withheld
 *   • logistics      — the empty rail entry. Every Logistics workspace lives
 *                      under Shipping; this module carried no items, so it
 *                      rendered as a module with an empty sidebar
 *   • reports        — carries no items and no distinct destination
 *   • finance        — the module exists here with no items and its UI lives on
 *                      `platform-foundation`. Unhiding it on this branch would
 *                      surface an empty module, which is the orphan this EPIC
 *                      exists to remove. It is unhidden by the integration task,
 *                      not by this one.
 *
 * CRM is deliberately absent: it is now visible and carries its two workspaces.
 */
const HIDDEN_MODULE_IDS: ReadonlySet<ModuleId> = new Set<ModuleId>([
  'pos',
  'manufacturing',
  'engineering',
  'logistics',
  'reports',
]);

/** Navigation-visible modules (hidden ids filtered out for go-live scope). */
export const APP_MODULES: AppModule[] = ALL_MODULES.filter((m) => !HIDDEN_MODULE_IDS.has(m.id));

/** Find the module that owns a given pathname. */
export function findModuleByPath(pathname: string): AppModule | undefined {
  return APP_MODULES.find((m) => {
    if (m.defaultPath === pathname) return true;
    return m.items.some(
      (item) => !item.isSection && (pathname === item.path || pathname.startsWith(item.path + '/')),
    );
  });
}

/**
 * Look up the nav item label for a given pathname.
 *
 * Single source of truth for label lookups — replaces the removed navigation.ts.
 * Used by AppBreadcrumbs and ComingSoonPage.
 *
 * Search order:
 *   1. Exact path match inside each module's sidebar items.
 *   2. Module defaultPath (covers modules with empty items[], e.g. Dashboard, Finance).
 */
export type NavMatch =
  | { kind: 'item'; key: NavItemKey; path: string; icon: LucideIcon }
  | { kind: 'module'; id: ModuleId; path: string; icon: LucideIcon };

export function findNavItemByPath(pathname: string): NavMatch | undefined {
  for (const mod of APP_MODULES) {
    const item = mod.items.find((i): i is ModuleNavLink => !i.isSection && i.path === pathname);
    if (item) return { kind: 'item', key: item.key, path: item.path, icon: item.icon };

    if (mod.defaultPath === pathname) {
      return { kind: 'module', id: mod.id, path: mod.defaultPath, icon: mod.icon };
    }
  }
  return undefined;
}
