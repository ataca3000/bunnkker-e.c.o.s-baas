import { createBrowserRouter, redirect } from 'react-router-dom';

import { ComingSoonPage } from '@/components/common/coming-soon-page';
import { AppShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/features/auth/pages/login-page';
import { BrandsPage } from '@/features/brands/pages/brands-page';
import { BusinessAccountsPage } from '@/features/business-accounts/pages/business-accounts-page';
import { TeamsPage } from '@/features/teams/pages/teams-page';
import { BranchesPage } from '@/features/branches/pages/branches-page';
import { BranchCoveragePage } from '@/features/branches/pages/branch-coverage-page';
import { CategoriesPage } from '@/features/categories/pages/categories-page';
import { ChannelsPage } from '@/features/channels/pages/channels-page';
import { CompaniesPage } from '@/features/companies/pages/companies-page';
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page';
// Executive Platform (EPIC-EXECUTIVE-UI-001) — aliased; Marketing also exports ExecutiveDashboardPage.
import { ExecutiveDashboardPage as ExecutivePlatformPage } from '@/features/executive/pages/executive-dashboard-page';
// Finance workspace (EPIC-FINANCE-UI-001)
import { FinanceExecutivePage } from '@/features/finance/pages/finance-executive-page';
import { ChartOfAccountsPage } from '@/features/finance/pages/chart-of-accounts-page';
import { JournalsPage } from '@/features/finance/pages/journals-page';
import { FinancialStatementsPage } from '@/features/finance/pages/financial-statements-page';
import { AccountsReceivablePage } from '@/features/finance/pages/accounts-receivable-page';
import { AccountsPayablePage } from '@/features/finance/pages/accounts-payable-page';
import { CashBankingPage } from '@/features/finance/pages/cash-banking-page';
import { FiscalClosingPage } from '@/features/finance/pages/fiscal-closing-page';
import { BudgetsPage } from '@/features/finance/pages/budgets-page';
import { TaxVatPage } from '@/features/finance/pages/tax-vat-page';
import { HomePage } from '@/features/home/pages/home-page';
import { PackagingMaterialsPage } from '@/features/inventory/pages/packaging-materials-page';
import { ConsumablesPage } from '@/features/inventory/pages/consumables-page';
import { SemiFinishedMaterialsPage } from '@/features/inventory/pages/semi-finished-materials-page';
import { OrganizationWorkspace } from '@/features/organization/pages/organization-workspace';
import { OrgSearchPage } from '@/features/organization/pages/org-search-page';
import { ProductsPage } from '@/features/products/pages/products-page';
import { RawMaterialsPage } from '@/features/products/pages/raw-materials-page';
import { UnitsPage } from '@/features/units/pages/units-page';
import { WarehousesPage } from '@/features/warehouses/pages/warehouses-page';
import { ProductMappingsPage } from '@/features/product-mappings/pages/product-mappings-page';
import { OrdersPage } from '@/features/orders/pages/orders-page';
import { OrderWorkspacePage } from '@/features/orders/pages/order-workspace-page';
import { FulfillmentsPage } from '@/features/fulfillments/pages/fulfillments-page';
import { CreateFulfillmentPage } from '@/features/fulfillments/pages/create-fulfillment-page';
import { ViewFulfillmentPage } from '@/features/fulfillments/pages/view-fulfillment-page';
import { SyncLogsPage } from '@/features/sync-logs/pages/sync-logs-page';
import { BomWorkspacePage } from '@/features/boms/pages/bom-workspace-page';
import { RecipesPage } from '@/features/recipes/pages/recipes-page';
import { RecipeWorkspacePage } from '@/features/recipes/pages/recipe-workspace-page';
import { CrmCustomersWorkspacePage } from '@/features/crm/pages/crm-customers-workspace-page';
import { CrmExecutiveWorkspacePage } from '@/features/crm/pages/crm-executive-workspace-page';
import { CustomersPage } from '@/features/customers/pages/customers-page';
import { CustomerProfilePage } from '@/features/customers/pages/customer-profile-page';
import { StockLedgerPage } from '@/features/stock-ledger/pages/stock-ledger-page';
import { InventoryDashboardPage } from '@/features/inventory-control/pages/inventory-dashboard-page';
import { AbcClassificationPage } from '@/features/inventory-control/pages/abc-classification-page';
import { CycleCountPlannerPage } from '@/features/inventory-control/pages/cycle-count-planner-page';
import { VarianceAnalyticsPage } from '@/features/inventory-control/pages/variance-analytics-page';
import { WarehousePerformancePage } from '@/features/inventory-control/pages/warehouse-performance-page';
import { CreateGoodsReceiptPage } from '@/features/goods-receipts/pages/create-goods-receipt-page';
import { EditGoodsReceiptPage } from '@/features/goods-receipts/pages/edit-goods-receipt-page';
import { ViewGoodsReceiptPage } from '@/features/goods-receipts/pages/view-goods-receipt-page';
import { SuppliersPage } from '@/features/suppliers/pages/suppliers-page';
import { MaterialRequestsPage } from '@/features/purchase-materials/pages/material-requests-page';
import { PurchasesPage } from '@/features/purchase-materials/pages/purchases-page';
import { ProcurementHubPage } from '@/features/procurement/pages/procurement-hub-page';
import { ReceivingCenterPage } from '@/features/receiving-center/pages/receiving-center-page';
import { SupplierReturnsPage } from '@/features/supplier-returns/pages/supplier-returns-page';
import { SupplierInvoicesPage } from '@/features/supplier-invoices/pages/supplier-invoices-page';
import { CostPricingCenterPage } from '@/features/cost-management/pages/cost-pricing-center-page';
import { CostManagementDashboardPage } from '@/features/cost-management/pages/cost-management-dashboard-page';
import { CostHistoryPage } from '@/features/cost-management/pages/cost-history-page';
import { InventoryCountPage } from '@/features/inventory-count/pages/inventory-count-page';
import { WasteInvestigationsPage } from '@/features/inventory-count/pages/waste-investigations-page';
import { WarehouseLiabilityPage } from '@/features/inventory-count/pages/warehouse-liability-page';
import { StockTransfersPage } from '@/features/stock-transfers/pages/stock-transfers-page';
import { FulfillmentWaveWorkspacePage } from '@/features/operations/pages/fulfillment-wave-workspace-page';
import { WaveProductDemandPage } from '@/features/operations/pages/wave-product-demand-page';
import { WaveRawMaterialsPage } from '@/features/operations/pages/wave-raw-materials-page';
import { WaveMissingMaterialsPage } from '@/features/operations/pages/wave-missing-materials-page';
import { WaveOrdersPage } from '@/features/operations/pages/wave-orders-page';
import { WaveSettingsPage } from '@/features/operations/pages/wave-settings-page';
import { WaveWorkspaceLayout } from '@/features/operations/components/wave-workspace-layout';
import { PosPage } from '@/features/pos/pages/pos-page';
import { ConfigurationOsPage } from '@/features/admin/configuration/pages/configuration-os-page';
import { BrandConfigurationPage } from '@/features/admin/configuration/pages/brand-configuration-page';
import { EgyptGeographyPage } from '@/features/logistics/geography/pages/egypt-geography-page';
import { DistributionZonesPage } from '@/features/logistics/distribution-zones/pages/distribution-zones-page';
import { DistributionPlanningPage } from '@/features/logistics/distribution-planning/pages/distribution-planning-page';
import { TripsWorkspacePage } from '@/features/logistics/trips/pages/trips-workspace-page';
import { CarrierAccountsPage } from '@/features/logistics/carriers/pages/carrier-accounts-page';
import { AutomationMonitoringPage } from '@/features/logistics/automation/pages/automation-monitoring-page';
import { LogisticsIntelligencePage } from '@/features/logistics/intelligence/pages/logistics-intelligence-page';
import { FuelReviewPage } from '@/features/logistics/fleet/pages/fuel-review-page';
import { DispatchBoardPage } from '@/features/logistics/dispatch/pages/dispatch-board-page';
import { ShippingCompaniesPage } from '@/features/logistics/shipping-companies/pages/shipping-companies-page';
import { DriversPage } from '@/features/logistics/drivers/pages/drivers-page';
import { VehiclesPage } from '@/features/logistics/vehicles/pages/vehicles-page';
import { DeliveryPage } from '@/features/logistics/delivery/pages/delivery-page';
import { FleetDashboardPage } from '@/features/logistics/fleet/pages/fleet-dashboard-page';
import { ServiceAreasPage } from '@/features/logistics/network/pages/service-areas-page';
import { DispatchCommandCenterPage } from '@/features/logistics/dispatch/pages/dispatch-command-center-page';
import { OperationsCenterPage } from '@/features/logistics/operations/pages/operations-center-page';
import { DispatchExecutionPage } from '@/features/logistics/dispatch/pages/dispatch-execution-page';
import { OperationalDashboardsPage } from '@/features/logistics/operations/pages/operational-dashboards-page';
import { AlertCenterPage } from '@/features/logistics/operations/pages/alert-center-page';
import { ActivityCenterPage } from '@/features/logistics/operations/pages/activity-center-page';
import { EnterpriseReadinessPage } from '@/features/logistics/operations/pages/enterprise-readiness-page';
import { EnterpriseWorkspacePage as LogisticsEnterpriseWorkspacePage } from '@/features/logistics/operations/pages/enterprise-workspace-page';
import { DistributionBoardPage } from '@/features/operations/distribution-board/pages/distribution-board-page';
import { LoadingDashboardPage } from '@/features/operations/distribution-board/pages/loading-dashboard-page';
import { LoadingWorkspacePage } from '@/features/operations/distribution-board/pages/loading-workspace-page';
import { DispatchGatePage } from '@/features/operations/distribution-board/pages/dispatch-gate-page';
import { DispatchGateWorkspacePage } from '@/features/operations/distribution-board/pages/dispatch-gate-workspace-page';
import { MarketingDashboardPage } from '@/features/marketing/pages/marketing-dashboard-page';
import { MarketingAssetsPage } from '@/features/marketing/pages/marketing-assets-page';
import { MetaConnectPage } from '@/features/marketing/pages/meta-connect-page';
import { MetaConnectionPage } from '@/features/marketing/pages/meta-connection-page';
import { CampaignsWorkspacePage } from '@/features/marketing/pages/campaigns-workspace-page';
import { CampaignExecutiveDashboardPage } from '@/features/marketing/pages/campaign-executive-dashboard-page';
import { InitiativesWorkspacePage } from '@/features/marketing/pages/initiatives-workspace-page';
import { InitiativeExecutiveViewPage } from '@/features/marketing/pages/initiative-executive-view-page';
import { CampaignStudioPage } from '@/features/marketing/campaign-studio/pages/campaign-studio-page';
import { CampaignGovernancePage } from '@/features/marketing/campaign-studio/pages/campaign-governance-page';
import { StudioExecutiveDashboardPage } from '@/features/marketing/campaign-studio/pages/studio-executive-dashboard-page';
import { ExecutiveDashboardPage } from '@/features/marketing/intelligence/pages/executive-dashboard-page';
import { CampaignAnalyticsPage } from '@/features/marketing/intelligence/pages/campaign-analytics-page';
import { AdAnalyticsPage } from '@/features/marketing/intelligence/pages/ad-analytics-page';
import { CreativeAnalyticsPage } from '@/features/marketing/intelligence/pages/creative-analytics-page';
import { PerformanceTrendsPage } from '@/features/marketing/intelligence/pages/performance-trends-page';
import { BudgetAnalysisPage } from '@/features/marketing/intelligence/pages/budget-analysis-page';
import { ReportsPage } from '@/features/marketing/intelligence/pages/reports-page';
import { MarketingSettingsPage } from '@/features/marketing/pages/marketing-settings-page';
import { AutomationWorkspacePage } from '@/features/marketing/automation/pages/automation-workspace-page';
import { WorkflowBuilderPage } from '@/features/marketing/automation/pages/workflow-builder-page';
import { AudienceSegmentsPage } from '@/features/marketing/automation/pages/audience-segments-page';
import { AutomationDashboardPage } from '@/features/marketing/automation/pages/automation-dashboard-page';
import { AutomationGovernancePage } from '@/features/marketing/automation/pages/automation-governance-page';
import { DriverHomePage } from '@/features/operations/driver-mobile/pages/driver-home-page';
import { DriverTripDashboardPage } from '@/features/operations/driver-mobile/pages/driver-trip-dashboard-page';
import { DriverStopListPage } from '@/features/operations/driver-mobile/pages/driver-stop-list-page';
import { DriverStopDetailPage } from '@/features/operations/driver-mobile/pages/driver-stop-detail-page';
import { DriverCollectionsPage } from '@/features/operations/driver-mobile/pages/driver-collections-page';
import { DriverExceptionsPage } from '@/features/operations/driver-mobile/pages/driver-exceptions-page';
import { DriverReturnsPage } from '@/features/operations/driver-mobile/pages/driver-returns-page';
import { DriverSettlementPage } from '@/features/operations/driver-mobile/pages/driver-settlement-page';
import { DriverCustodyReturnPage } from '@/features/operations/driver-mobile/pages/driver-custody-return-page';
import { DriverTripTimelinePage } from '@/features/operations/driver-mobile/pages/driver-trip-timeline-page';
import { DriverMapPage } from '@/features/operations/driver-mobile/pages/driver-map-page';
import { JourneyExplorerPage } from '@/features/core/business-attribution/pages/journey-explorer-page';
import { BaeTimelinePage } from '@/features/core/business-attribution/pages/bae-timeline-page';
import { UnifiedInboxPage } from '@/features/customer-engagement/pages/unified-inbox-page';
import { CepDashboardPage } from '@/features/customer-engagement/pages/cep-dashboard-page';
import { CepLeadsPage } from '@/features/customer-engagement/pages/cep-leads-page';
import { NotFoundPage } from '@/features/core/pages/not-found-page';
import { BridgeDashboardPage } from '@/features/claude-bridge/pages/bridge-dashboard-page';
import { BridgeTasksPage } from '@/features/claude-bridge/pages/bridge-tasks-page';
import { BridgeCreateTaskPage } from '@/features/claude-bridge/pages/bridge-create-task-page';
import { BridgeTaskDetailPage } from '@/features/claude-bridge/pages/bridge-task-detail-page';
import { BridgeSettingsPage } from '@/features/claude-bridge/pages/bridge-settings-page';
import { EngineeringDashboardPage } from '@/features/engineering/pages/engineering-dashboard-page';
import { EngineeringRunsPage } from '@/features/engineering/pages/engineering-runs-page';
import { EngineeringFindingsPage } from '@/features/engineering/pages/engineering-findings-page';
import { EngineeringPipelinePage } from '@/features/engineering/pages/engineering-pipeline-page';
import { EngineeringPipelineHistoryPage } from '@/features/engineering/pages/engineering-pipeline-history-page';
import { EngineeringNotificationsPage } from '@/features/engineering/pages/engineering-notifications-page';
import { EngineeringAnalyticsPage } from '@/features/engineering/pages/engineering-analytics-page';
import ClusterDashboardPage from '@/features/engineering/pages/ClusterDashboardPage';
import ReleaseDashboardPage from '@/features/engineering/pages/ReleaseDashboardPage';
import AIEngineeringWorkspacePage from '@/features/engineering/pages/AIEngineeringWorkspacePage';
import RepairSessionsPage from '@/features/engineering/pages/RepairSessionsPage';
import EnterpriseWorkspacePage from '@/features/engineering/pages/EnterpriseWorkspacePage';
import { OmnichannelInboxPage } from '@/features/conversational-commerce/pages/omnichannel-inbox-page';
import { MacrosPage } from '@/features/conversational-commerce/pages/macros-page';
import { RoutingRulesPage } from '@/features/conversational-commerce/pages/routing-rules-page';
import { ChannelProvidersPage } from '@/features/conversational-commerce/pages/channel-providers-page';
import { ConversationsDashboardPage } from '@/features/conversational-commerce/pages/conversations-dashboard-page';
import { WorkforceDashboardPage } from '@/features/hr/pages/workforce-dashboard-page';
import { EmployeesPage } from '@/features/hr/pages/employees-page';
import { Employee360Page } from '@/features/hr/pages/employee-360-page';
import { OrganizationChartPage } from '@/features/hr/pages/organization-chart-page';
import { WorkforceStructurePage } from '@/features/hr/pages/workforce-structure-page';
import { AttendanceWorkspacePage } from '@/features/hr/pages/attendance-workspace-page';
import { LeaveRequestsPage } from '@/features/hr/pages/leave-requests-page';
import { CompensationWorkspacePage } from '@/features/hr/pages/compensation-workspace-page';
import { Compensation360Page } from '@/features/hr/pages/compensation-360-page';
import { CommissionRulesPage } from '@/features/hr/pages/commission-rules-page';
import { PerformanceWorkspacePage } from '@/features/hr/pages/performance-workspace-page';
import { EmployeePerformancePage } from '@/features/hr/pages/employee-performance-page';
import { DepartmentPerformancePage } from '@/features/hr/pages/department-performance-page';
import { CareersPortalPage } from '@/features/hr/pages/careers-portal-page';
import { CareersApplyPage } from '@/features/hr/pages/careers-apply-page';
import { RecruitmentWorkspacePage } from '@/features/hr/pages/recruitment-workspace-page';
import { ApplicationDetailPage } from '@/features/hr/pages/application-detail-page';
import { HrExecutivePage } from '@/features/hr/pages/hr-executive-page';
import { HrAnalyticsPage } from '@/features/hr/pages/hr-analytics-page';
// HR V1 enhancements (TASK-HR-V1-ENHANCEMENTS-001)
import { RecruitmentAnalyticsPage } from '@/features/hr/pages/recruitment-analytics-page';
import { ApplicantTagsPage } from '@/features/hr/pages/applicant-tags-page';
import { OffersWorkspacePage } from '@/features/hr/pages/offers-workspace-page';
import { ExitManagementPage } from '@/features/hr/pages/exit-management-page';
import { CompensationExplainabilityPage } from '@/features/hr/pages/compensation-explainability-page';
import { AuthLayout } from '@/layouts/auth-layout';
import { GuestRoute } from '@/router/guards/guest-route';
import { ProtectedRoute } from '@/router/guards/protected-route';
import { ROUTES } from '@/router/routes';
// ROUTES.settings is deliberately absent: the real settings workspace already
// exists at ROUTES.configurationOs, so a Coming Soon placeholder here was a dead
// link competing with it in the same menu (UAT BUG-04). It redirects instead.
// ROUTES.crm is deliberately absent too: CRM is complete and its rail entry
// resolves to /crm/customers, but the bare /crm URL still rendered a Coming Soon
// placeholder for anyone arriving by bookmark, deep link or typed address
// (BUG-GL-004). It redirects instead.
const moduleRoutes = [ROUTES.sales, ROUTES.reports, ROUTES.users, ROUTES.roles].map((path) => ({
  path,
  Component: ComingSoonPage,
}));

export const router = createBrowserRouter(
  [
    { path: ROUTES.home, Component: HomePage },
    // PUBLIC careers portal — deliberately outside ProtectedRoute and AppShell.
    // A visitor has no session, no company context and no navigation rail.
    { path: ROUTES.careers, Component: CareersPortalPage },
    { path: ROUTES.careersJob, Component: CareersApplyPage },
    {
      path: ROUTES.login,
      Component: GuestRoute,
      children: [{ Component: AuthLayout, children: [{ index: true, Component: LoginPage }] }],
    },
    {
      Component: ProtectedRoute,
      children: [
        // POS is full-screen — outside AppShell
        { path: ROUTES.pos, Component: PosPage },
        {
          Component: AppShell,
          children: [
            { path: ROUTES.dashboard, Component: DashboardPage },
            // Executive Platform (EPIC-EXECUTIVE-UI-001)
            { path: ROUTES.executiveDashboard, Component: ExecutivePlatformPage },
            // Finance workspace (EPIC-FINANCE-UI-001). /accounting = Executive Finance.
            { path: ROUTES.accounting, Component: FinanceExecutivePage },
            { path: ROUTES.financeChartOfAccounts, Component: ChartOfAccountsPage },
            { path: ROUTES.financeJournals, Component: JournalsPage },
            { path: ROUTES.financeStatements, Component: FinancialStatementsPage },
            { path: ROUTES.financeReceivables, Component: AccountsReceivablePage },
            { path: ROUTES.financePayables, Component: AccountsPayablePage },
            { path: ROUTES.financeCashBanking, Component: CashBankingPage },
            { path: ROUTES.financeFiscalClosing, Component: FiscalClosingPage },
            { path: ROUTES.financeBudgets, Component: BudgetsPage },
            { path: ROUTES.financeTaxVat, Component: TaxVatPage },
            // Organization workspace + sub-pages
            { path: ROUTES.organization, Component: OrganizationWorkspace },
            { path: ROUTES.orgSearch, Component: OrgSearchPage },
            { path: ROUTES.companies, Component: CompaniesPage },
            { path: ROUTES.brands, Component: BrandsPage },
            { path: ROUTES.businessAccounts, Component: BusinessAccountsPage },
            { path: ROUTES.teams, Component: TeamsPage },
            { path: ROUTES.branches, Component: BranchesPage },
            { path: ROUTES.branchCoverage, Component: BranchCoveragePage },
            // HR & Workforce OS — EPIC H1 + H2
            { path: ROUTES.hr, Component: WorkforceDashboardPage },
            { path: ROUTES.hrEmployees, Component: EmployeesPage },
            { path: ROUTES.hrEmployee360, Component: Employee360Page },
            { path: ROUTES.hrOrganizationChart, Component: OrganizationChartPage },
            { path: ROUTES.hrStructure, Component: WorkforceStructurePage },
            { path: ROUTES.hrAttendance, Component: AttendanceWorkspacePage },
            { path: ROUTES.hrLeave, Component: LeaveRequestsPage },
            // HR & Workforce OS — EPIC H3 + H4
            { path: ROUTES.hrCompensation, Component: CompensationWorkspacePage },
            { path: ROUTES.hrCommissionRules, Component: CommissionRulesPage },
            { path: ROUTES.hrCompensation360, Component: Compensation360Page },
            { path: ROUTES.hrPerformance, Component: PerformanceWorkspacePage },
            { path: ROUTES.hrEmployeePerformance, Component: EmployeePerformancePage },
            { path: ROUTES.hrDepartmentPerformance, Component: DepartmentPerformancePage },
            // HR & Workforce OS — EPIC H5 + H6
            // Static segments before the :applicationId pattern, or /analytics
            // and /tags would be matched as application ids.
            { path: ROUTES.hrRecruitmentAnalytics, Component: RecruitmentAnalyticsPage },
            { path: ROUTES.hrApplicantTags, Component: ApplicantTagsPage },
            { path: ROUTES.hrOffers, Component: OffersWorkspacePage },
            { path: ROUTES.hrExits, Component: ExitManagementPage },
            {
              path: ROUTES.hrCompensationExplainability,
              Component: CompensationExplainabilityPage,
            },
            { path: ROUTES.hrRecruitment, Component: RecruitmentWorkspacePage },
            { path: ROUTES.hrApplication, Component: ApplicationDetailPage },
            { path: ROUTES.hrExecutive, Component: HrExecutivePage },
            { path: ROUTES.hrAnalytics, Component: HrAnalyticsPage },
            { path: ROUTES.warehouses, Component: WarehousesPage },
            { path: ROUTES.channels, Component: ChannelsPage },
            // Inventory workspace + sub-pages
            // Old hub URL redirects to Products workspace
            { path: ROUTES.inventoryProducts, loader: () => redirect(ROUTES.products) },
            { path: ROUTES.products, Component: ProductsPage },
            { path: ROUTES.rawMaterials, Component: RawMaterialsPage },
            { path: ROUTES.stockLedger, Component: StockLedgerPage },
            // Legacy flat routes redirect to new Master Data paths
            { path: ROUTES.categories, loader: () => redirect(ROUTES.inventoryCategories) },
            { path: ROUTES.units, loader: () => redirect(ROUTES.inventoryUnits) },
            // Old scoped routes redirect to unified categories with scope query param
            {
              path: ROUTES.inventoryProductCategories,
              loader: () => redirect(`${ROUTES.inventoryCategories}?scope=product`),
            },
            {
              path: ROUTES.inventoryMaterialCategories,
              loader: () => redirect(`${ROUTES.inventoryCategories}?scope=material`),
            },
            // Inventory Master Data — unified categories workspace
            { path: ROUTES.inventoryCategories, Component: CategoriesPage },
            { path: ROUTES.inventoryUnits, Component: UnitsPage },
            // Inventory Control
            { path: ROUTES.inventoryDashboard, Component: InventoryDashboardPage },
            { path: ROUTES.inventoryAbcClassifications, Component: AbcClassificationPage },
            { path: ROUTES.inventoryCycleCountPlanner, Component: CycleCountPlannerPage },
            { path: ROUTES.inventoryVarianceAnalytics, Component: VarianceAnalyticsPage },
            { path: ROUTES.inventoryWarehousePerformance, Component: WarehousePerformancePage },
            // Inventory Count Sessions + Waste / Liability
            { path: ROUTES.inventoryCount, Component: InventoryCountPage },
            { path: ROUTES.wasteInvestigations, Component: WasteInvestigationsPage },
            { path: ROUTES.warehouseLiabilities, Component: WarehouseLiabilityPage },
            // Stock Transfers (placeholder)
            { path: ROUTES.stockTransfers, Component: StockTransfersPage },
            // Procurement — full suite
            { path: ROUTES.procurementHub, Component: ProcurementHubPage },
            { path: ROUTES.materialRequests, Component: MaterialRequestsPage },
            { path: ROUTES.purchases, Component: PurchasesPage },
            { path: ROUTES.supplierInvoices, Component: SupplierInvoicesPage },
            { path: ROUTES.receivingCenter, Component: ReceivingCenterPage },
            { path: ROUTES.supplierReturns, Component: SupplierReturnsPage },
            // Legacy redirects
            { path: ROUTES.purchaseMaterials, loader: () => redirect(ROUTES.purchases) },
            { path: ROUTES.purchaseOrders, loader: () => redirect(ROUTES.purchases) },
            { path: ROUTES.purchaseOrdersNew, loader: () => redirect(ROUTES.purchases) },
            { path: `${ROUTES.purchaseOrders}/:id`, loader: () => redirect(ROUTES.purchases) },
            { path: `${ROUTES.purchaseOrders}/:id/edit`, loader: () => redirect(ROUTES.purchases) },
            // Goods receipts — legacy paths redirect to Receiving Center
            { path: ROUTES.goodsReceipts, loader: () => redirect(ROUTES.receivingCenter) },
            { path: ROUTES.goodsReceiptsNew, Component: CreateGoodsReceiptPage },
            { path: `${ROUTES.goodsReceipts}/:id`, Component: ViewGoodsReceiptPage },
            { path: `${ROUTES.goodsReceipts}/:id/edit`, Component: EditGoodsReceiptPage },
            { path: ROUTES.suppliers, Component: SuppliersPage },
            // Sales
            { path: ROUTES.orders, Component: OrdersPage },
            { path: ROUTES.ordersNew, Component: OrderWorkspacePage },
            { path: `${ROUTES.orders}/:id/edit`, Component: OrderWorkspacePage },
            { path: `${ROUTES.orders}/:id`, Component: OrderWorkspacePage },
            { path: ROUTES.fulfillments, Component: FulfillmentsPage },
            { path: ROUTES.fulfillmentsNew, Component: CreateFulfillmentPage },
            { path: `${ROUTES.fulfillments}/:id`, Component: ViewFulfillmentPage },
            { path: ROUTES.customers, Component: CustomersPage },
            { path: ROUTES.crm, loader: () => redirect(ROUTES.crmCustomers) },
            { path: ROUTES.crmCustomers, Component: CrmCustomersWorkspacePage },
            { path: ROUTES.crmExecutive, Component: CrmExecutiveWorkspacePage },
            { path: ROUTES.customerDetail, Component: CustomerProfilePage },
            // Configuration OS
            { path: ROUTES.configurationOs, Component: ConfigurationOsPage },
            { path: ROUTES.configurationBrand, Component: BrandConfigurationPage },
            // Distribution OS
            { path: ROUTES.distributionBoard, Component: DistributionBoardPage },
            { path: `${ROUTES.loadingWorkspace}/:tripId/loading`, Component: LoadingWorkspacePage },
            // Loading OS
            { path: ROUTES.loadingOsDashboard, Component: LoadingDashboardPage },
            // Dispatch Gate OS
            { path: ROUTES.dispatchGate, Component: DispatchGatePage },
            { path: `${ROUTES.dispatchGate}/:tripId`, Component: DispatchGateWorkspacePage },
            // Logistics OS
            { path: ROUTES.logisticsGeography, Component: EgyptGeographyPage },
            { path: ROUTES.logisticsDistributionZones, Component: DistributionZonesPage },
            { path: ROUTES.logisticsDistributionPlanning, Component: DistributionPlanningPage },
            { path: ROUTES.logisticsTrips, Component: TripsWorkspacePage },
            { path: ROUTES.logisticsCarrierAccounts, Component: CarrierAccountsPage },
            { path: ROUTES.logisticsAutomation, Component: AutomationMonitoringPage },
            { path: ROUTES.logisticsIntelligence, Component: LogisticsIntelligencePage },
            { path: ROUTES.logisticsFuelReview, Component: FuelReviewPage },
            { path: ROUTES.logisticsDispatchBoard, Component: DispatchBoardPage },
            { path: ROUTES.logisticsShippingCompanies, Component: ShippingCompaniesPage },
            { path: ROUTES.logisticsDrivers, Component: DriversPage },
            { path: ROUTES.logisticsVehicles, Component: VehiclesPage },
            { path: ROUTES.logisticsDelivery, Component: DeliveryPage },
            { path: ROUTES.logisticsFleet, Component: FleetDashboardPage },
            { path: ROUTES.logisticsNetwork, Component: ServiceAreasPage },
            { path: ROUTES.logisticsDispatch, Component: DispatchCommandCenterPage },
            { path: ROUTES.logisticsOperations, Component: OperationsCenterPage },
            { path: ROUTES.logisticsDispatchExecution, Component: DispatchExecutionPage },
            { path: ROUTES.logisticsOpsDashboards, Component: OperationalDashboardsPage },
            { path: ROUTES.logisticsOpsAlerts, Component: AlertCenterPage },
            { path: ROUTES.logisticsOpsActivity, Component: ActivityCenterPage },
            { path: ROUTES.logisticsOpsReadiness, Component: EnterpriseReadinessPage },
            { path: ROUTES.logisticsEnterprise, Component: LogisticsEnterpriseWorkspacePage },
            // Marketing OS
            { path: ROUTES.marketing, Component: MarketingDashboardPage },
            { path: ROUTES.marketingAssets, Component: MarketingAssetsPage },
            { path: ROUTES.marketingConnectMeta, Component: MetaConnectPage },
            { path: ROUTES.marketingMetaConnection, Component: MetaConnectionPage },
            { path: ROUTES.marketingCampaigns, Component: CampaignsWorkspacePage },
            { path: ROUTES.marketingCampaignDash, Component: CampaignExecutiveDashboardPage },
            { path: ROUTES.marketingInitiatives, Component: InitiativesWorkspacePage },
            { path: ROUTES.marketingInitiativeDash, Component: InitiativeExecutiveViewPage },
            // Marketing Intelligence
            { path: ROUTES.marketingIntelligence, Component: ExecutiveDashboardPage },
            { path: ROUTES.marketingCampaignAnalytics, Component: CampaignAnalyticsPage },
            { path: ROUTES.marketingAdAnalytics, Component: AdAnalyticsPage },
            { path: ROUTES.marketingCreativeAnalytics, Component: CreativeAnalyticsPage },
            { path: ROUTES.marketingTrends, Component: PerformanceTrendsPage },
            { path: ROUTES.marketingBudget, Component: BudgetAnalysisPage },
            { path: ROUTES.marketingReports, Component: ReportsPage },
            // Marketing Settings
            { path: ROUTES.marketingSettings, Component: MarketingSettingsPage },
            // Campaign Studio
            { path: ROUTES.campaignStudio, Component: CampaignStudioPage },
            { path: ROUTES.campaignGovernance, Component: CampaignGovernancePage },
            { path: ROUTES.campaignStudioDashboard, Component: StudioExecutiveDashboardPage },
            // Core Platform — Business Attribution Engine
            { path: ROUTES.businessAttribution, Component: JourneyExplorerPage },
            { path: ROUTES.baeTimeline, Component: BaeTimelinePage },
            // Customer Engagement Platform
            { path: ROUTES.customerEngagement, Component: UnifiedInboxPage },
            { path: ROUTES.cepDashboard, Component: CepDashboardPage },
            { path: ROUTES.cepLeads, Component: CepLeadsPage },
            // Omnichannel Commerce (MKT-007)
            { path: ROUTES.omnichannelInbox, Component: OmnichannelInboxPage },
            { path: ROUTES.omnichannelDashboard, Component: ConversationsDashboardPage },
            { path: ROUTES.omnichannelMacros, Component: MacrosPage },
            { path: ROUTES.omnichannelRouting, Component: RoutingRulesPage },
            { path: ROUTES.omnichannelProviders, Component: ChannelProvidersPage },
            // Marketing Automation Platform
            { path: ROUTES.automationWorkspace, Component: AutomationWorkspacePage },
            { path: ROUTES.workflowBuilder, Component: WorkflowBuilderPage },
            { path: ROUTES.audienceSegments, Component: AudienceSegmentsPage },
            { path: ROUTES.automationDashboard, Component: AutomationDashboardPage },
            { path: ROUTES.automationGovernance, Component: AutomationGovernancePage },
            // Commerce
            { path: ROUTES.productMappings, Component: ProductMappingsPage },
            { path: ROUTES.syncLogs, Component: SyncLogsPage },
            // Materials sub-sections
            { path: ROUTES.packagingMaterials, Component: PackagingMaterialsPage },
            { path: ROUTES.consumables, Component: ConsumablesPage },
            { path: ROUTES.semiFinishedMaterials, Component: SemiFinishedMaterialsPage },
            // Recipes (canonical home: Inventory)
            { path: ROUTES.recipes, Component: RecipesPage },
            { path: ROUTES.recipesNew, Component: RecipeWorkspacePage },
            { path: `${ROUTES.recipes}/:id/edit`, Component: RecipeWorkspacePage },
            { path: `${ROUTES.recipes}/:id`, Component: RecipeWorkspacePage },
            // Legacy BOM routes — redirect to canonical recipe paths
            { path: ROUTES.boms, loader: () => redirect(ROUTES.recipes) },
            { path: ROUTES.bomsNew, loader: () => redirect(ROUTES.recipesNew) },
            { path: `${ROUTES.boms}/:id/edit`, Component: BomWorkspacePage },
            { path: `${ROUTES.boms}/:id`, Component: BomWorkspacePage },
            // Cost management
            { path: ROUTES.costManagement, Component: CostManagementDashboardPage },
            { path: ROUTES.costManagementPriceReview, Component: CostPricingCenterPage },
            { path: ROUTES.costManagementCostHistory, Component: CostHistoryPage },
            // Fulfillment Wave Workspace (TASK-PREP-UI-003 + TASK-PREP-UI-004)
            {
              path: ROUTES.waveWorkspace,
              Component: WaveWorkspaceLayout,
              children: [
                { index: true, Component: FulfillmentWaveWorkspacePage },
                { path: 'products', Component: WaveProductDemandPage },
                { path: 'materials', Component: WaveRawMaterialsPage },
                { path: 'missing', Component: WaveMissingMaterialsPage },
                { path: 'wave-orders', Component: WaveOrdersPage },
                { path: 'settings', Component: WaveSettingsPage },
              ],
            },
            // Claude Bridge
            { path: ROUTES.claudeBridge, Component: BridgeDashboardPage },
            { path: ROUTES.claudeBridgeTasks, Component: BridgeTasksPage },
            { path: ROUTES.claudeBridgeTasksNew, Component: BridgeCreateTaskPage },
            { path: ROUTES.claudeBridgeTaskDetail, Component: BridgeTaskDetailPage },
            { path: ROUTES.claudeBridgeSettings, Component: BridgeSettingsPage },
            // Engineering OS (TASK-ENG-005 / TASK-ENG-006)
            { path: ROUTES.engineeringDashboard, Component: EngineeringDashboardPage },
            { path: ROUTES.engineeringRuns, Component: EngineeringRunsPage },
            { path: ROUTES.engineeringFindings, Component: EngineeringFindingsPage },
            { path: ROUTES.engineeringPipeline, Component: EngineeringPipelinePage },
            { path: ROUTES.engineeringPipelineHistory, Component: EngineeringPipelineHistoryPage },
            { path: ROUTES.engineeringNotifications, Component: EngineeringNotificationsPage },
            { path: ROUTES.engineeringAnalytics, Component: EngineeringAnalyticsPage },
            { path: ROUTES.engineeringCluster, Component: ClusterDashboardPage },
            { path: ROUTES.engineeringReleases, Component: ReleaseDashboardPage },
            { path: ROUTES.engineeringAiSupervisor, Component: AIEngineeringWorkspacePage },
            { path: ROUTES.engineeringRepair, Component: RepairSessionsPage },
            { path: ROUTES.engineeringWorkspace, Component: EnterpriseWorkspacePage },
            // Driver Mobile OS (TASK-DIST-005)
            { path: ROUTES.driverHome, Component: DriverHomePage },
            { path: ROUTES.driverTrip, Component: DriverTripDashboardPage },
            { path: ROUTES.driverTripStops, Component: DriverStopListPage },
            { path: ROUTES.driverTripStop, Component: DriverStopDetailPage },
            { path: ROUTES.driverTripCollections, Component: DriverCollectionsPage },
            { path: ROUTES.driverTripExceptions, Component: DriverExceptionsPage },
            { path: ROUTES.driverTripReturns, Component: DriverReturnsPage },
            { path: ROUTES.driverTripSettlement, Component: DriverSettlementPage },
            { path: ROUTES.driverTripCustody, Component: DriverCustodyReturnPage },
            { path: ROUTES.driverTripTimeline, Component: DriverTripTimelinePage },
            { path: ROUTES.driverTripMap, Component: DriverMapPage },
            ...moduleRoutes,
            // UAT BUG-04 — the menu's "Settings" entry pointed at a Coming Soon
            // placeholder while the real workspace lived elsewhere. Redirect so
            // the existing link resolves instead of dead-ending.
            { path: ROUTES.settings, loader: () => redirect(ROUTES.configurationOs) },
            { path: '*', Component: NotFoundPage },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
