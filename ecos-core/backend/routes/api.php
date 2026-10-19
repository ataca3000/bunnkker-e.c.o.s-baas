<?php

declare(strict_types=1);

use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\CompanyContextController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ExecutiveDashboardController;
use App\Http\Controllers\Infrastructure\HealthController;
use App\Http\Controllers\MediaController;
use Illuminate\Support\Facades\Route;
use Modules\Admin\Configuration\Presentation\Http\Controllers\BrandConfigurationController;
use Modules\Admin\Configuration\Presentation\Http\Controllers\CompanyConfigurationController;
use Modules\Admin\Configuration\Presentation\Http\Controllers\MasterGeographyController;
use Modules\Admin\Configuration\Presentation\Http\Controllers\MasterZoneController;
use Modules\Admin\Configuration\Presentation\Http\Controllers\PreparationPolicyController;
use Modules\ClaudeBridge\Presentation\Http\Controllers\ArtifactController as CbArtifactController;
use Modules\System\Engineering\Presentation\Http\Controllers\EngineeringDashboardController;
use Modules\System\Engineering\Presentation\Http\Controllers\PipelineController;
use Modules\System\Engineering\Presentation\Http\Controllers\PipelineAnalyticsController;
use Modules\System\Engineering\Presentation\Http\Controllers\PipelineRecoveryController;
use Modules\System\Engineering\Presentation\Http\Controllers\PipelineTemplateController;
use Modules\System\Engineering\Presentation\Http\Controllers\EngineeringNotificationController;
use Modules\System\Engineering\Presentation\Http\Controllers\InboxTaskController;
use Modules\System\Engineering\Presentation\Http\Controllers\InboxCommentController;
use Modules\System\Engineering\Presentation\Http\Controllers\InboxReleaseCandidateController;
use Modules\System\Engineering\Presentation\Http\Controllers\AgentRegistrationController;
use Modules\System\Engineering\Presentation\Http\Controllers\ExecutionSessionController;
use Modules\System\Engineering\Presentation\Http\Controllers\AIReviewController;
use Modules\System\Engineering\Presentation\Http\Controllers\AIScoreController;
use Modules\System\Engineering\Presentation\Http\Controllers\AIRiskController;
use Modules\System\Engineering\Presentation\Http\Controllers\AIRecommendationController;
use Modules\System\Engineering\Presentation\Http\Controllers\AIDashboardController;
use Modules\System\Engineering\Presentation\Http\Controllers\AITrendController;
use Modules\System\Engineering\Presentation\Http\Controllers\AIReleaseReviewController;
use Modules\System\Engineering\Presentation\Http\Controllers\RepairDashboardController;
use Modules\System\Engineering\Presentation\Http\Controllers\RepairSessionController;
use Modules\System\Engineering\Presentation\Http\Controllers\RepairPromptController;
use Modules\System\Engineering\Presentation\Http\Controllers\RepairResponseController;
use Modules\System\Engineering\Presentation\Http\Controllers\RepairPatchController;
use Modules\System\Engineering\Presentation\Http\Controllers\PatchValidationController;
use Modules\System\Engineering\Presentation\Http\Controllers\ValidationReportController;
use Modules\System\Engineering\Presentation\Http\Controllers\PatchRollbackController;
use Modules\System\Engineering\Presentation\Http\Controllers\GuardianDashboardController;
use Modules\System\Engineering\Presentation\Http\Controllers\GuardianRunController;
use Modules\System\Engineering\Presentation\Http\Controllers\GuardianPolicyController;
use Modules\System\Engineering\Presentation\Http\Controllers\IntelAnalyticsController;
use Modules\System\Engineering\Presentation\Http\Controllers\IntelKnowledgeController;
use Modules\System\Engineering\Presentation\Http\Controllers\IntelInsightsController;
use Modules\System\Engineering\Presentation\Http\Controllers\WorkspaceController;
use Modules\System\Engineering\Presentation\Http\Controllers\WorkspaceViewController;
use Modules\ClaudeBridge\Presentation\Http\Controllers\DashboardController as CbDashboardController;
use Modules\ClaudeBridge\Presentation\Http\Controllers\TaskController as CbTaskController;
use Modules\ClaudeBridge\Presentation\Http\Controllers\WorkerApiController as CbWorkerApiController;
use Modules\ClaudeBridge\Presentation\Http\Controllers\WorkerController as CbWorkerController;
use Modules\ClaudeBridge\Presentation\Http\Middleware\VerifyWorkerToken;
use Modules\Commerce\Channels\Presentation\Http\Controllers\ChannelController;
use Modules\Commerce\Connectors\Presentation\Http\Controllers\ConnectorController;
use Modules\Commerce\Fulfillments\Presentation\Http\Controllers\FulfillmentController;
use Modules\Commerce\OrderImport\Presentation\Http\Controllers\OrderImportController;
use Modules\Commerce\Orders\Presentation\Http\Controllers\OrderController;
use Modules\Commerce\ProductImport\Presentation\Http\Controllers\ProductImportController;
use Modules\Commerce\ProductMappings\Presentation\Http\Controllers\ProductMappingController;
use Modules\Commerce\Shipping\Presentation\Http\Controllers\ShippingQuoteController;
use Modules\Commerce\StockSync\Presentation\Http\Controllers\StockSyncController;
use Modules\Commerce\Synchronization\Presentation\Http\Controllers\SynchronizationController;
use Modules\Commerce\Synchronization\Presentation\Http\Controllers\WooCommerceWebhookController;
use Modules\Core\DemandAnalysis\Presentation\Http\Controllers\DemandAnalysisController as ProductDemandAnalysisController;
use Modules\Core\UserPreferences\Presentation\Http\Controllers\UserPreferenceController;
use Modules\CostManagement\Presentation\Http\Controllers\CostManagementDashboardController;
use Modules\CostManagement\Presentation\Http\Controllers\MaterialCostController;
use Modules\CostManagement\Presentation\Http\Controllers\PricingReviewController;
use Modules\IAM\Presentation\Http\Controllers\AuthController;
use Modules\Inventory\CountSessions\Presentation\Http\Controllers\InventoryCountController;
use Modules\Inventory\InventoryControl\Presentation\Http\Controllers\AbcClassificationController;
use Modules\Inventory\InventoryControl\Presentation\Http\Controllers\CycleCountPlanController;
use Modules\Inventory\InventoryControl\Presentation\Http\Controllers\InventoryDashboardController;
use Modules\Inventory\InventoryControl\Presentation\Http\Controllers\VarianceAnalyticsController;
use Modules\Inventory\InventoryControl\Presentation\Http\Controllers\WarehousePerformanceController;
use Modules\Inventory\Products\Presentation\Http\Controllers\ProductController;
use Modules\Inventory\ReceiptLayers\Presentation\Http\Controllers\InventoryLayerController;
use Modules\Inventory\StockLedger\Presentation\Http\Controllers\StockMovementController;
use Modules\Inventory\WarehouseLiabilities\Presentation\Http\Controllers\WarehouseLiabilityController;
use Modules\Inventory\WasteInvestigations\Presentation\Http\Controllers\WasteInvestigationController;
use Modules\Logistics\Distribution\Presentation\Http\Controllers\DistributionPlanningController;
use Modules\Logistics\Distribution\Presentation\Http\Controllers\DistributionZoneController;
use Modules\Logistics\Geography\Presentation\Http\Controllers\CityAliasController;
use Modules\Logistics\Geography\Presentation\Http\Controllers\CityController;
use Modules\Logistics\Geography\Presentation\Http\Controllers\GovernorateController;
use Modules\Logistics\Distribution\Presentation\Http\Controllers\DeliveryController as LogisticsDeliveryController;
use Modules\Logistics\Distribution\Presentation\Http\Controllers\SettlementController as LogisticsSettlementController;
use Modules\Logistics\Distribution\Presentation\Http\Controllers\TripController as LogisticsTripController;
use Modules\Logistics\Delivery\Presentation\Http\Controllers\DeliveryAttemptController;
use Modules\Logistics\Delivery\Presentation\Http\Controllers\DeliveryCodController;
use Modules\Logistics\Delivery\Presentation\Http\Controllers\DeliveryController as DeliveryOsController;
use Modules\Logistics\Delivery\Presentation\Http\Controllers\DeliveryPodController;
use Modules\Logistics\Delivery\Presentation\Http\Controllers\DeliveryReturnController as DeliveryOsReturnController;
use Modules\Logistics\Drivers\Presentation\Http\Controllers\DriverController;
use Modules\Logistics\Carriers\Presentation\Http\Controllers\CarrierController;
use Modules\Logistics\Dispatch\Presentation\Http\Controllers\DispatchController;
use Modules\Logistics\Dispatch\Presentation\Http\Controllers\DispatchOperationsController;
use Modules\Logistics\Fleet\Presentation\Http\Controllers\FleetUnitController;
use Modules\Logistics\Network\Presentation\Http\Controllers\NetworkController;
use Modules\Logistics\Operations\Presentation\Http\Controllers\ActivityController;
use Modules\Logistics\Operations\Presentation\Http\Controllers\CapacityOperationsController;
use Modules\Logistics\Operations\Presentation\Http\Controllers\DashboardController;
use Modules\Logistics\Operations\Presentation\Http\Controllers\DiagnosticsController;
use Modules\Logistics\Operations\Presentation\Http\Controllers\ExceptionController as OperationsExceptionController;
use Modules\Logistics\Operations\Presentation\Http\Controllers\OperationalHealthController;
use Modules\Logistics\Operations\Presentation\Http\Controllers\ReadinessController;
use Modules\Logistics\Operations\Presentation\Http\Controllers\ResourcePoolController;
use Modules\Logistics\Operations\Presentation\Http\Controllers\SummaryController;
use Modules\Logistics\Intelligence\Presentation\Http\Controllers\DecisionController;
use Modules\Logistics\Intelligence\Presentation\Http\Controllers\ForecastController;
use Modules\Logistics\Intelligence\Presentation\Http\Controllers\InsightController;
use Modules\Logistics\Intelligence\Presentation\Http\Controllers\OptimizationController;
use Modules\Logistics\Intelligence\Presentation\Http\Controllers\EnterpriseDashboardController;
use Modules\Logistics\Automation\Presentation\Http\Controllers\AutomationController;
use Modules\Finance\Presentation\Http\Controllers\AccountController as FinanceAccountController;
use Modules\Finance\Presentation\Http\Controllers\BankController as FinanceBankController;
use Modules\Finance\Presentation\Http\Controllers\CashController as FinanceCashController;
use Modules\Finance\Presentation\Http\Controllers\ControlReconciliationController as FinanceControlReconciliationController;
use Modules\Finance\Presentation\Http\Controllers\CostCenterController as FinanceCostCenterController;
use Modules\Finance\Presentation\Http\Controllers\CustomerInvoiceController as FinanceCustomerInvoiceController;
use Modules\Finance\Presentation\Http\Controllers\CustomerLedgerController as FinanceCustomerLedgerController;
use Modules\Finance\Presentation\Http\Controllers\CustomerReceiptController as FinanceCustomerReceiptController;
use Modules\Finance\Presentation\Http\Controllers\AccountRoleController as FinanceAccountRoleController;
use Modules\Finance\Presentation\Http\Controllers\PostingDeadLetterController as FinancePostingDeadLetterController;
use Modules\Finance\Presentation\Http\Controllers\PostingIntegrationController as FinancePostingIntegrationController;
use Modules\Finance\Presentation\Http\Controllers\PostingRuleController as FinancePostingRuleController;
use Modules\Finance\Presentation\Http\Controllers\BudgetController as FinanceBudgetController;
use Modules\Finance\Presentation\Http\Controllers\BudgetControlController as FinanceBudgetControlController;
use Modules\Finance\Presentation\Http\Controllers\ClosingController as FinanceClosingController;
use Modules\Finance\Presentation\Http\Controllers\ClosingWorkspaceController as FinanceClosingWorkspaceController;
use Modules\Finance\Presentation\Http\Controllers\FinancialControlsController as FinanceFinancialControlsController;
use Modules\Finance\Presentation\Http\Controllers\PeriodClosingController as FinancePeriodClosingController;
use Modules\Finance\Presentation\Http\Controllers\VatController as FinanceVatController;
use Modules\Finance\Presentation\Http\Controllers\YearEndController as FinanceYearEndController;
use Modules\Finance\Presentation\Http\Controllers\CashFlowController as FinanceCashFlowController;
use Modules\Finance\Presentation\Http\Controllers\CfoWorkspaceController as FinanceCfoWorkspaceController;
use Modules\Finance\Presentation\Http\Controllers\CostIntelligenceController as FinanceCostIntelligenceController;
use Modules\Finance\Presentation\Http\Controllers\ExecutiveReportingController as FinanceExecutiveReportingController;
use Modules\Finance\Presentation\Http\Controllers\ExecutiveWorkspaceController as FinanceExecutiveWorkspaceController;
use Modules\Finance\Presentation\Http\Controllers\FinancialAnalyticsController as FinanceFinancialAnalyticsController;
use Modules\Finance\Presentation\Http\Controllers\FinancialIntelligenceController as FinanceFinancialIntelligenceController;
use Modules\Finance\Presentation\Http\Controllers\ProfitabilityController as FinanceProfitabilityController;
use Modules\Finance\Presentation\Http\Controllers\ScenarioController as FinanceScenarioController;
use Modules\Finance\Presentation\Http\Controllers\FiscalController as FinanceFiscalController;
use Modules\Crm\Customers\Presentation\Http\Controllers\CustomerController as CrmCustomerController;
use Modules\Crm\Customers\Presentation\Http\Controllers\CustomerContactController as CrmCustomerContactController;
use Modules\Crm\Customers\Presentation\Http\Controllers\CustomerGroupController as CrmCustomerGroupController;
use Modules\Crm\Customers\Presentation\Http\Controllers\CustomerMergeController as CrmCustomerMergeController;
use Modules\Crm\Engagement\Presentation\Http\Controllers\ActivityController as CrmActivityController;
use Modules\Crm\Engagement\Presentation\Http\Controllers\TaskController as CrmTaskController;
use Modules\Crm\Engagement\Presentation\Http\Controllers\TimelineController as CrmTimelineController;
use Modules\Crm\Service\Presentation\Http\Controllers\KnowledgeBaseController as CrmKnowledgeBaseController;
use Modules\Crm\Service\Presentation\Http\Controllers\ResolutionLibraryController as CrmResolutionLibraryController;
use Modules\Crm\Service\Presentation\Http\Controllers\ServiceAdminController as CrmServiceAdminController;
use Modules\Crm\Service\Presentation\Http\Controllers\TicketController as CrmTicketController;
use Modules\Crm\Service\Presentation\Http\Controllers\TicketNoteController as CrmTicketNoteController;
use Modules\Crm\Sales\Presentation\Http\Controllers\LeadController as CrmLeadController;
use Modules\Crm\Sales\Presentation\Http\Controllers\OpportunityController as CrmOpportunityController;
use Modules\Crm\Sales\Presentation\Http\Controllers\PipelineController as CrmPipelineController;
use Modules\Crm\Sales\Presentation\Http\Controllers\QuoteController as CrmQuoteController;
use Modules\Crm\Sales\Presentation\Http\Controllers\SalesActivityController as CrmSalesActivityController;
use Modules\Crm\Loyalty\Presentation\Http\Controllers\LoyaltyController as CrmLoyaltyController;
use Modules\Crm\Loyalty\Presentation\Http\Controllers\PointsController as CrmPointsController;
use Modules\Crm\Loyalty\Presentation\Http\Controllers\RewardController as CrmRewardController;
use Modules\Crm\Intelligence\Presentation\Http\Controllers\PurchaseFactController as CrmPurchaseFactController;
use Modules\Crm\Intelligence\Presentation\Http\Controllers\CustomerIntelligenceController as CrmIntelligenceController;
use Modules\Crm\Intelligence\Presentation\Http\Controllers\SegmentationController as CrmSegmentationController;
use Modules\Crm\Intelligence\Presentation\Http\Controllers\CustomerAnalyticsController as CrmAnalyticsController;
use Modules\Crm\Intelligence\Presentation\Http\Controllers\RecommendationController as CrmRecommendationController;
use Modules\Crm\Executive\Presentation\Http\Controllers\ExecutiveDashboardController as CrmExecutiveDashboardController;
use Modules\Crm\Executive\Presentation\Http\Controllers\ExecutivePerformanceController as CrmExecutivePerformanceController;
use Modules\Crm\Executive\Presentation\Http\Controllers\ExecutiveReportController as CrmExecutiveReportController;
use Modules\Hr\Workforce\Presentation\Http\Controllers\EmployeeController as HrEmployeeController;
use Modules\Hr\Workforce\Presentation\Http\Controllers\WorkforceStructureController as HrStructureController;
use Modules\Hr\Workforce\Presentation\Http\Controllers\EmploymentContractController as HrContractController;
use Modules\Hr\Workforce\Presentation\Http\Controllers\OrganizationChartController as HrOrgChartController;
use Modules\Hr\Workforce\Presentation\Http\Controllers\EmployeeDocumentController as HrDocumentController;
use Modules\Hr\Attendance\Presentation\Http\Controllers\AttendanceController as HrAttendanceController;
use Modules\Hr\Attendance\Presentation\Http\Controllers\LeaveRequestController as HrLeaveController;
use Modules\Hr\Attendance\Presentation\Http\Controllers\WorkScheduleController as HrScheduleController;
use Modules\Hr\Attendance\Presentation\Http\Controllers\WorkforceAvailabilityController as HrAvailabilityController;
use Modules\Hr\Compensation\Presentation\Http\Controllers\PayrollController as HrPayrollController;
use Modules\Hr\Compensation\Presentation\Http\Controllers\CompensationController as HrCompensationController;
use Modules\Hr\Compensation\Presentation\Http\Controllers\CommissionRuleController as HrCommissionController;
use Modules\Hr\Compensation\Presentation\Http\Controllers\KpiFactController as HrKpiFactController;
use Modules\Hr\Performance\Presentation\Http\Controllers\PerformanceController as HrPerformanceController;
use Modules\Hr\Performance\Presentation\Http\Controllers\PerformanceReviewController as HrReviewController;
use Modules\Hr\Recruitment\Presentation\Http\Controllers\PublicCareersController as HrPublicCareersController;
use Modules\Hr\Recruitment\Presentation\Http\Controllers\RecruitmentController as HrRecruitmentController;
use Modules\Hr\Recruitment\Presentation\Http\Controllers\HiringController as HrHiringController;
use Modules\Hr\Recruitment\Presentation\Http\Controllers\RecruitmentEnhancementController as HrRecruitmentEnhancementController;
use Modules\Hr\Recruitment\Presentation\Http\Controllers\OfferController as HrOfferController;
use Modules\Hr\Recruitment\Presentation\Http\Controllers\ExitController as HrExitController;
use Modules\Hr\Compensation\Presentation\Http\Controllers\CompensationExplainabilityController as HrCompensationExplainabilityController;
use Modules\Hr\Executive\Presentation\Http\Controllers\HrExecutiveController as HrExecutiveController;
use Modules\Finance\Presentation\Http\Controllers\JournalController as FinanceJournalController;
use Modules\Finance\Presentation\Http\Controllers\SupplierBillController as FinanceSupplierBillController;
use Modules\Finance\Presentation\Http\Controllers\SupplierLedgerController as FinanceSupplierLedgerController;
use Modules\Finance\Presentation\Http\Controllers\SupplierPaymentController as FinanceSupplierPaymentController;
use Modules\Finance\Presentation\Http\Controllers\TaxController as FinanceTaxController;
use Modules\Finance\Presentation\Http\Controllers\FinancialStatementController as FinanceStatementController;
use Modules\Finance\Presentation\Http\Controllers\TrialBalanceController as FinanceTrialBalanceController;
use Modules\Logistics\Routing\Presentation\Http\Controllers\RoutingController;
use Modules\Logistics\Fleet\Presentation\Http\Controllers\FuelController as FleetFuelController;
use Modules\Logistics\Fleet\Presentation\Http\Controllers\InspectionController as FleetInspectionController;
use Modules\Logistics\Fleet\Presentation\Http\Controllers\MaintenanceController as FleetMaintenanceController;
use Modules\Logistics\Vehicles\Presentation\Http\Controllers\VehicleController;
use Modules\Logistics\Vehicles\Presentation\Http\Controllers\VehicleMaintenanceController;
use Modules\Logistics\ShippingCompanies\Presentation\Http\Controllers\ShippingCompanyController;
use Modules\Manufacturing\BillsOfMaterials\Presentation\Http\Controllers\BomController;
use Modules\MasterData\Categories\Presentation\Http\Controllers\CategoryController;
use Modules\MasterData\Units\Presentation\Http\Controllers\UnitController;
use Modules\MasterData\Warehouses\Presentation\Http\Controllers\WarehouseController;
use Modules\Operations\DemandAnalysis\Presentation\Http\Controllers\DemandAnalysisController;
use Modules\Operations\DemandAnalysis\Presentation\Http\Controllers\WaveDemandController;
use Modules\Operations\Fulfillment\Presentation\Http\Controllers\BulkFulfillmentController;
use Modules\Operations\Fulfillment\Presentation\Http\Controllers\FulfillmentController as OrderFulfillmentController;
use Modules\Operations\Loading\Presentation\Http\Controllers\AllocationController;
use Modules\Operations\Loading\Presentation\Http\Controllers\DriverAssignmentController;
use Modules\Operations\Loading\Presentation\Http\Controllers\LoadingDashboardController;
use Modules\Operations\Loading\Presentation\Http\Controllers\LoadingExceptionController;
use Modules\Operations\Loading\Presentation\Http\Controllers\LoadingSessionController;
use Modules\Operations\Loading\Presentation\Http\Controllers\VehicleAssignmentController;
use Modules\Operations\Loading\Presentation\Http\Controllers\VehicleInventoryController;
use Modules\Operations\Preparation\Presentation\Http\Controllers\PreparationAnalyticsController;
use Modules\Operations\Preparation\Presentation\Http\Controllers\PreparationDashboardController;
use Modules\Operations\Preparation\Presentation\Http\Controllers\PreparationEnterpriseController;
use Modules\Operations\Preparation\Presentation\Http\Controllers\PreparationSessionController;
use Modules\Operations\Preparation\Presentation\Http\Controllers\PreparationStationController;
use Modules\Operations\Preparation\Presentation\Http\Controllers\PreparationWaveController;
use Modules\Operations\Preparation\Presentation\Http\Controllers\PreparationWorkerController;
use Modules\Operations\Preparation\Presentation\Http\Controllers\PreparedPoolController;
use Modules\Operations\Preparation\Presentation\Http\Controllers\WarehouseAssignmentController;
use Modules\Organization\Branches\Presentation\Http\Controllers\BranchController;
use Modules\Organization\Branches\Presentation\Http\Controllers\BranchCoverageController;
use Modules\Organization\Brands\Presentation\Http\Controllers\BrandController;
use Modules\Organization\Brands\Presentation\Http\Controllers\BrandDeliveryController;
use Modules\Organization\Brands\Presentation\Http\Controllers\BrandDeliveryTimeSlotController;
use Modules\Organization\Brands\Presentation\Http\Controllers\BrandShippingController;
use Modules\Organization\BusinessAccounts\Presentation\Http\Controllers\BusinessAccountController;
use Modules\Organization\Companies\Presentation\Http\Controllers\CompanyController;
use Modules\Organization\Teams\Presentation\Http\Controllers\TeamController;
use Modules\POS\Presentation\Http\Controllers\CartController as PosCartController;
use Modules\POS\Presentation\Http\Controllers\CartLineController as PosCartLineController;
use Modules\POS\Presentation\Http\Controllers\ExchangeController as PosExchangeController;
use Modules\POS\Presentation\Http\Controllers\ReceiptController as PosReceiptController;
use Modules\POS\Presentation\Http\Controllers\ReturnController as PosReturnController;
use Modules\POS\Presentation\Http\Controllers\SaleController as PosSaleController;
use Modules\POS\Presentation\Http\Controllers\SessionController as PosSessionController;
use Modules\POS\Presentation\Http\Controllers\ShiftController as PosShiftController;
use Modules\POS\Presentation\Http\Controllers\TerminalController as PosTerminalController;
use Modules\Purchasing\GoodsReceipts\Presentation\Http\Controllers\GoodsReceiptController;
use Modules\Purchasing\PurchaseMaterials\Presentation\Http\Controllers\PurchaseMaterialController;
use Modules\Purchasing\PurchaseOrders\Presentation\Http\Controllers\PurchaseOrderController;
use Modules\Purchasing\SupplierInvoices\Presentation\Http\Controllers\SupplierInvoiceController;
use Modules\Purchasing\SupplierReturns\Presentation\Http\Controllers\SupplierReturnController;
use Modules\Purchasing\Suppliers\Presentation\Http\Controllers\SupplierAnalyticsController;
use Modules\Purchasing\Suppliers\Presentation\Http\Controllers\SupplierController;
use Modules\Purchasing\Suppliers\Presentation\Http\Controllers\SupplierDocumentController;
use Modules\Sales\Customers\Presentation\Http\Controllers\CustomerAddressController;
use Modules\Sales\Customers\Presentation\Http\Controllers\CustomerController;

/*
|--------------------------------------------------------------------------
| Infrastructure — Health check (public, no auth)
|
| Returns real DB + Redis + queue connectivity status plus build metadata.
| Used by docker-compose healthcheck and monitoring systems.
|--------------------------------------------------------------------------
*/
Route::get('/health', HealthController::class);

/*
|--------------------------------------------------------------------------
| IAM — Authentication routes
|--------------------------------------------------------------------------
*/
Route::prefix('auth')->group(function (): void {
    Route::middleware(['throttle:10,1'])->group(function (): void {
        Route::post('/login', [AuthController::class, 'login']);
    });

    Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
    });
});

/*
|--------------------------------------------------------------------------
| Organization — Companies (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('admin/dashboard', AdminDashboardController::class);
    Route::get('admin/executive-dashboard', ExecutiveDashboardController::class);
    Route::get('context/company', CompanyContextController::class);

    // The caller's own notification feed — the read side of Laravel's
    // `notifications` table, which producers have been writing to since
    // 2026-07 with nothing to read it back. Gated by ownership, not a
    // permission: every query is scoped to the authenticated notifiable, so a
    // permission could only ever widen it past the one boundary that must hold.
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::post('notifications/mark-all-read', [NotificationController::class, 'markAllRead']);

    // AUTHZ: reuses permissions that were already seeded and already assigned to
    // roles — nothing invented. Reads stay open to any authenticated user, as
    // before; only the mutating verbs are gated. Roles flagged is_system bypass
    // unconditionally, so Super Admin is unaffected.
    Route::apiResource('companies', CompanyController::class)
        ->middlewareFor('store', 'permission:organization.companies.create')
        ->middlewareFor('update', 'permission:organization.companies.update')
        ->middlewareFor('destroy', 'permission:organization.companies.delete');
    Route::apiResource('branches', BranchController::class)
        ->middlewareFor('store', 'permission:organization.branches.create')
        ->middlewareFor('update', 'permission:organization.branches.update')
        ->middlewareFor('destroy', 'permission:organization.branches.delete');
    Route::prefix('branches/{branch}')->group(function (): void {
        Route::get('coverage', [BranchCoverageController::class, 'index']);
        Route::post('coverage', [BranchCoverageController::class, 'store'])->middleware('permission:organization.branches.update');
        Route::put('coverage/{area}', [BranchCoverageController::class, 'update'])->middleware('permission:organization.branches.update');
        Route::delete('coverage/{area}', [BranchCoverageController::class, 'destroy'])->middleware('permission:organization.branches.update');
    });
    Route::apiResource('brands', BrandController::class)
        ->middlewareFor('store', 'permission:organization.brands.create')
        ->middlewareFor('update', 'permission:organization.brands.update')
        ->middlewareFor('destroy', 'permission:organization.brands.delete');
    Route::prefix('brands/{brand}')->group(function (): void {
        Route::get('delivery-geography', [BrandDeliveryController::class, 'geography']);
        Route::get('delivery-windows', [BrandDeliveryController::class, 'windows']);
        Route::get('configuration-health', [BrandDeliveryController::class, 'health']);
        Route::post('transfer/analyze', [BrandController::class, 'analyze'])->middleware('permission:organization.brands.update');
        Route::post('transfer', [BrandController::class, 'transfer'])->middleware('permission:organization.brands.update');

        // Brand Delivery Time Slots (customer checkout time windows)
        Route::post('delivery-time-slots/seed-defaults', [BrandDeliveryTimeSlotController::class, 'seedDefaults'])->middleware('permission:organization.brands.update');
        Route::patch('delivery-time-slots/reorder', [BrandDeliveryTimeSlotController::class, 'reorder'])->middleware('permission:organization.brands.update');
        Route::get('delivery-time-slots', [BrandDeliveryTimeSlotController::class, 'index']);
        Route::post('delivery-time-slots', [BrandDeliveryTimeSlotController::class, 'store'])->middleware('permission:organization.brands.update');
        Route::put('delivery-time-slots/{slot}', [BrandDeliveryTimeSlotController::class, 'update'])->middleware('permission:organization.brands.update');
        Route::delete('delivery-time-slots/{slot}', [BrandDeliveryTimeSlotController::class, 'destroy'])->middleware('permission:organization.brands.update');

        // Brand Shipping Configuration (Geography-aware, policy-driven)
        Route::get('shipping-settings', [BrandShippingController::class, 'getSettings']);
        Route::put('shipping-settings', [BrandShippingController::class, 'updateSettings'])->middleware('permission:organization.brands.update');
        Route::get('shipping/governorates', [BrandShippingController::class, 'listGovernorates']);
        Route::put('shipping/governorates/{governorate}', [BrandShippingController::class, 'updateGovernorate'])->middleware('permission:organization.brands.update');
        Route::get('shipping/cities', [BrandShippingController::class, 'listCities']);
        Route::put('shipping/cities/{city}', [BrandShippingController::class, 'updateCity'])->middleware('permission:organization.brands.update');
        Route::get('shipping/calculate', [BrandShippingController::class, 'calculatePrice']);
    });
    Route::apiResource('business-accounts', BusinessAccountController::class)
        ->middlewareFor('store', 'permission:organization.business_accounts.create')
        ->middlewareFor('update', 'permission:organization.business_accounts.update')
        ->middlewareFor('destroy', 'permission:organization.business_accounts.delete');
    Route::apiResource('teams', TeamController::class)
        ->middlewareFor('store', 'permission:organization.teams.create')
        ->middlewareFor('update', 'permission:organization.teams.update')
        ->middlewareFor('destroy', 'permission:organization.teams.delete');
});

/*
|--------------------------------------------------------------------------
| Shipping Engine — Quote / Validation (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::post('shipping/quote', [ShippingQuoteController::class, 'quote'])->middleware('permission:logistics.shipping.quote');
});

/*
|--------------------------------------------------------------------------
| Master Data — Warehouses, Categories, Units (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::apiResource('warehouses', WarehouseController::class)
        ->middlewareFor('store', 'permission:inventory.warehouses.create')
        ->middlewareFor('update', 'permission:inventory.warehouses.update')
        ->middlewareFor('destroy', 'permission:inventory.warehouses.delete');
    Route::apiResource('categories', CategoryController::class)
        ->middlewareFor('store', 'permission:inventory.categories.create')
        ->middlewareFor('update', 'permission:inventory.categories.update')
        ->middlewareFor('destroy', 'permission:inventory.categories.delete');
    Route::apiResource('units', UnitController::class)
        ->middlewareFor('store', 'permission:inventory.units.create')
        ->middlewareFor('update', 'permission:inventory.units.update')
        ->middlewareFor('destroy', 'permission:inventory.units.delete');
});

/*
|--------------------------------------------------------------------------
| Media — File uploads (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::post('media/upload', [MediaController::class, 'upload']);
});

/*
|--------------------------------------------------------------------------
| Inventory — Products, Stock Ledger (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('products/stats', [ProductController::class, 'stats']);
    Route::get('products/next-sku', [ProductController::class, 'nextSku']);
    Route::middleware(['throttle:10,1'])->group(function (): void {
        Route::post('products/import', [ProductController::class, 'import'])->middleware('permission:inventory.products.create');
    });
    Route::apiResource('products', ProductController::class)
        ->middlewareFor('store', 'permission:inventory.products.create')
        ->middlewareFor('update', 'permission:inventory.products.update')
        ->middlewareFor('destroy', 'permission:inventory.products.delete');
    Route::patch('products/{product}', [ProductController::class, 'patch'])->middleware('permission:inventory.products.update');
    Route::get('products/{product}/cost-history', [InventoryLayerController::class, 'costHistory']);
    Route::get('products/{product}/warehouse-distribution', [InventoryLayerController::class, 'warehouseDistribution']);
    Route::get('stock-movements', [StockMovementController::class, 'index']);
    Route::post('stock-movements', [StockMovementController::class, 'store'])->middleware('permission:inventory.stock.adjust');
    Route::get('stock-movements/{stockMovement}', [StockMovementController::class, 'show']);
    Route::get('inventory/layers', [InventoryLayerController::class, 'index']);
});

/*
|--------------------------------------------------------------------------
| Inventory — Count Sessions (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    // Explicit per-action permission middleware replaces the bare apiResource call
    // so every endpoint is protected at the appropriate authorization level.
    Route::get('inventory-counts', [InventoryCountController::class, 'index'])->middleware('permission:inventory.count.view');
    Route::post('inventory-counts', [InventoryCountController::class, 'store'])->middleware('permission:inventory.count.create');
    Route::get('inventory-counts/{inventoryCount}', [InventoryCountController::class, 'show'])->middleware('permission:inventory.count.view');
    Route::put('inventory-counts/{inventoryCount}', [InventoryCountController::class, 'update'])->middleware('permission:inventory.count.update');
    Route::patch('inventory-counts/{inventoryCount}', [InventoryCountController::class, 'update'])->middleware('permission:inventory.count.update');
    Route::delete('inventory-counts/{inventoryCount}', [InventoryCountController::class, 'destroy'])->middleware('permission:inventory.count.delete');

    Route::post('inventory-counts/{inventoryCount}/start', [InventoryCountController::class, 'start'])->middleware('permission:inventory.count.update');
    Route::post('inventory-counts/{inventoryCount}/complete', [InventoryCountController::class, 'complete'])->middleware('permission:inventory.count.update');
    Route::post('inventory-counts/{inventoryCount}/approve', [InventoryCountController::class, 'approve'])->middleware('permission:inventory.count.approve');
    Route::post('inventory-counts/{inventoryCount}/cancel', [InventoryCountController::class, 'cancel'])->middleware('permission:inventory.count.delete');
    Route::get('inventory-counts/{inventoryCount}/report', [InventoryCountController::class, 'report'])->middleware('permission:inventory.count.view');

    // Line attachments
    Route::post('inventory-counts/{inventoryCount}/lines/{line}/attachments', [InventoryCountController::class, 'storeAttachment'])->middleware('permission:inventory.count.update');
    Route::delete('inventory-counts/{inventoryCount}/lines/{line}/attachments/{attachment}', [InventoryCountController::class, 'destroyAttachment'])->middleware('permission:inventory.count.delete');
});

/*
|--------------------------------------------------------------------------
| Inventory — Waste Investigations (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('inventory/waste-investigations/report', [WasteInvestigationController::class, 'report']);
    Route::get('inventory/waste-investigations', [WasteInvestigationController::class, 'index']);
    Route::get('inventory/waste-investigations/{id}', [WasteInvestigationController::class, 'show']);
    Route::post('inventory/waste-investigations/{id}/resolve', [WasteInvestigationController::class, 'resolve'])->middleware('permission:inventory.waste.resolve');
    Route::post('inventory/waste-investigations/{id}/attachments', [WasteInvestigationController::class, 'storeAttachment'])->middleware('permission:inventory.waste.resolve');
    Route::delete('inventory/waste-investigations/{id}/attachments/{attachmentId}', [WasteInvestigationController::class, 'destroyAttachment'])->middleware('permission:inventory.waste.resolve');
});

/*
|--------------------------------------------------------------------------
| Inventory — Warehouse Liabilities (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('inventory/warehouse-liabilities/report', [WarehouseLiabilityController::class, 'report']);
    Route::get('inventory/warehouse-liabilities', [WarehouseLiabilityController::class, 'index']);
    Route::get('inventory/warehouse-liabilities/{id}', [WarehouseLiabilityController::class, 'show']);
    Route::post('inventory/warehouse-liabilities/{id}/approve', [WarehouseLiabilityController::class, 'approve'])->middleware('permission:inventory.liabilities.approve');
    Route::post('inventory/warehouse-liabilities/{id}/reject', [WarehouseLiabilityController::class, 'reject'])->middleware('permission:inventory.liabilities.reject');
});

/*
|--------------------------------------------------------------------------
| Sales — Customers (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('customers/search-by-phone', [CustomerController::class, 'searchByPhone']);
    Route::apiResource('customers', CustomerController::class)
        ->middlewareFor('store', 'permission:crm.customers.create')
        ->middlewareFor('update', 'permission:crm.customers.update')
        ->middlewareFor('destroy', 'permission:crm.customers.delete');
    Route::apiResource('customers.addresses', CustomerAddressController::class)->shallow()
        ->middlewareFor('store', 'permission:crm.customers.update')
        ->middlewareFor('update', 'permission:crm.customers.update')
        ->middlewareFor('destroy', 'permission:crm.customers.update');
});

/*
|--------------------------------------------------------------------------
| Commerce — Channels (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::apiResource('channels', ChannelController::class)
        ->middlewareFor('store', 'permission:sales.channels.create')
        ->middlewareFor('update', 'permission:sales.channels.update')
        ->middlewareFor('destroy', 'permission:sales.channels.delete');
    Route::post('channels/{channel}/test-connection', [ConnectorController::class, 'testConnection'])->middleware('permission:sales.channels.update');
    Route::middleware(['throttle:10,1'])->group(function (): void {
        Route::post('channels/{channel}/import-products', [ProductImportController::class, 'importProducts'])->middleware('permission:sales.channels.sync');
        Route::post('channels/{channel}/import-orders', [OrderImportController::class, 'importOrders'])->middleware('permission:sales.channels.sync');
    });
    Route::apiResource('product-mappings', ProductMappingController::class)
        ->middlewareFor('store', 'permission:sales.channels.update')
        ->middlewareFor('update', 'permission:sales.channels.update')
        ->middlewareFor('destroy', 'permission:sales.channels.update');
    Route::get('orders/statuses', [OrderController::class, 'orderStatuses']);
    Route::get('orders/filter/payment-methods', [OrderController::class, 'paymentMethods']);
    Route::get('orders/filter/shipping-companies', [OrderController::class, 'shippingCompanies']);
    Route::post('orders/manual', [OrderController::class, 'storeManual'])->middleware('permission:sales.orders.create');
    Route::post('orders/maps/resolve-url', [OrderController::class, 'resolveMapsUrl'])->middleware('permission:sales.orders.update');
    Route::get('orders/pricing/product/{productId}', [OrderController::class, 'productPricing']);
    Route::patch('orders/{order}/quick-update', [OrderController::class, 'quickUpdate'])->middleware('permission:sales.orders.update');
    Route::patch('orders/{order}/zone', [OrderController::class, 'updateZone'])->middleware('permission:sales.orders.update');
    Route::post('orders/{order}/confirm-customer', [OrderController::class, 'confirmCustomer'])->middleware('permission:sales.orders.update');
    Route::get('orders/{order}/activities', [OrderController::class, 'activities']);
    Route::post('orders/{order}/notes', [OrderController::class, 'addNote'])->middleware('permission:sales.orders.update');
    Route::patch('orders/{order}/notes/{note}', [OrderController::class, 'updateNote'])->middleware('permission:sales.orders.update');
    Route::delete('orders/{order}/notes/{note}', [OrderController::class, 'deleteNote'])->middleware('permission:sales.orders.update');
    Route::get('orders/{order}/snapshot', [OrderController::class, 'financialSnapshot']);
    Route::apiResource('orders', OrderController::class)
        ->middlewareFor('store', 'permission:sales.orders.create')
        ->middlewareFor('update', 'permission:sales.orders.update')
        ->middlewareFor('destroy', 'permission:sales.orders.delete');
    Route::post('orders/{order}/prepare', [OrderController::class, 'prepare'])->middleware('permission:sales.orders.update');
    Route::post('orders/{order}/verify-payment', [OrderController::class, 'verifyPayment'])->middleware('permission:sales.orders.update');
    // CR-PREP-001: Warehouse assignment
    Route::post('orders/{order}/assign-warehouse', [WarehouseAssignmentController::class, 'assignWarehouse'])->middleware('permission:sales.orders.update');
    Route::post('orders/{order}/override-warehouse', [WarehouseAssignmentController::class, 'overrideWarehouse'])->middleware('permission:sales.orders.update');
    Route::get('orders/{order}/assignment-history', [WarehouseAssignmentController::class, 'assignmentHistory']);
    Route::apiResource('fulfillments', FulfillmentController::class)
        ->middlewareFor('store', 'permission:sales.fulfillments.create')
        ->middlewareFor('update', 'permission:sales.fulfillments.update')
        ->middlewareFor('destroy', 'permission:sales.fulfillments.delete');
    Route::post('fulfillments/{fulfillment}/fulfill', [FulfillmentController::class, 'fulfill'])->middleware('permission:sales.fulfillments.update');
    Route::post('fulfillments/{fulfillment}/cancel', [FulfillmentController::class, 'cancel'])->middleware('permission:sales.fulfillments.update');
    Route::get('stock-sync-logs', [StockSyncController::class, 'index']);
    Route::post('channels/{channel}/sync-stock', [StockSyncController::class, 'syncStock'])->middleware('permission:sales.channels.sync');
});

/*
|--------------------------------------------------------------------------
| Purchasing — Suppliers (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('suppliers/stats', [SupplierAnalyticsController::class, 'summaryStats']);
    Route::apiResource('suppliers', SupplierController::class)
        ->middlewareFor('store', 'permission:purchasing.suppliers.create')
        ->middlewareFor('update', 'permission:purchasing.suppliers.update')
        ->middlewareFor('destroy', 'permission:purchasing.suppliers.delete');
    Route::get('suppliers/{supplier}/analytics', [SupplierAnalyticsController::class, 'analytics']);
    Route::get('suppliers/{supplier}/inventory-breakdown', [SupplierAnalyticsController::class, 'inventoryBreakdown']);
    Route::get('suppliers/{supplier}/health', [SupplierAnalyticsController::class, 'health']);
    Route::get('suppliers/{supplier}/price-history', [SupplierAnalyticsController::class, 'priceHistory']);
    Route::get('suppliers/{supplier}/timeline', [SupplierAnalyticsController::class, 'timeline']);
    Route::get('suppliers/{supplier}/documents', [SupplierDocumentController::class, 'index']);
    Route::post('suppliers/{supplier}/documents', [SupplierDocumentController::class, 'store'])->middleware('permission:purchasing.suppliers.update');
    Route::delete('suppliers/{supplier}/documents/{document}', [SupplierDocumentController::class, 'destroy'])->middleware('permission:purchasing.suppliers.update');
    Route::get('suppliers/{supplier}/documents/{document}/download', [SupplierDocumentController::class, 'download']);
    Route::apiResource('purchase-orders', PurchaseOrderController::class)
        ->middlewareFor('store', 'permission:purchasing.purchase_orders.create')
        ->middlewareFor('update', 'permission:purchasing.purchase_orders.update')
        ->middlewareFor('destroy', 'permission:purchasing.purchase_orders.delete');
    Route::post('purchase-orders/{purchaseOrder}/submit', [PurchaseOrderController::class, 'submit'])->middleware('permission:purchasing.purchase_orders.update');
    Route::post('purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve'])->middleware('permission:purchasing.purchase_orders.update');
    Route::post('purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel'])->middleware('permission:purchasing.purchase_orders.update');
    Route::apiResource('goods-receipts', GoodsReceiptController::class)
        ->middlewareFor('store', 'permission:purchasing.goods_receipts.create')
        ->middlewareFor('update', 'permission:purchasing.goods_receipts.update')
        ->middlewareFor('destroy', 'permission:purchasing.goods_receipts.delete');
    Route::post('goods-receipts/{goodsReceipt}/post', [GoodsReceiptController::class, 'post'])->middleware('permission:purchasing.goods_receipts.update');

    // Purchase Materials
    Route::middleware('permission:purchasing.materials.view')
        ->get('purchase-materials/stats', [PurchaseMaterialController::class, 'stats']);
    Route::middleware('permission:purchasing.materials.view')
        ->get('purchase-materials/procurement-panel/{product}', [PurchaseMaterialController::class, 'procurementPanel']);
    Route::middleware('permission:purchasing.materials.view')
        ->get('purchase-materials', [PurchaseMaterialController::class, 'index']);
    Route::middleware('permission:purchasing.materials.view')
        ->get('purchase-materials/{purchaseMaterial}', [PurchaseMaterialController::class, 'show']);
    Route::middleware('permission:purchasing.materials.create')
        ->post('purchase-materials', [PurchaseMaterialController::class, 'store']);
    Route::middleware('permission:purchasing.materials.update')
        ->put('purchase-materials/{purchaseMaterial}', [PurchaseMaterialController::class, 'update']);
    Route::middleware('permission:purchasing.materials.delete')
        ->delete('purchase-materials/{purchaseMaterial}', [PurchaseMaterialController::class, 'destroy']);
    Route::middleware('permission:purchasing.materials.submit')
        ->post('purchase-materials/{purchaseMaterial}/submit', [PurchaseMaterialController::class, 'submit']);
    Route::middleware('permission:purchasing.materials.approve')
        ->post('purchase-materials/{purchaseMaterial}/approve', [PurchaseMaterialController::class, 'approve']);
    Route::middleware('permission:purchasing.materials.review')
        ->post('purchase-materials/{purchaseMaterial}/reject', [PurchaseMaterialController::class, 'reject']);
    Route::middleware('permission:purchasing.materials.review')
        ->post('purchase-materials/{purchaseMaterial}/hold', [PurchaseMaterialController::class, 'hold']);
    Route::middleware('permission:purchasing.materials.cancel')
        ->post('purchase-materials/{purchaseMaterial}/cancel', [PurchaseMaterialController::class, 'cancel']);
    Route::middleware('permission:purchasing.materials.review')
        ->post('purchase-materials/{purchaseMaterial}/assign-buyer', [PurchaseMaterialController::class, 'assignBuyer']);
    Route::middleware('permission:purchasing.materials.select_supplier')
        ->post('purchase-materials/{purchaseMaterial}/lines/{line}/select-supplier', [PurchaseMaterialController::class, 'selectLineSupplier']);
});

/*
|--------------------------------------------------------------------------
| Purchasing — Supplier Returns (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('supplier-returns/stats', [SupplierReturnController::class, 'stats']);
    Route::apiResource('supplier-returns', SupplierReturnController::class)
        ->middlewareFor('store', 'permission:purchasing.supplier_returns.create')
        ->middlewareFor('update', 'permission:purchasing.supplier_returns.edit')
        ->middlewareFor('destroy', 'permission:purchasing.supplier_returns.cancel');
    Route::post('supplier-returns/{supplierReturn}/submit', [SupplierReturnController::class, 'submit'])->middleware('permission:purchasing.supplier_returns.submit');
    Route::post('supplier-returns/{supplierReturn}/approve', [SupplierReturnController::class, 'approve'])->middleware('permission:purchasing.supplier_returns.approve');
    Route::post('supplier-returns/{supplierReturn}/reject', [SupplierReturnController::class, 'reject'])->middleware('permission:purchasing.supplier_returns.reject');
    Route::post('supplier-returns/{supplierReturn}/mark-sent', [SupplierReturnController::class, 'markSent'])->middleware('permission:purchasing.supplier_returns.mark_sent');
    Route::post('supplier-returns/{supplierReturn}/credit-pending', [SupplierReturnController::class, 'creditPending'])->middleware('permission:purchasing.supplier_returns.credit_pending');
    Route::post('supplier-returns/{supplierReturn}/complete', [SupplierReturnController::class, 'complete'])->middleware('permission:purchasing.supplier_returns.complete');
    Route::post('supplier-returns/{supplierReturn}/cancel', [SupplierReturnController::class, 'cancel'])->middleware('permission:purchasing.supplier_returns.cancel');
});

/*
|--------------------------------------------------------------------------
| Purchasing — Supplier Invoices (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('supplier-invoices/stats', [SupplierInvoiceController::class, 'stats']);
    Route::apiResource('supplier-invoices', SupplierInvoiceController::class)
        ->middlewareFor('store', 'permission:purchasing.supplier_invoices.create')
        ->middlewareFor('update', 'permission:purchasing.supplier_invoices.edit')
        ->middlewareFor('destroy', 'permission:purchasing.supplier_invoices.cancel');
    Route::post('supplier-invoices/{supplierInvoice}/validate', [SupplierInvoiceController::class, 'validate'])->middleware('permission:purchasing.supplier_invoices.validate');
    Route::post('supplier-invoices/{supplierInvoice}/post', [SupplierInvoiceController::class, 'post'])->middleware('permission:purchasing.supplier_invoices.post');
    Route::post('supplier-invoices/{supplierInvoice}/cancel', [SupplierInvoiceController::class, 'cancel'])->middleware('permission:purchasing.supplier_invoices.cancel');
});

/*
|--------------------------------------------------------------------------
| Manufacturing — Bills of Materials (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::apiResource('boms', BomController::class)
        ->middlewareFor('store', 'permission:inventory.recipes.create')
        ->middlewareFor('update', 'permission:inventory.recipes.update')
        ->middlewareFor('destroy', 'permission:inventory.recipes.delete');
    Route::patch('boms/{bom}/status', [BomController::class, 'setStatus'])
        ->middleware('permission:inventory.recipes.update');
    Route::get('boms/{bom}/cost-history', [BomController::class, 'costHistory']);
});

/*
|--------------------------------------------------------------------------
| Commerce — Synchronization Logs (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('sync-logs', [SynchronizationController::class, 'index']);
    Route::post('sync-logs/{syncLog}/retry', [SynchronizationController::class, 'retry'])->middleware('permission:sales.channels.sync');
});

/*
|--------------------------------------------------------------------------
| Inventory Control — Dashboard, ABC, Variance, Warehouse Performance (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('inventory/dashboard', [InventoryDashboardController::class, 'index']);
    Route::get('inventory/abc-classifications', [AbcClassificationController::class, 'index']);
    Route::post('inventory/abc-classifications/recalculate', [AbcClassificationController::class, 'recalculate'])->middleware('permission:inventory.abc.recalculate');
    Route::get('inventory/variance-analytics', [VarianceAnalyticsController::class, 'index']);
    Route::get('inventory/warehouse-performance', [WarehousePerformanceController::class, 'index']);
    Route::get('inventory/cycle-count-plans', [CycleCountPlanController::class, 'index']);
});

/*
|--------------------------------------------------------------------------
| Operations — Demand Analysis (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'throttle:120,1'])->group(function (): void {
    Route::get('operations/demand-analysis', [DemandAnalysisController::class, 'index']);
    // Shared product-level demand analysis — consumed by procurement, inventory, preparation OS
    Route::get('demand-analysis/{product}', [ProductDemandAnalysisController::class, 'show']);
});

/*
|--------------------------------------------------------------------------
| Core — User Preferences (protected)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->prefix('me')->group(function (): void {
    // Full category replacement and retrieval
    Route::get('preferences', [UserPreferenceController::class, 'index']);
    Route::delete('preferences', [UserPreferenceController::class, 'resetAll']);

    Route::get('preferences/{category}', [UserPreferenceController::class, 'show'])
        ->where('category', '[a-z][a-z0-9._-]{0,149}');

    Route::put('preferences/{category}', [UserPreferenceController::class, 'upsert'])
        ->where('category', '[a-z][a-z0-9._-]{0,149}');

    Route::delete('preferences/{category}', [UserPreferenceController::class, 'resetCategory'])
        ->where('category', '[a-z][a-z0-9._-]{0,149}');
});

/*
|--------------------------------------------------------------------------
| POS — Point of Sale (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:pos.terminal.operate'])->prefix('pos')->group(function (): void {
    // Terminals
    Route::get('terminals', [PosTerminalController::class, 'index']);

    // Sessions
    Route::post('sessions', [PosSessionController::class, 'store']);
    Route::get('sessions/{session}', [PosSessionController::class, 'show']);
    Route::delete('sessions/{session}', [PosSessionController::class, 'destroy']);

    // Shifts
    Route::post('shifts', [PosShiftController::class, 'store']);
    Route::get('shifts/{shift}', [PosShiftController::class, 'show']);
    Route::delete('shifts/{shift}', [PosShiftController::class, 'destroy']);
    Route::put('shifts/{shift}/approve', [PosShiftController::class, 'approve']);
    Route::put('shifts/{shift}/reject', [PosShiftController::class, 'reject']);

    // Carts
    Route::post('carts', [PosCartController::class, 'store']);
    Route::get('carts/{cart}', [PosCartController::class, 'show']);
    Route::post('carts/{cart}/hold', [PosCartController::class, 'hold']);
    Route::delete('carts/{cart}/hold', [PosCartController::class, 'resume']);
    Route::put('carts/{cart}/customer', [PosCartController::class, 'setCustomer']);
    Route::delete('carts/{cart}', [PosCartController::class, 'destroy']);

    // Cart lines
    Route::post('carts/{cart}/lines', [PosCartLineController::class, 'store']);
    Route::delete('carts/{cart}/lines/{line}', [PosCartLineController::class, 'destroy']);

    // Sales
    Route::post('sales', [PosSaleController::class, 'store']);
    Route::get('sales/{sale}', [PosSaleController::class, 'show']);

    // Returns
    Route::post('returns', [PosReturnController::class, 'store']);

    // Exchanges
    Route::post('exchanges', [PosExchangeController::class, 'store']);

    // Receipts
    Route::get('receipts/{receipt}', [PosReceiptController::class, 'show']);
    Route::post('receipts/{receipt}/reprint', [PosReceiptController::class, 'reprint']);
    Route::delete('receipts/{receipt}', [PosReceiptController::class, 'destroy']);
});

/*
|--------------------------------------------------------------------------
| Cost Management — Dashboard, Price Review, Material Cost History (protected)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->prefix('cost-management')->group(function (): void {
    // Dashboard KPIs
    Route::get('dashboard', [CostManagementDashboardController::class, 'index']);

    // Price Review Center
    Route::get('pricing-reviews', [PricingReviewController::class, 'index']);
    Route::get('pricing-reviews/badge', [PricingReviewController::class, 'badge']);
    Route::get('pricing-reviews/{id}/detail', [PricingReviewController::class, 'detail']);
    Route::post('pricing-reviews/{id}/approve', [PricingReviewController::class, 'approve'])->middleware('permission:inventory.price_review.approve');
    Route::post('pricing-reviews/{id}/snooze', [PricingReviewController::class, 'snooze'])->middleware('permission:inventory.price_review.update');
    Route::post('pricing-reviews/{id}/assign', [PricingReviewController::class, 'assign'])->middleware('permission:inventory.price_review.update');
    Route::post('pricing-reviews/{id}/publish', [PricingReviewController::class, 'publish'])->middleware('permission:inventory.price_review.publish');
    Route::post('pricing-reviews/bulk-approve', [PricingReviewController::class, 'bulkApprove'])->middleware('permission:inventory.price_review.approve');
    Route::patch('pricing-reviews/{id}/inline', [PricingReviewController::class, 'inline'])->middleware('permission:inventory.price_review.update');
    Route::post('pricing-reviews/bulk-policy', [PricingReviewController::class, 'bulkPolicy'])->middleware('permission:inventory.price_review.approve');

    // Material Cost History (global and per-material)
    Route::get('cost-history', [MaterialCostController::class, 'globalHistory']);
    Route::get('materials/{productId}/cost-history', [MaterialCostController::class, 'history']);
    Route::patch('materials/{productId}/cost', [MaterialCostController::class, 'update'])->middleware('permission:inventory.price_review.update');
});

/*
|--------------------------------------------------------------------------
| Operations — Preparation OS (protected)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->prefix('preparation')->group(function (): void {
    Route::get('dashboard', [PreparationDashboardController::class, 'index']);
    Route::get('analytics', [PreparationAnalyticsController::class, 'index']);

    Route::get('waves', [PreparationWaveController::class, 'index']);
    Route::post('waves', [PreparationWaveController::class, 'store'])->middleware('permission:operations.preparation.create');
    Route::get('waves/{waveId}', [PreparationWaveController::class, 'show']);
    Route::post('waves/{waveId}/generate-demand', [PreparationWaveController::class, 'generateDemand'])->middleware('permission:operations.preparation.update');
    Route::post('waves/{waveId}/analyze-materials', [PreparationWaveController::class, 'analyzeMaterials'])->middleware('permission:operations.preparation.update');
    Route::post('waves/{waveId}/start', [PreparationWaveController::class, 'start'])->middleware('permission:operations.preparation.update');
    Route::post('waves/{waveId}/advance', [PreparationWaveController::class, 'advance'])->middleware('permission:operations.preparation.update');
    Route::patch('waves/{waveId}/items/{itemId}/complete', [PreparationWaveController::class, 'completeItem'])->middleware('permission:operations.preparation.update');
    Route::post('waves/{waveId}/complete', [PreparationWaveController::class, 'complete'])->middleware('permission:operations.preparation.update');
    Route::post('waves/{waveId}/cancel', [PreparationWaveController::class, 'cancel'])->middleware('permission:operations.preparation.update');
    Route::post('waves/{waveId}/recalculate', [PreparationWaveController::class, 'recalculate'])->middleware('permission:operations.preparation.update');
    Route::get('waves/{waveId}/product-queue', [PreparationWaveController::class, 'productQueue']);
    Route::get('waves/{waveId}/items/{itemId}/workspace', [PreparationWaveController::class, 'productWorkspace']);
    Route::post('waves/{waveId}/issues', [PreparationWaveController::class, 'reportIssue'])->middleware('permission:operations.preparation.update');
    Route::post('waves/{waveId}/approve', [PreparationWaveController::class, 'approve'])->middleware('permission:operations.preparation.update');
    Route::post('waves/{waveId}/workers', [PreparationWaveController::class, 'assignWorker'])->middleware('permission:operations.preparation.update');
    Route::delete('waves/{waveId}/workers/{userId}', [PreparationWaveController::class, 'releaseWorker'])->middleware('permission:operations.preparation.update');
    Route::post('waves/{waveId}/resolve-shortage', [PreparationWaveController::class, 'resolveShortage'])->middleware('permission:operations.preparation.update');
    Route::get('waves/{waveId}/timeline', [PreparationWaveController::class, 'timeline']);
    Route::get('waves/{waveId}/documents', [PreparationWaveController::class, 'documents']);

    // Demand Engine read models (TASK-PREP-INTEGRATION-001)
    Route::get('waves/{waveId}/kpis', [WaveDemandController::class, 'kpis']);
    Route::get('waves/{waveId}/product-demand', [WaveDemandController::class, 'productDemand']);
    Route::get('waves/{waveId}/material-demand', [WaveDemandController::class, 'materialDemand']);
    Route::get('waves/{waveId}/missing-materials', [WaveDemandController::class, 'missingMaterials']);
    Route::get('waves/{waveId}/manufacturing-demand', [WaveDemandController::class, 'manufacturingDemand']);
    Route::get('waves/{waveId}/orders', [WaveDemandController::class, 'waveOrders']);

    // Enterprise Preparation — Phases 6, 8, 9, 13, 14 (TASK-PREPARATION-INTEGRATION-001)
    Route::get('enterprise/queue', [PreparationEnterpriseController::class, 'queue']);
    Route::get('enterprise/capacity', [PreparationEnterpriseController::class, 'capacity']);
    Route::get('enterprise/optimization', [PreparationEnterpriseController::class, 'optimization']);
    Route::get('enterprise/dashboard', [PreparationEnterpriseController::class, 'dashboard']);
    Route::get('enterprise/ai-context', [PreparationEnterpriseController::class, 'aiContext']);

    // CR-PREP-001: Today's Preparation (must come before {sessionId} route)
    Route::get('sessions/today', [PreparationSessionController::class, 'today']);

    Route::get('sessions', [PreparationSessionController::class, 'index']);
    Route::post('sessions', [PreparationSessionController::class, 'store'])->middleware('permission:operations.preparation.create');
    Route::get('sessions/{sessionId}', [PreparationSessionController::class, 'show']);
    Route::post('sessions/{sessionId}/start', [PreparationSessionController::class, 'start'])->middleware('permission:operations.preparation.update');
    Route::post('sessions/{sessionId}/plan', [PreparationSessionController::class, 'plan'])->middleware('permission:operations.preparation.update');
    Route::post('sessions/{sessionId}/approve', [PreparationSessionController::class, 'approve'])->middleware('permission:operations.preparation.update');
    Route::post('sessions/{sessionId}/close', [PreparationSessionController::class, 'close'])->middleware('permission:operations.preparation.update');
    Route::post('sessions/{sessionId}/complete', [PreparationSessionController::class, 'complete'])->middleware('permission:operations.preparation.update');
    Route::post('sessions/{sessionId}/cancel', [PreparationSessionController::class, 'cancel'])->middleware('permission:operations.preparation.update');
    Route::post('sessions/{sessionId}/waves', [PreparationSessionController::class, 'addWave'])->middleware('permission:operations.preparation.update');
    Route::get('sessions/{sessionId}/consolidation', [PreparationSessionController::class, 'consolidation']);
    // CR-PREP-001: Freeze + Session Orders + Session Products
    Route::post('sessions/{sessionId}/freeze', [PreparationSessionController::class, 'freeze'])->middleware('permission:operations.preparation.update');
    Route::get('sessions/{sessionId}/orders', [PreparationSessionController::class, 'sessionOrders']);
    Route::post('sessions/{sessionId}/attach-order', [PreparationSessionController::class, 'attachOrder'])->middleware('permission:operations.preparation.update');
    Route::delete('sessions/{sessionId}/orders/{sessionOrderId}', [PreparationSessionController::class, 'detachOrder'])->middleware('permission:operations.preparation.update');
    Route::get('sessions/{sessionId}/products', [PreparationSessionController::class, 'sessionProducts']);

    // CR-PREP-001: Warehouse Assignment Policies
    Route::get('warehouse-assignment-policies', [WarehouseAssignmentController::class, 'indexPolicies']);
    Route::post('warehouse-assignment-policies', [WarehouseAssignmentController::class, 'storePolicy'])->middleware('permission:operations.preparation.create');
    Route::put('warehouse-assignment-policies/{id}', [WarehouseAssignmentController::class, 'updatePolicy'])->middleware('permission:operations.preparation.update');
    Route::delete('warehouse-assignment-policies/{id}', [WarehouseAssignmentController::class, 'destroyPolicy'])->middleware('permission:operations.preparation.delete');

    Route::get('pool', [PreparedPoolController::class, 'index']);
    Route::patch('pool/{poolId}/quality', [PreparedPoolController::class, 'updateQuality'])->middleware('permission:operations.preparation.update');
    Route::get('workers', [PreparationWorkerController::class, 'index']);
    Route::get('stations', [PreparationStationController::class, 'index']);
});

/*
|--------------------------------------------------------------------------
| Operations — Loading & Allocation OS (protected)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->prefix('loading')->group(function (): void {
    // Dashboard
    Route::get('dashboard', [LoadingDashboardController::class, 'index']);

    // Loading Sessions
    Route::get('sessions', [LoadingSessionController::class, 'index']);
    Route::post('sessions', [LoadingSessionController::class, 'store']);
    Route::get('sessions/{sessionId}', [LoadingSessionController::class, 'show']);
    Route::post('sessions/{sessionId}/open', [LoadingSessionController::class, 'open']);
    Route::post('sessions/{sessionId}/start-loading', [LoadingSessionController::class, 'startLoading']);
    Route::post('sessions/{sessionId}/complete-loading', [LoadingSessionController::class, 'completeLoading']);
    Route::post('sessions/{sessionId}/cancel', [LoadingSessionController::class, 'cancel']);
    Route::post('sessions/{sessionId}/close', [LoadingSessionController::class, 'close']);

    // Vehicle Assignments (within a session)
    Route::get('sessions/{sessionId}/assignments', [VehicleAssignmentController::class, 'index']);
    Route::post('sessions/{sessionId}/assignments', [VehicleAssignmentController::class, 'store']);
    Route::get('sessions/{sessionId}/assignments/{assignmentId}', [VehicleAssignmentController::class, 'show']);
    Route::post('sessions/{sessionId}/assignments/{assignmentId}/load-product', [VehicleAssignmentController::class, 'loadProduct']);
    Route::post('sessions/{sessionId}/assignments/{assignmentId}/dispatch', [VehicleAssignmentController::class, 'dispatch']);

    // Driver Assignments
    Route::post('sessions/{sessionId}/assignments/{assignmentId}/driver', [DriverAssignmentController::class, 'store']);
    Route::get('sessions/{sessionId}/assignments/{assignmentId}/driver', [DriverAssignmentController::class, 'show']);

    // Allocation
    Route::get('sessions/{sessionId}/assignments/{assignmentId}/allocation', [AllocationController::class, 'index']);
    Route::post('sessions/{sessionId}/start-allocation', [AllocationController::class, 'startAllocation']);
    Route::post('sessions/{sessionId}/complete-allocation', [AllocationController::class, 'completeAllocation']);
    Route::post('sessions/{sessionId}/assignments/{assignmentId}/allocation/override', [AllocationController::class, 'override']);

    // Vehicle Inventory
    Route::get('sessions/{sessionId}/assignments/{assignmentId}/inventory', [VehicleInventoryController::class, 'show']);

    // Exceptions
    Route::get('sessions/{sessionId}/exceptions', [LoadingExceptionController::class, 'index']);
    Route::post('sessions/{sessionId}/exceptions', [LoadingExceptionController::class, 'store']);
    Route::post('sessions/{sessionId}/exceptions/{exceptionId}/resolve', [LoadingExceptionController::class, 'resolve']);
});

/*
|--------------------------------------------------------------------------
| Operations — Distribution Board OS (protected)
| ADR-DIST-004: Wave is the single operational container
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Admin — Configuration OS (protected)
|--------------------------------------------------------------------------
*/
Route::middleware('auth:sanctum')->prefix('configuration')->group(function (): void {
    // Company-level settings
    Route::get('company', [CompanyConfigurationController::class, 'index']);
    Route::get('company/audit', [CompanyConfigurationController::class, 'audit']);
    Route::get('company/{group}', [CompanyConfigurationController::class, 'showGroup']);
    Route::put('company/{group}', [CompanyConfigurationController::class, 'updateGroup'])->middleware('permission:configuration.settings.manage');

    // Brand-level policy groups
    Route::get('brands/{brandId}/policies', [BrandConfigurationController::class, 'index']);
    Route::get('brands/{brandId}/policies/{group}', [BrandConfigurationController::class, 'show']);
    Route::put('brands/{brandId}/policies/{group}', [BrandConfigurationController::class, 'update'])->middleware('permission:configuration.settings.manage');
    Route::get('brands/{brandId}/audit', [BrandConfigurationController::class, 'audit']);

    // Delivery Windows — REMOVED (moved to Brand OS: /brands/{brand}/delivery-time-slots)

    // Preparation Policies (Configuration OS facade over Preparation OS)
    Route::get('brands/{brandId}/preparation-policies', [PreparationPolicyController::class, 'index']);
    Route::post('brands/{brandId}/preparation-policies', [PreparationPolicyController::class, 'store'])->middleware('permission:configuration.settings.manage');
    Route::put('brands/{brandId}/preparation-policies/{id}', [PreparationPolicyController::class, 'update'])->middleware('permission:configuration.settings.manage');

    // Master Geography — governorates
    Route::prefix('master-geography')->group(function (): void {
        Route::get('/', [MasterGeographyController::class, 'index']);
        Route::post('/', [MasterGeographyController::class, 'store'])->middleware('permission:configuration.settings.manage');
        Route::get('/{id}', [MasterGeographyController::class, 'show']);
        Route::put('/{id}', [MasterGeographyController::class, 'update'])->middleware('permission:configuration.settings.manage');
        Route::delete('/{id}', [MasterGeographyController::class, 'destroy'])->middleware('permission:configuration.settings.manage');
        Route::post('/{id}/archive', [MasterGeographyController::class, 'archive'])->middleware('permission:configuration.settings.manage');

        // Master zones nested under a governorate
        Route::get('/{govId}/zones', [MasterZoneController::class, 'index']);
        Route::post('/{govId}/zones', [MasterZoneController::class, 'store'])->middleware('permission:configuration.settings.manage');
        Route::put('/{govId}/zones/{id}', [MasterZoneController::class, 'update'])->middleware('permission:configuration.settings.manage');
        Route::delete('/{govId}/zones/{id}', [MasterZoneController::class, 'destroy'])->middleware('permission:configuration.settings.manage');
        Route::post('/{govId}/zones/{id}/archive', [MasterZoneController::class, 'archive'])->middleware('permission:configuration.settings.manage');
    });
});

/*
|--------------------------------------------------------------------------
| Operations — Fulfillment Engine (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:operations.fulfillment.manage'])->prefix('fulfillment')->group(function (): void {
    // Single-order workflow transitions (ADR TASK-ORDER-LIFECYCLE-001)
    Route::post('orders/{order}/confirm', [OrderFulfillmentController::class, 'confirm']);
    Route::post('orders/{order}/cancel', [OrderFulfillmentController::class, 'cancel']);
    Route::post('orders/{order}/move-to-preparation', [OrderFulfillmentController::class, 'moveToPreparation']);
    Route::post('orders/{order}/complete-delivery', [OrderFulfillmentController::class, 'completeDelivery']);
    Route::post('orders/{order}/complete', [OrderFulfillmentController::class, 'complete']);
    Route::post('orders/{order}/awaiting-stock', [OrderFulfillmentController::class, 'markAwaitingStock']);
    Route::post('orders/{order}/return', [OrderFulfillmentController::class, 'returnOrder']);
    Route::post('orders/{order}/reschedule', [OrderFulfillmentController::class, 'reschedule']);
    Route::post('orders/{order}/resume', [OrderFulfillmentController::class, 'resume']);
    Route::post('orders/{order}/review', [OrderFulfillmentController::class, 'moveToReview']);
    Route::post('orders/{order}/dispatch', [OrderFulfillmentController::class, 'dispatch']);
    Route::post('orders/{order}/return-to-pending', [OrderFulfillmentController::class, 'returnToPending']);
    Route::post('orders/{order}/revert-to-confirmed', [OrderFulfillmentController::class, 'revertToConfirmed']);
    Route::post('orders/{order}/return-to-processing', [OrderFulfillmentController::class, 'returnToProcessing']);
    Route::post('orders/{order}/approve-partial-reservation', [OrderFulfillmentController::class, 'approvePartialReservation']);
    // Generic business-state transition — frontend sends target_status, backend resolves workflow
    Route::post('orders/{order}/transition', [OrderFulfillmentController::class, 'transition']);

    // Return receiving
    Route::post('returns/{customerReturn}/receive', [OrderFulfillmentController::class, 'receiveReturn']);

    // Bulk workflow transitions
    Route::post('bulk/confirm', [BulkFulfillmentController::class, 'confirmBulk']);
    Route::post('bulk/cancel', [BulkFulfillmentController::class, 'cancelBulk']);
    Route::post('bulk/move-to-preparation', [BulkFulfillmentController::class, 'moveToPreparationBulk']);
    Route::post('bulk/complete-delivery', [BulkFulfillmentController::class, 'completeDeliveryBulk']);
    Route::post('bulk/complete', [BulkFulfillmentController::class, 'completeBulk']);
    Route::post('bulk/dispatch', [BulkFulfillmentController::class, 'dispatchBulk']);
    Route::post('bulk/awaiting-stock', [BulkFulfillmentController::class, 'markAwaitingStockBulk']);
    Route::post('bulk/resume', [BulkFulfillmentController::class, 'resumeBulk']);
    Route::post('bulk/review', [BulkFulfillmentController::class, 'moveToReviewBulk']);
    Route::post('bulk/reschedule', [BulkFulfillmentController::class, 'rescheduleBulk']);
    Route::post('bulk/return', [BulkFulfillmentController::class, 'returnBulk']);
    Route::post('bulk/return-to-confirmed', [BulkFulfillmentController::class, 'returnToConfirmedBulk']);
    Route::post('bulk/resume-to-confirmed', [BulkFulfillmentController::class, 'resumeToConfirmedBulk']);
});

/*
|--------------------------------------------------------------------------
| Marketing OS — Meta Integration Platform (protected)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:marketing.workspace.manage'])->prefix('marketing')->group(function (): void {
    // Dashboard
    Route::get('dashboard', [Modules\Marketing\Dashboard\Presentation\Http\Controllers\MarketingDashboardController::class, 'index']);

    // Connector registry
    Route::get('connectors', [Modules\Marketing\Connections\Presentation\Http\Controllers\ConnectionController::class, 'connectors']);

    // Connections
    Route::get('connections', [Modules\Marketing\Connections\Presentation\Http\Controllers\ConnectionController::class, 'index']);
    Route::get('connections/{connection}', [Modules\Marketing\Connections\Presentation\Http\Controllers\ConnectionController::class, 'show']);
    Route::post('connections/{connection}/validate', [Modules\Marketing\Connections\Presentation\Http\Controllers\ConnectionController::class, 'validatePermissions']);
    Route::post('connections/{connection}/disconnect', [Modules\Marketing\Connections\Presentation\Http\Controllers\ConnectionController::class, 'disconnect']);
    Route::post('connections/{connection}/sync', [Modules\Marketing\Synchronization\Presentation\Http\Controllers\SyncController::class, 'triggerSync']);
    Route::get('connections/{connection}/sync-logs', [Modules\Marketing\Synchronization\Presentation\Http\Controllers\SyncController::class, 'logs']);
    Route::get('connections/{connection}/health', [Modules\Marketing\Connections\Presentation\Http\Controllers\ConnectorHealthController::class, 'show']);

    // Provider Platform — registry and metrics
    Route::get('providers', [Modules\Marketing\ProviderPlatform\Presentation\Http\Controllers\ProviderPlatformController::class, 'index']);
    Route::get('providers/{provider}/metrics', [Modules\Marketing\ProviderPlatform\Presentation\Http\Controllers\ProviderPlatformController::class, 'metrics']);

    // Provider Configuration Wizard (Meta, Google Ads, TikTok, etc.)
    Route::get('providers/{provider}/config', [Modules\Marketing\ProviderConfig\Presentation\Http\Controllers\ProviderConfigController::class, 'show']);
    Route::post('providers/{provider}/config', [Modules\Marketing\ProviderConfig\Presentation\Http\Controllers\ProviderConfigController::class, 'save']);
    Route::post('providers/{provider}/config/validate', [Modules\Marketing\ProviderConfig\Presentation\Http\Controllers\ProviderConfigController::class, 'validate']);
    Route::post('providers/{provider}/config/rotate-secret', [Modules\Marketing\ProviderConfig\Presentation\Http\Controllers\ProviderConfigController::class, 'rotateSecret']);
    Route::get('providers/{provider}/health', [Modules\Marketing\ProviderConfig\Presentation\Http\Controllers\ProviderConfigController::class, 'health']);
    Route::delete('providers/{provider}/config', [Modules\Marketing\ProviderConfig\Presentation\Http\Controllers\ProviderConfigController::class, 'destroy']);

    // Meta OAuth + lifecycle
    Route::get('meta/auth/redirect', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaAuthController::class, 'redirect']);
    Route::get('meta/auth/callback', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaAuthController::class, 'callback']);
    Route::post('meta/connections/{connection}/disconnect', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaAuthController::class, 'disconnect']);

    // Meta — Incoming Webhook (no auth — Meta does not send auth headers)
    Route::get('meta/webhook', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaWebhookController::class, 'verify'])->withoutMiddleware(['auth:sanctum', 'permission:marketing.workspace.manage']);
    Route::post('meta/webhook', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaWebhookController::class, 'receive'])->withoutMiddleware(['auth:sanctum', 'permission:marketing.workspace.manage']);

    // Meta — Connection Dashboard & Management
    Route::get('meta/connections/{connection}/dashboard', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaConnectionController::class, 'dashboard']);
    Route::get('meta/connections/{connection}/businesses', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaConnectionController::class, 'businesses']);
    Route::post('meta/connections/{connection}/businesses/select', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaConnectionController::class, 'selectBusinesses']);
    Route::get('meta/connections/{connection}/assets', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaConnectionController::class, 'assets']);
    Route::get('meta/connections/{connection}/permissions', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaConnectionController::class, 'permissions']);
    Route::get('meta/permissions/required', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaConnectionController::class, 'requiredPermissions']);
    Route::get('meta/connections/{connection}/sync-status', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaConnectionController::class, 'syncStatus']);
    Route::post('meta/connections/{connection}/sync', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaConnectionController::class, 'sync']);
    Route::get('meta/connections/{connection}/recovery', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaConnectionController::class, 'recovery']);
    Route::patch('meta/assets/{asset}/toggle', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaConnectionController::class, 'toggleAsset']);

    // Meta — Webhook Management
    Route::get('meta/connections/{connection}/webhooks', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaWebhookController::class, 'index']);
    Route::post('meta/connections/{connection}/webhooks', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaWebhookController::class, 'register']);
    Route::post('meta/connections/{connection}/webhooks/register-all', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaWebhookController::class, 'registerAll']);
    Route::delete('meta/webhooks/{webhook}', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaWebhookController::class, 'remove']);
    Route::post('meta/webhooks/{webhook}/re-register', [Modules\Marketing\MetaConnector\Presentation\Http\Controllers\MetaWebhookController::class, 'reRegister']);

    // Assets
    Route::get('assets', [Modules\Marketing\Assets\Presentation\Http\Controllers\MarketingAssetController::class, 'index']);
    Route::get('assets/{marketingAsset}', [Modules\Marketing\Assets\Presentation\Http\Controllers\MarketingAssetController::class, 'show']);
    Route::post('assets/{marketingAsset}/check-health', [Modules\Marketing\Assets\Presentation\Http\Controllers\MarketingAssetController::class, 'checkHealth']);
    Route::get('assets/{marketingAsset}/graph', [Modules\Marketing\Assets\Presentation\Http\Controllers\AssetRelationshipController::class, 'graph']);

    // Asset Relationships (M2M mapping)
    Route::get('assets/{marketingAsset}/relationships', [Modules\Marketing\Assets\Presentation\Http\Controllers\AssetRelationshipController::class, 'index']);
    Route::post('assets/{marketingAsset}/relationships', [Modules\Marketing\Assets\Presentation\Http\Controllers\AssetRelationshipController::class, 'store']);
    Route::delete('relationships/{relationship}', [Modules\Marketing\Assets\Presentation\Http\Controllers\AssetRelationshipController::class, 'destroy']);
    Route::post('relationships/{relationship}/accept', [Modules\Marketing\Assets\Presentation\Http\Controllers\AssetRelationshipController::class, 'accept']);
    Route::post('relationships/{relationship}/reject', [Modules\Marketing\Assets\Presentation\Http\Controllers\AssetRelationshipController::class, 'reject']);
    Route::get('suggestions', [Modules\Marketing\Assets\Presentation\Http\Controllers\AssetRelationshipController::class, 'suggestions']);

    // Sync logs
    Route::get('sync-logs/{syncLog}', [Modules\Marketing\Synchronization\Presentation\Http\Controllers\SyncController::class, 'show']);

    // Mapping Profiles
    Route::get('mapping-profiles', [Modules\Marketing\MappingEngine\Presentation\Http\Controllers\MappingProfileController::class, 'index']);
    Route::post('mapping-profiles', [Modules\Marketing\MappingEngine\Presentation\Http\Controllers\MappingProfileController::class, 'store']);
    Route::get('mapping-profiles/{mappingProfile}', [Modules\Marketing\MappingEngine\Presentation\Http\Controllers\MappingProfileController::class, 'show']);
    Route::put('mapping-profiles/{mappingProfile}', [Modules\Marketing\MappingEngine\Presentation\Http\Controllers\MappingProfileController::class, 'update']);
    Route::delete('mapping-profiles/{mappingProfile}', [Modules\Marketing\MappingEngine\Presentation\Http\Controllers\MappingProfileController::class, 'destroy']);
    Route::post('mapping-profiles/{mappingProfile}/apply', [Modules\Marketing\MappingEngine\Presentation\Http\Controllers\MappingProfileController::class, 'apply']);

    // Marketing Initiatives (ERP Business Layer — never synced with Meta)
    Route::get('initiative-dashboard', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeDashboardController::class, 'index']);
    Route::get('initiatives', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeController::class, 'index']);
    Route::post('initiatives', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeController::class, 'store']);
    Route::get('initiatives/{initiative}', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeController::class, 'show']);
    Route::put('initiatives/{initiative}', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeController::class, 'update']);
    Route::post('initiatives/{initiative}/archive', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeController::class, 'archive']);
    Route::get('initiatives/{initiative}/kpis', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeDashboardController::class, 'kpis']);
    Route::get('initiatives/{initiative}/campaigns', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeCampaignController::class, 'index']);
    Route::post('initiatives/{initiative}/campaigns', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeCampaignController::class, 'assign']);
    Route::delete('initiatives/{initiative}/campaigns/{campaign}', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeCampaignController::class, 'remove']);

    // Initiative Templates
    Route::get('initiative-templates', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeTemplateController::class, 'index']);
    Route::post('initiative-templates', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeTemplateController::class, 'store']);
    Route::get('initiative-templates/{initiativeTemplate}', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeTemplateController::class, 'show']);
    Route::put('initiative-templates/{initiativeTemplate}', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeTemplateController::class, 'update']);
    Route::delete('initiative-templates/{initiativeTemplate}', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeTemplateController::class, 'destroy']);
    Route::post('initiative-templates/{initiativeTemplate}/create-initiative', [Modules\Marketing\Initiatives\Presentation\Http\Controllers\InitiativeTemplateController::class, 'createInitiative']);

    // Campaigns — trigger sync per connection
    Route::post('connections/{connection}/campaigns/sync', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignSyncController::class, 'triggerSync']);
    // Insights — async sync per connection (dispatches InsightsSyncJob)
    Route::post('connections/{connection}/insights/sync', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignInsightController::class, 'sync']);

    // Campaign Workspace (Phase 4)
    Route::get('campaigns', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignController::class, 'index']);
    Route::get('campaigns/dashboard', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignDashboardController::class, 'index']);

    // Campaign Ranking (Phase 7)
    Route::get('campaigns/ranking/campaigns', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignRankingController::class, 'topCampaigns']);
    Route::get('campaigns/ranking/ad-sets', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignRankingController::class, 'topAdSets']);
    Route::get('campaigns/ranking/ads', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignRankingController::class, 'topAds']);
    Route::get('campaigns/ranking/companies', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignRankingController::class, 'topCompanies']);
    Route::get('campaigns/ranking/brands', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignRankingController::class, 'topBrands']);
    Route::get('campaigns/ranking/channels', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignRankingController::class, 'topChannels']);
    Route::get('campaigns/ranking/owners', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignRankingController::class, 'topOwners']);

    // Campaign detail + sub-resources
    Route::get('campaigns/{campaign}', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignController::class, 'show']);
    Route::patch('campaigns/{campaign}/business-context', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignController::class, 'updateBusinessContext']);
    Route::post('campaigns/{campaign}/backfill', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignSyncController::class, 'backfill']);
    Route::get('campaigns/{campaign}/insights', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignInsightController::class, 'index']);
    Route::get('campaigns/{campaign}/insights/trend', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignInsightController::class, 'trend']);
    Route::get('campaigns/{campaign}/creatives', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignCreativeController::class, 'index']);
    Route::get('campaigns/{campaign}/creatives/{creative}', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignCreativeController::class, 'show']);
    Route::get('campaigns/{campaign}/ad-sets', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignAdSetController::class, 'index']);
    Route::get('campaigns/{campaign}/ad-sets/{adSet}', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignAdSetController::class, 'show']);
    Route::get('campaigns/{campaign}/ad-sets/{adSet}/ads', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignAdController::class, 'index']);
    Route::get('campaigns/{campaign}/ad-sets/{adSet}/ads/{ad}', [Modules\Marketing\Campaigns\Presentation\Http\Controllers\CampaignAdController::class, 'show']);
});

/*
|--------------------------------------------------------------------------
| Marketing Intelligence — Analytics, KPI Engine, Reports
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:marketing.workspace.manage'])->prefix('marketing/intelligence')->group(function (): void {
    // ─── Executive Dashboard ────────────────────────────────────────────────
    Route::get('dashboard', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\ExecutiveDashboardController::class, 'index']);

    // ─── Campaign Analytics ─────────────────────────────────────────────────
    Route::get('campaigns', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\CampaignAnalyticsController::class, 'index']);
    Route::get('campaigns/export', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\CampaignAnalyticsController::class, 'export']);
    Route::get('campaigns/{campaignId}/trend', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\CampaignAnalyticsController::class, 'trend']);

    // ─── Ad Analytics ───────────────────────────────────────────────────────
    Route::get('ads', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\AdAnalyticsController::class, 'index']);
    Route::get('ads/export', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\AdAnalyticsController::class, 'export']);

    // ─── Creative Analytics ─────────────────────────────────────────────────
    Route::get('creatives', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\CreativeAnalyticsController::class, 'index']);
    Route::get('creatives/export', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\CreativeAnalyticsController::class, 'export']);

    // ─── Performance Trends ─────────────────────────────────────────────────
    Route::get('trends', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\PerformanceTrendsController::class, 'index']);
    Route::get('trends/compare', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\PerformanceTrendsController::class, 'compare']);

    // ─── Budget Analysis ────────────────────────────────────────────────────
    Route::get('budget', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\BudgetAnalysisController::class, 'index']);

    // ─── Reports (streaming + history) ─────────────────────────────────────
    Route::get('reports/export/campaigns', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\MarketingReportController::class, 'exportCampaigns']);
    Route::get('reports/export/ads', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\MarketingReportController::class, 'exportAds']);
    Route::get('reports/export/creatives', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\MarketingReportController::class, 'exportCreatives']);
    Route::get('reports', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\MarketingReportController::class, 'index']);
    Route::get('reports/{report}', [Modules\Marketing\Intelligence\Presentation\Http\Controllers\MarketingReportController::class, 'show']);
});

/*
|--------------------------------------------------------------------------
| Campaign Studio — ECOS-Native Campaign Operations Platform
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:marketing.workspace.manage'])->prefix('marketing/studio')->group(function (): void {
    // ─── Studio KPIs & Dashboard ────────────────────────────────────────────────
    Route::get('kpis', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignStudioController::class, 'kpis']);
    Route::get('dashboard', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\StudioExecutiveDashboardController::class, 'index']);
    Route::get('dashboard/pending-approvals', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\StudioExecutiveDashboardController::class, 'pendingApprovals']);
    Route::get('dashboard/publishing-queue', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\StudioExecutiveDashboardController::class, 'publishingQueue']);

    // ─── Campaign Drafts (CRUD) ─────────────────────────────────────────────────
    Route::get('drafts', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignStudioController::class, 'index']);
    Route::post('drafts', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignStudioController::class, 'store']);
    Route::get('drafts/{draft}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignStudioController::class, 'show']);
    Route::patch('drafts/{draft}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignStudioController::class, 'update']);
    Route::delete('drafts/{draft}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignStudioController::class, 'destroy']);
    Route::post('drafts/{draft}/duplicate', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignStudioController::class, 'duplicate']);

    // ─── Audience Builder ────────────────────────────────────────────────────────
    Route::get('drafts/{draft}/audience', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignAudienceController::class, 'show']);
    Route::put('drafts/{draft}/audience', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignAudienceController::class, 'update']);

    // ─── Creative Builder ────────────────────────────────────────────────────────
    Route::get('drafts/{draft}/creatives', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignCreativeController::class, 'index']);
    Route::post('drafts/{draft}/creatives', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignCreativeController::class, 'store']);
    Route::patch('drafts/{draft}/creatives/{creative}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignCreativeController::class, 'update']);
    Route::delete('drafts/{draft}/creatives/{creative}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignCreativeController::class, 'destroy']);

    // ─── Placement Builder ───────────────────────────────────────────────────────
    Route::get('drafts/{draft}/placements', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignPlacementController::class, 'show']);
    Route::put('drafts/{draft}/placements', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignPlacementController::class, 'update']);

    // ─── Version History ─────────────────────────────────────────────────────────
    Route::get('drafts/{draft}/versions', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignVersionController::class, 'index']);
    Route::get('drafts/{draft}/versions/{versionA}/compare/{versionB}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignVersionController::class, 'compare']);
    Route::post('drafts/{draft}/versions/{version}/restore', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignVersionController::class, 'restore']);

    // ─── Approval Workflow ───────────────────────────────────────────────────────
    Route::post('drafts/{draft}/submit-for-approval', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignApprovalController::class, 'submit']);
    Route::get('drafts/{draft}/approval', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignApprovalController::class, 'show']);
    Route::get('approvals/pending', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignApprovalController::class, 'pending']);
    Route::post('approvals/{approval}/decide', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignApprovalController::class, 'decide']);
    Route::delete('approvals/{approval}/cancel', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignApprovalController::class, 'cancel']);

    // ─── Publishing & Lifecycle ──────────────────────────────────────────────────
    Route::post('drafts/{draft}/publish', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\PublishingJobController::class, 'publish']);
    Route::post('drafts/{draft}/pause', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\PublishingJobController::class, 'pause']);
    Route::post('drafts/{draft}/resume', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\PublishingJobController::class, 'resume']);
    Route::post('drafts/{draft}/archive', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\PublishingJobController::class, 'archive']);
    Route::get('jobs', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\PublishingJobController::class, 'index']);
    Route::get('jobs/stats', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\PublishingJobController::class, 'stats']);
    Route::post('jobs/{job}/retry', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\PublishingJobController::class, 'retry']);

    // ─── Scheduling ──────────────────────────────────────────────────────────────
    Route::get('drafts/{draft}/schedule', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignScheduleController::class, 'pending']);
    Route::post('drafts/{draft}/schedule', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignScheduleController::class, 'store']);
    Route::delete('schedule-tasks/{task}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignScheduleController::class, 'destroy']);

    // ─── Validation Engine ───────────────────────────────────────────────────────
    Route::post('drafts/{draft}/validate', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\ValidationController::class, 'validate']);
    Route::get('drafts/{draft}/validation-results', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\ValidationController::class, 'results']);

    // ─── Commerce Integration ────────────────────────────────────────────────────
    Route::get('drafts/{draft}/products', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CommerceIntegrationController::class, 'index']);
    Route::post('drafts/{draft}/products', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CommerceIntegrationController::class, 'store']);
    Route::post('drafts/{draft}/products/refresh', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CommerceIntegrationController::class, 'refresh']);
    Route::delete('drafts/{draft}/products/{product}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CommerceIntegrationController::class, 'destroy']);

    // ─── Bulk Operations ─────────────────────────────────────────────────────────
    Route::post('bulk', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\BulkOperationController::class, 'execute']);
    Route::get('bulk/{job}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\BulkOperationController::class, 'status']);

    // ─── Templates ───────────────────────────────────────────────────────────────
    Route::get('templates', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignTemplateController::class, 'index']);
    Route::post('templates', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignTemplateController::class, 'store']);
    Route::get('templates/{template}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignTemplateController::class, 'show']);
    Route::put('templates/{template}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignTemplateController::class, 'update']);
    Route::delete('templates/{template}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignTemplateController::class, 'destroy']);
    Route::post('templates/{template}/create-campaign', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\CampaignTemplateController::class, 'createCampaign']);

    // ─── Governance Policies ─────────────────────────────────────────────────────
    Route::get('governance', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\GovernancePolicyController::class, 'index']);
    Route::post('governance', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\GovernancePolicyController::class, 'store']);
    Route::get('governance/{policy}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\GovernancePolicyController::class, 'show']);
    Route::put('governance/{policy}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\GovernancePolicyController::class, 'update']);
    Route::delete('governance/{policy}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\GovernancePolicyController::class, 'destroy']);

    // ─── Approval Workflow Templates ──────────────────────────────────────────────
    Route::get('workflows', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\ApprovalWorkflowController::class, 'index']);
    Route::post('workflows', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\ApprovalWorkflowController::class, 'store']);
    Route::get('workflows/{workflow}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\ApprovalWorkflowController::class, 'show']);
    Route::put('workflows/{workflow}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\ApprovalWorkflowController::class, 'update']);
    Route::delete('workflows/{workflow}', [Modules\Marketing\CampaignStudio\Presentation\Http\Controllers\ApprovalWorkflowController::class, 'destroy']);
});

/*
|--------------------------------------------------------------------------
| Business Attribution Engine (BAE) — Core Platform
| NEVER depends on Marketing — all modules depend on BAE.
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:bae.attribution.manage'])->prefix('bae')->group(function (): void {
    // ─── Event Bus ────────────────────────────────────────────────────────────
    Route::get('events/timeline', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessEventController::class, 'timeline']);
    Route::get('events/for-entity', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessEventController::class, 'forEntity']);
    Route::get('events/for-dna/{dnaId}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessEventController::class, 'forDna']);
    Route::get('events/{businessEvent}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessEventController::class, 'show']);
    Route::post('events', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessEventController::class, 'publish']);

    // ─── Business DNA ─────────────────────────────────────────────────────────
    Route::get('dna', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessDnaController::class, 'index']);
    Route::post('dna', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessDnaController::class, 'store']);
    Route::get('dna/for-entity', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessDnaController::class, 'forEntity']);
    Route::get('dna/{businessDna}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessDnaController::class, 'show']);
    Route::patch('dna/{businessDna}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessDnaController::class, 'update']);

    // ─── Journey Explorer ─────────────────────────────────────────────────────
    Route::get('journey/search', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\JourneyExplorerController::class, 'search']);
    Route::get('journey/{businessDna}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\JourneyExplorerController::class, 'journey']);
    Route::post('journey/step', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\JourneyExplorerController::class, 'recordStep']);

    // ─── Attribution Engine ───────────────────────────────────────────────────
    Route::get('attribution/{businessDna}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\AttributionController::class, 'calculate']);
    Route::get('attribution/configs', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\AttributionController::class, 'configs']);
    Route::post('attribution/configs', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\AttributionController::class, 'saveConfig']);

    // ─── Business Metrics ─────────────────────────────────────────────────────
    Route::get('metrics/averages', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessMetricsController::class, 'aggregateAverages']);
    Route::get('metrics/{businessDna}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\BusinessMetricsController::class, 'forDna']);

    // ─── Graph Layer ──────────────────────────────────────────────────────────
    Route::post('graph/nodes', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\GraphController::class, 'upsertNode']);
    Route::post('graph/relationships', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\GraphController::class, 'createRelationship']);
    Route::get('graph/nodes/{entityNode}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\GraphController::class, 'node']);
    Route::get('graph/nodes/{entityNode}/subgraph', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\GraphController::class, 'subgraph']);

    // ─── Event Replay ─────────────────────────────────────────────────────────
    Route::post('replay', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\ReplayController::class, 'replay']);

    // ─── PATCH-CORE-001: Enhanced Replay Engine ───────────────────────────────
    Route::get('replay/entity/{entityType}/{entityId}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\ReplayController::class, 'replayEntity']);
    Route::post('replay/batch', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\ReplayController::class, 'batch']);
    Route::get('replay/module/{module}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\ReplayController::class, 'replayModule']);
    Route::get('replay/audit', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\ReplayController::class, 'auditLogs']);
    Route::get('replay/audit/stats', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\ReplayController::class, 'auditStats']);

    // ─── Time Machine ─────────────────────────────────────────────────────────
    Route::get('time-machine/context', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\TimeMachineController::class, 'context']);
    Route::get('time-machine/{entityType}/{entityId}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\TimeMachineController::class, 'resolveAt']);
    Route::get('time-machine/{entityType}/{entityId}/view', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\TimeMachineController::class, 'historicalView']);
    Route::get('time-machine/{entityType}/{entityId}/diff', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\TimeMachineController::class, 'diff']);

    // ─── Root Cause Traversal ─────────────────────────────────────────────────
    Route::get('cause-effect/path', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\RootCauseController::class, 'criticalPath']);
    Route::get('cause-effect/{eventId}', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\RootCauseController::class, 'traverse']);
    Route::get('cause-effect/{eventId}/root-causes', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\RootCauseController::class, 'rootCauses']);
    Route::get('cause-effect/{eventId}/effects', [Modules\Core\BusinessAttribution\Presentation\Http\Controllers\RootCauseController::class, 'effects']);
});

/*
|--------------------------------------------------------------------------
| Customer Engagement Platform (CEP) — Unified Customer Communication
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:cep.inbox.manage'])->prefix('cep')->group(function (): void {
    // ─── Dashboard ────────────────────────────────────────────────────────────
    Route::get('dashboard/kpis', [Modules\CustomerEngagement\Presentation\Http\Controllers\DashboardController::class, 'kpis']);
    Route::get('dashboard/agents', [Modules\CustomerEngagement\Presentation\Http\Controllers\DashboardController::class, 'agentPerformance']);
    Route::get('dashboard/providers', [Modules\CustomerEngagement\Presentation\Http\Controllers\DashboardController::class, 'providerDistribution']);
    Route::get('dashboard/statuses', [Modules\CustomerEngagement\Presentation\Http\Controllers\DashboardController::class, 'statusDistribution']);
    Route::get('dashboard/unread-count', [Modules\CustomerEngagement\Presentation\Http\Controllers\DashboardController::class, 'unreadCount']);

    // ─── Conversations ────────────────────────────────────────────────────────
    Route::get('conversations', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationController::class, 'index']);
    Route::post('conversations', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationController::class, 'store']);
    Route::get('conversations/{conversation}', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationController::class, 'show']);
    Route::patch('conversations/{conversation}', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationController::class, 'update']);
    Route::post('conversations/{conversation}/close', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationController::class, 'close']);
    Route::post('conversations/{conversation}/resolve', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationController::class, 'resolve']);
    Route::post('conversations/{conversation}/reopen', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationController::class, 'reopen']);

    // ─── Messages ─────────────────────────────────────────────────────────────
    Route::get('conversations/{conversation}/messages', [Modules\CustomerEngagement\Presentation\Http\Controllers\MessageController::class, 'thread']);
    Route::post('conversations/{conversation}/messages', [Modules\CustomerEngagement\Presentation\Http\Controllers\MessageController::class, 'send']);
    Route::post('conversations/{conversation}/messages/read', [Modules\CustomerEngagement\Presentation\Http\Controllers\MessageController::class, 'markRead']);
    Route::post('messages/ingest', [Modules\CustomerEngagement\Presentation\Http\Controllers\MessageController::class, 'ingest']);

    // ─── Leads ───────────────────────────────────────────────────────────────
    Route::get('leads', [Modules\CustomerEngagement\Presentation\Http\Controllers\LeadController::class, 'index']);
    Route::get('leads/{lead}', [Modules\CustomerEngagement\Presentation\Http\Controllers\LeadController::class, 'show']);
    Route::patch('leads/{lead}', [Modules\CustomerEngagement\Presentation\Http\Controllers\LeadController::class, 'update']);
    Route::post('leads/{lead}/qualify', [Modules\CustomerEngagement\Presentation\Http\Controllers\LeadController::class, 'qualify']);
    Route::post('leads/{lead}/disqualify', [Modules\CustomerEngagement\Presentation\Http\Controllers\LeadController::class, 'disqualify']);
    Route::post('leads/{lead}/convert', [Modules\CustomerEngagement\Presentation\Http\Controllers\LeadController::class, 'convert']);
    Route::post('conversations/{conversation}/leads', [Modules\CustomerEngagement\Presentation\Http\Controllers\LeadController::class, 'createFromConversation']);

    // ─── Notes ───────────────────────────────────────────────────────────────
    Route::get('conversations/{conversation}/notes', [Modules\CustomerEngagement\Presentation\Http\Controllers\NoteController::class, 'index']);
    Route::post('conversations/{conversation}/notes', [Modules\CustomerEngagement\Presentation\Http\Controllers\NoteController::class, 'store']);
    Route::delete('conversations/{conversation}/notes/{note}', [Modules\CustomerEngagement\Presentation\Http\Controllers\NoteController::class, 'destroy']);

    // ─── Assignment ──────────────────────────────────────────────────────────
    Route::get('conversations/{conversation}/assignments', [Modules\CustomerEngagement\Presentation\Http\Controllers\AssignmentController::class, 'history']);
    Route::post('conversations/{conversation}/assign', [Modules\CustomerEngagement\Presentation\Http\Controllers\AssignmentController::class, 'assign']);
    Route::post('conversations/{conversation}/unassign', [Modules\CustomerEngagement\Presentation\Http\Controllers\AssignmentController::class, 'unassign']);
    Route::post('conversations/{conversation}/round-robin', [Modules\CustomerEngagement\Presentation\Http\Controllers\AssignmentController::class, 'roundRobin']);

    // ─── SLA ─────────────────────────────────────────────────────────────────
    Route::get('sla/policies', [Modules\CustomerEngagement\Presentation\Http\Controllers\SlaController::class, 'policies']);
    Route::post('sla/policies', [Modules\CustomerEngagement\Presentation\Http\Controllers\SlaController::class, 'storePolicy']);
    Route::patch('sla/policies/{slaPolicy}', [Modules\CustomerEngagement\Presentation\Http\Controllers\SlaController::class, 'updatePolicy']);
    Route::get('conversations/{conversation}/sla', [Modules\CustomerEngagement\Presentation\Http\Controllers\SlaController::class, 'violations']);
    Route::get('sla/compliance', [Modules\CustomerEngagement\Presentation\Http\Controllers\SlaController::class, 'complianceStats']);
    Route::post('sla/check-breaches', [Modules\CustomerEngagement\Presentation\Http\Controllers\SlaController::class, 'checkBreaches']);
});

/*
|--------------------------------------------------------------------------
| Marketing Automation Platform
| Prefix: marketing/automation
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:marketing.workspace.manage'])->prefix('marketing/automation')->group(function (): void {
    // ─── Dashboard ────────────────────────────────────────────────────────────
    Route::get('dashboard', [Modules\Marketing\Automation\Presentation\Http\Controllers\AutomationDashboardController::class, 'index']);

    // ─── Workflows ────────────────────────────────────────────────────────────
    Route::get('kpis', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowController::class, 'kpis']);
    Route::get('workflows', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowController::class, 'index']);
    Route::post('workflows', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowController::class, 'store']);
    Route::get('workflows/{workflow}', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowController::class, 'show']);
    Route::patch('workflows/{workflow}', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowController::class, 'update']);
    Route::delete('workflows/{workflow}', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowController::class, 'destroy']);
    Route::post('workflows/{workflow}/duplicate', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowController::class, 'duplicate']);
    Route::post('workflows/{workflow}/activate', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowController::class, 'activate']);
    Route::post('workflows/{workflow}/pause', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowController::class, 'pause']);
    Route::post('workflows/{workflow}/archive', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowController::class, 'archive']);

    // ─── Canvas (nodes_graph) ─────────────────────────────────────────────────
    Route::put('workflows/{workflow}/canvas', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowNodeController::class, 'update']);

    // ─── Versions ─────────────────────────────────────────────────────────────
    Route::get('workflows/{workflow}/versions', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowVersionController::class, 'index']);
    Route::get('workflows/{workflow}/versions/compare/{versionA}/{versionB}', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowVersionController::class, 'compare']);
    Route::post('workflows/{workflow}/versions/{version}/restore', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowVersionController::class, 'restore']);

    // ─── Executions ───────────────────────────────────────────────────────────
    Route::get('workflows/{workflow}/executions', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowExecutionController::class, 'index']);
    Route::get('workflows/{workflow}/executions/stats', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowExecutionController::class, 'stats']);
    Route::get('workflows/{workflow}/executions/{execution}', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowExecutionController::class, 'show']);
    Route::post('workflows/{workflow}/executions/{execution}/cancel', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowExecutionController::class, 'cancel']);
    Route::post('workflows/{workflow}/executions/{execution}/retry', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowExecutionController::class, 'retry']);

    // ─── Manual Trigger ───────────────────────────────────────────────────────
    Route::post('workflows/{workflow}/trigger', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowTriggerController::class, 'trigger']);

    // ─── Simulation ───────────────────────────────────────────────────────────
    Route::post('workflows/{workflow}/simulate', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowSimulatorController::class, 'simulate']);

    // ─── Templates ────────────────────────────────────────────────────────────
    Route::get('templates', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowTemplateController::class, 'index']);
    Route::post('templates', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowTemplateController::class, 'store']);
    Route::get('templates/{template}', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowTemplateController::class, 'show']);
    Route::put('templates/{template}', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowTemplateController::class, 'update']);
    Route::delete('templates/{template}', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowTemplateController::class, 'destroy']);
    Route::post('templates/{template}/create-workflow', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowTemplateController::class, 'createWorkflow']);

    // ─── Audience Segments ────────────────────────────────────────────────────
    Route::get('segments', [Modules\Marketing\Automation\Presentation\Http\Controllers\AudienceSegmentController::class, 'index']);
    Route::post('segments', [Modules\Marketing\Automation\Presentation\Http\Controllers\AudienceSegmentController::class, 'store']);
    Route::get('segments/{segment}', [Modules\Marketing\Automation\Presentation\Http\Controllers\AudienceSegmentController::class, 'show']);
    Route::put('segments/{segment}', [Modules\Marketing\Automation\Presentation\Http\Controllers\AudienceSegmentController::class, 'update']);
    Route::delete('segments/{segment}', [Modules\Marketing\Automation\Presentation\Http\Controllers\AudienceSegmentController::class, 'destroy']);
    Route::post('segments/{segment}/recalculate', [Modules\Marketing\Automation\Presentation\Http\Controllers\AudienceSegmentController::class, 'recalculate']);
    Route::get('segments/{segment}/memberships', [Modules\Marketing\Automation\Presentation\Http\Controllers\AudienceSegmentController::class, 'memberships']);

    // ─── Governance Policies ──────────────────────────────────────────────────
    Route::get('governance', [Modules\Marketing\Automation\Presentation\Http\Controllers\AutomationGovernanceController::class, 'index']);
    Route::post('governance', [Modules\Marketing\Automation\Presentation\Http\Controllers\AutomationGovernanceController::class, 'store']);
    Route::get('governance/{policy}', [Modules\Marketing\Automation\Presentation\Http\Controllers\AutomationGovernanceController::class, 'show']);
    Route::put('governance/{policy}', [Modules\Marketing\Automation\Presentation\Http\Controllers\AutomationGovernanceController::class, 'update']);
    Route::delete('governance/{policy}', [Modules\Marketing\Automation\Presentation\Http\Controllers\AutomationGovernanceController::class, 'destroy']);
});

// Public webhook endpoint (no auth — rate-limited)
Route::middleware(['throttle:30,1'])->prefix('marketing/automation')->group(function (): void {
    Route::post('webhook/{workflow}', [Modules\Marketing\Automation\Presentation\Http\Controllers\WorkflowTriggerController::class, 'webhook']);
});

/*
|--------------------------------------------------------------------------
| Omnichannel Commerce (MKT-007) — WhatsApp / Messenger / Instagram Direct
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:omnichannel.inbox.manage'])->prefix('omnichannel')->group(function (): void {
    // ─── Channel Providers ────────────────────────────────────────────────────
    Route::get('providers', [Modules\CustomerEngagement\Presentation\Http\Controllers\ChannelProviderController::class, 'index']);
    Route::post('providers', [Modules\CustomerEngagement\Presentation\Http\Controllers\ChannelProviderController::class, 'store']);
    Route::get('providers/{channelProvider}', [Modules\CustomerEngagement\Presentation\Http\Controllers\ChannelProviderController::class, 'show']);
    Route::patch('providers/{channelProvider}', [Modules\CustomerEngagement\Presentation\Http\Controllers\ChannelProviderController::class, 'update']);
    Route::delete('providers/{channelProvider}', [Modules\CustomerEngagement\Presentation\Http\Controllers\ChannelProviderController::class, 'destroy']);
    Route::post('providers/{channelProvider}/activate', [Modules\CustomerEngagement\Presentation\Http\Controllers\ChannelProviderController::class, 'activate']);

    // ─── Outbound Messages ────────────────────────────────────────────────────
    Route::post('conversations/{conversation}/send', [Modules\CustomerEngagement\Presentation\Http\Controllers\OutboundMessageController::class, 'send']);
    Route::post('conversations/{conversation}/macros/{macro}', [Modules\CustomerEngagement\Presentation\Http\Controllers\OutboundMessageController::class, 'applyMacro']);

    // ─── Macros ───────────────────────────────────────────────────────────────
    Route::get('macros', [Modules\CustomerEngagement\Presentation\Http\Controllers\MacroController::class, 'index']);
    Route::post('macros', [Modules\CustomerEngagement\Presentation\Http\Controllers\MacroController::class, 'store']);
    Route::get('macros/{macro}', [Modules\CustomerEngagement\Presentation\Http\Controllers\MacroController::class, 'show']);
    Route::patch('macros/{macro}', [Modules\CustomerEngagement\Presentation\Http\Controllers\MacroController::class, 'update']);
    Route::delete('macros/{macro}', [Modules\CustomerEngagement\Presentation\Http\Controllers\MacroController::class, 'destroy']);

    // ─── Routing Rules ────────────────────────────────────────────────────────
    Route::get('routing-rules', [Modules\CustomerEngagement\Presentation\Http\Controllers\RoutingController::class, 'index']);
    Route::post('routing-rules', [Modules\CustomerEngagement\Presentation\Http\Controllers\RoutingController::class, 'store']);
    Route::get('routing-rules/{rule}', [Modules\CustomerEngagement\Presentation\Http\Controllers\RoutingController::class, 'show']);
    Route::patch('routing-rules/{rule}', [Modules\CustomerEngagement\Presentation\Http\Controllers\RoutingController::class, 'update']);
    Route::delete('routing-rules/{rule}', [Modules\CustomerEngagement\Presentation\Http\Controllers\RoutingController::class, 'destroy']);
    Route::post('conversations/{conversation}/auto-route', [Modules\CustomerEngagement\Presentation\Http\Controllers\RoutingController::class, 'applyToConversation']);

    // ─── Attribution ──────────────────────────────────────────────────────────
    Route::get('conversations/{conversation}/attribution', [Modules\CustomerEngagement\Presentation\Http\Controllers\AttributionController::class, 'show']);
    Route::post('conversations/{conversation}/attribution', [Modules\CustomerEngagement\Presentation\Http\Controllers\AttributionController::class, 'capture']);

    // ─── Commerce (Order Wizard, Linked Entities) ─────────────────────────────
    Route::get('conversations/{conversation}/entities', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationCommerceController::class, 'linkedEntities']);
    Route::post('conversations/{conversation}/prepare-order', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationCommerceController::class, 'prepareOrder']);
    Route::post('conversations/{conversation}/link-entity', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationCommerceController::class, 'linkOrder']);
    Route::get('commerce/kpis', [Modules\CustomerEngagement\Presentation\Http\Controllers\ConversationCommerceController::class, 'kpis']);

    // ─── Product Selector ─────────────────────────────────────────────────────
    Route::get('products/search', [Modules\CustomerEngagement\Presentation\Http\Controllers\ProductSelectorController::class, 'search']);
    Route::get('products/{productId}', [Modules\CustomerEngagement\Presentation\Http\Controllers\ProductSelectorController::class, 'show']);
});

// ─── Omnichannel Webhooks (PUBLIC — provider-to-ECOS, throttled) ─────────────
Route::middleware(['throttle:100,1'])->prefix('omnichannel/webhook')->group(function (): void {
    // GET = Meta hub.challenge verification; POST = inbound messages + status updates
    Route::get('{channelProviderId}', [Modules\CustomerEngagement\Presentation\Http\Controllers\WebhookController::class, 'verify']);
    Route::post('{channelProviderId}', [Modules\CustomerEngagement\Presentation\Http\Controllers\WebhookController::class, 'receive']);
});

/*
|--------------------------------------------------------------------------
| Webhooks — WooCommerce (public, no auth)
|--------------------------------------------------------------------------
*/
Route::middleware(['throttle:60,1'])->group(function (): void {
    Route::post('webhooks/woocommerce/{channel}/orders', [WooCommerceWebhookController::class, 'handleOrder']);
    Route::post('webhooks/woocommerce/{channel}/products', [WooCommerceWebhookController::class, 'handleProduct']);
    Route::post('webhooks/woocommerce/{channel}/customers', [WooCommerceWebhookController::class, 'handleCustomer']);
});

/*
|--------------------------------------------------------------------------
| Logistics OS — Egypt Geography (protected)
|--------------------------------------------------------------------------
*/
// ── Distribution OS — Master Data ────────────────────────────────────────────
Route::middleware('auth:sanctum')->prefix('logistics/distribution')->group(function (): void {
    Route::get('/stats', [DistributionZoneController::class, 'stats']);
    Route::get('/next-code', [DistributionZoneController::class, 'nextCode']);
    Route::get('/areas', [DistributionZoneController::class, 'areas']);
    Route::get('/zones', [DistributionZoneController::class, 'index']);
    Route::post('/zones', [DistributionZoneController::class, 'store'])->middleware('permission:logistics.distribution.create');
    Route::get('/zones/{id}', [DistributionZoneController::class, 'show']);
    Route::put('/zones/{id}', [DistributionZoneController::class, 'update'])->middleware('permission:logistics.distribution.update');
    Route::delete('/zones/{id}', [DistributionZoneController::class, 'destroy'])->middleware('permission:logistics.distribution.delete');
    Route::patch('/zones/{id}/status', [DistributionZoneController::class, 'toggleStatus'])->middleware('permission:logistics.distribution.update');
});

// ── Logistics OS — Distribution: Trips / Delivery / Settlement (TASK-LOG-004B) ──
// Trip is the aggregate root. Carriers, drivers and vehicles are consumed by
// reference from LOG-001/002/003 — this module owns none of them.
Route::middleware('auth:sanctum')->prefix('logistics/distribution')->group(function (): void {
    // Reference data
    Route::get('/trips/options', [LogisticsTripController::class, 'options']);
    Route::get('/trips/stats', [LogisticsTripController::class, 'stats']);
    Route::get('/trips/next-number', [LogisticsTripController::class, 'nextNumber']);
    Route::get('/delivery/options', [LogisticsDeliveryController::class, 'options']);
    Route::get('/settlement/options', [LogisticsSettlementController::class, 'options']);

    // Trips
    Route::get('/trips', [LogisticsTripController::class, 'index']);
    Route::post('/trips', [LogisticsTripController::class, 'store'])->middleware('permission:logistics.distribution.create');
    Route::get('/trips/{id}', [LogisticsTripController::class, 'show']);
    Route::put('/trips/{id}', [LogisticsTripController::class, 'update'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{id}/status', [LogisticsTripController::class, 'setStatus'])->middleware('permission:logistics.distribution.update');
    Route::get('/trips/{id}/dispatch-readiness', [LogisticsTripController::class, 'dispatchReadiness']);
    Route::patch('/trips/{id}/driver-acceptance', [LogisticsTripController::class, 'recordDriverAcceptance'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{id}/assignment', [LogisticsTripController::class, 'assignDriverVehicle'])->middleware('permission:logistics.distribution.update');

    // Trip orders
    Route::get('/trips/{id}/orders', [LogisticsTripController::class, 'orders']);
    Route::post('/trips/{id}/orders', [LogisticsTripController::class, 'addOrder'])->middleware('permission:logistics.distribution.update');
    Route::delete('/trips/{id}/orders/{orderId}', [LogisticsTripController::class, 'removeOrder'])->middleware('permission:logistics.distribution.update');
    Route::post('/trips/{id}/orders/move', [LogisticsTripController::class, 'moveOrder'])->middleware('permission:logistics.distribution.update');

    // Custody
    Route::get('/trips/{id}/custody', [LogisticsTripController::class, 'custody']);
    Route::post('/trips/{id}/custody', [LogisticsTripController::class, 'addCustody'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{id}/custody/{custodyId}/confirm', [LogisticsTripController::class, 'confirmCustody'])->middleware('permission:logistics.distribution.update');
    Route::delete('/trips/{id}/custody/{custodyId}', [LogisticsTripController::class, 'removeCustody'])->middleware('permission:logistics.distribution.update');

    // Delivery execution
    Route::get('/trips/{tripId}/stops', [LogisticsDeliveryController::class, 'stops']);
    Route::post('/trips/{tripId}/stops/generate', [LogisticsDeliveryController::class, 'generateStops'])->middleware('permission:logistics.distribution.update');
    Route::get('/trips/{tripId}/stops/{stopId}', [LogisticsDeliveryController::class, 'showStop']);
    Route::patch('/trips/{tripId}/stops/{stopId}/start', [LogisticsDeliveryController::class, 'startStop'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{tripId}/stops/{stopId}/complete', [LogisticsDeliveryController::class, 'completeStop'])->middleware('permission:logistics.distribution.update');
    Route::post('/trips/{tripId}/stops/{stopId}/actions', [LogisticsDeliveryController::class, 'recordAction'])->middleware('permission:logistics.distribution.update');
    Route::post('/trips/{tripId}/stops/{stopId}/proof', [LogisticsDeliveryController::class, 'captureProof'])->middleware('permission:logistics.distribution.update');

    // Exceptions
    Route::get('/trips/{tripId}/exceptions', [LogisticsDeliveryController::class, 'exceptions']);
    Route::post('/trips/{tripId}/exceptions', [LogisticsDeliveryController::class, 'raiseException'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{tripId}/exceptions/{exceptionId}/resolve', [LogisticsDeliveryController::class, 'resolveException'])->middleware('permission:logistics.distribution.update');

    // Returns (product + custody, unified)
    Route::get('/trips/{tripId}/returns', [LogisticsDeliveryController::class, 'returns']);
    Route::post('/trips/{tripId}/returns', [LogisticsDeliveryController::class, 'recordReturn'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{tripId}/returns/{returnId}/confirm', [LogisticsDeliveryController::class, 'confirmReturn'])->middleware('permission:logistics.distribution.update');

    // Settlement
    Route::get('/trips/{tripId}/payments', [LogisticsSettlementController::class, 'payments']);
    Route::post('/trips/{tripId}/stops/{stopId}/payments', [LogisticsSettlementController::class, 'recordPayment'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{tripId}/payments/{paymentId}/verify', [LogisticsSettlementController::class, 'verifyPayment'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{tripId}/payments/{paymentId}/reject', [LogisticsSettlementController::class, 'rejectPayment'])->middleware('permission:logistics.distribution.update');
    Route::get('/trips/{tripId}/settlement', [LogisticsSettlementController::class, 'show']);
    Route::post('/trips/{tripId}/settlement', [LogisticsSettlementController::class, 'open'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{tripId}/settlement/submit-cash', [LogisticsSettlementController::class, 'submitCash'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{tripId}/settlement/reconcile', [LogisticsSettlementController::class, 'reconcile'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{tripId}/settlement/dispute', [LogisticsSettlementController::class, 'dispute'])->middleware('permission:logistics.distribution.update');
    Route::patch('/trips/{tripId}/settlement/finalize', [LogisticsSettlementController::class, 'finalize'])->middleware('permission:logistics.distribution.update');
    Route::get('/trips/{tripId}/financial-summary', [LogisticsSettlementController::class, 'summary']);
});

// ── Logistics OS — Delivery & Tracking (TASK-LOG-005) ─────────────────────────
// Delivery is the aggregate root for one order's journey to the customer,
// spanning every attempt across every trip. Distribution's DeliveryStop is
// consumed read-only; nothing here writes to a distribution_* table.
//
// COD: these routes report collection and publish events only. Trip cash
// balances and settlement stay with Distribution — the Single Cash Authority.
Route::middleware('auth:sanctum')->prefix('logistics/delivery')->group(function (): void {
    // Reference data + analytics
    Route::get('/options', [DeliveryOsController::class, 'options'])
        ->middleware('permission:delivery.view');
    Route::get('/stats', [DeliveryOsController::class, 'stats'])
        ->middleware('permission:delivery.analytics.view');

    // Deliveries
    Route::middleware('permission:delivery.view')->group(function (): void {
        Route::get('/', [DeliveryOsController::class, 'index']);
        Route::get('/{id}', [DeliveryOsController::class, 'show']);
        Route::get('/{id}/retry-eligibility', [DeliveryOsController::class, 'retryEligibility']);
        Route::get('/{id}/timeline', [DeliveryOsController::class, 'timeline']);
        Route::get('/{id}/public-timeline', [DeliveryOsController::class, 'publicTimeline']);
        Route::get('/{deliveryId}/attempts', [DeliveryAttemptController::class, 'index']);
        Route::get('/{deliveryId}/attempts/{attemptId}', [DeliveryAttemptController::class, 'show']);
        Route::get('/{deliveryId}/attempts/{attemptId}/pod', [DeliveryPodController::class, 'show']);
        Route::get('/{deliveryId}/returns', [DeliveryOsReturnController::class, 'index']);
        Route::get('/{deliveryId}/returns/{returnId}', [DeliveryOsReturnController::class, 'show']);
        Route::get('/{deliveryId}/cod', [DeliveryCodController::class, 'show']);
    });

    // Lifecycle
    Route::middleware('permission:delivery.execute')->group(function (): void {
        Route::post('/', [DeliveryOsController::class, 'store']);
        Route::patch('/{id}/status', [DeliveryOsController::class, 'setStatus']);
        Route::patch('/{id}/escalate', [DeliveryOsController::class, 'escalate']);
        Route::post('/{deliveryId}/attempts', [DeliveryAttemptController::class, 'store']);
        Route::patch('/{deliveryId}/attempts/{attemptId}/advance', [DeliveryAttemptController::class, 'advance']);
        Route::patch('/{deliveryId}/attempts/{attemptId}/succeed', [DeliveryAttemptController::class, 'succeed']);
        Route::patch('/{deliveryId}/attempts/{attemptId}/fail', [DeliveryAttemptController::class, 'fail']);
        Route::patch('/{deliveryId}/attempts/{attemptId}/abort', [DeliveryAttemptController::class, 'abort']);
    });

    // Retry — separate permission from execution: rescheduling a failed
    // delivery is a supervisor decision, not a driver action.
    Route::middleware('permission:delivery.retry')->group(function (): void {
        Route::post('/{id}/retry', [DeliveryOsController::class, 'retry']);
        Route::patch('/{id}/address-corrected', [DeliveryOsController::class, 'markAddressCorrected']);
    });

    Route::patch('/{id}/cancel', [DeliveryOsController::class, 'cancel'])
        ->middleware('permission:delivery.cancel');

    // Proof of delivery — capture and validate are deliberately separate
    // permissions so evidence is not self-certified.
    Route::middleware('permission:delivery.pod.capture')->group(function (): void {
        Route::post('/{deliveryId}/attempts/{attemptId}/pod', [DeliveryPodController::class, 'capture']);
        Route::post('/{deliveryId}/attempts/{attemptId}/pod/artifacts', [DeliveryPodController::class, 'addArtifact']);
    });
    Route::middleware('permission:delivery.pod.validate')->group(function (): void {
        Route::patch('/{deliveryId}/attempts/{attemptId}/pod/validate', [DeliveryPodController::class, 'validatePod']);
        Route::patch('/{deliveryId}/attempts/{attemptId}/pod/reject', [DeliveryPodController::class, 'reject']);
    });

    // Returns
    Route::middleware('permission:delivery.return.manage')->group(function (): void {
        Route::post('/{deliveryId}/returns', [DeliveryOsReturnController::class, 'store']);
        Route::patch('/{deliveryId}/returns/{returnId}/in-transit', [DeliveryOsReturnController::class, 'markInTransit']);
        Route::patch('/{deliveryId}/returns/{returnId}/receive', [DeliveryOsReturnController::class, 'receive']);
        Route::patch('/{deliveryId}/returns/{returnId}/verify', [DeliveryOsReturnController::class, 'verify']);
        Route::patch('/{deliveryId}/returns/{returnId}/discrepancy', [DeliveryOsReturnController::class, 'flagDiscrepancy']);
    });

    // COD — completion reporting only, never settlement.
    Route::middleware('permission:delivery.cod.collect')->group(function (): void {
        Route::post('/{deliveryId}/cod', [DeliveryCodController::class, 'open']);
        Route::patch('/{deliveryId}/cod/collect', [DeliveryCodController::class, 'collect']);
    });
    Route::middleware('permission:delivery.cod.verify')->group(function (): void {
        Route::patch('/{deliveryId}/cod/verify', [DeliveryCodController::class, 'verify']);
        Route::patch('/{deliveryId}/cod/dispute', [DeliveryCodController::class, 'dispute']);
        Route::patch('/{deliveryId}/cod/write-off', [DeliveryCodController::class, 'writeOff']);
    });
});

// ── Logistics V2 — Fleet Operations (EPIC-LOG-V2-001, Phase 1) ────────────────
// Fleet owns vehicle CONDITION; LOG-003 owns vehicle IDENTITY. Nothing here
// writes logistics_vehicles, and nothing imports Distribution or Delivery —
// Fleet Operations is independent of Delivery Execution (Directive 3).
Route::middleware('auth:sanctum')->prefix('logistics/fleet')->group(function (): void {
    // Reference data + analytics
    Route::get('/options', [FleetUnitController::class, 'options'])
        ->middleware('permission:fleet.view');
    Route::get('/stats', [FleetUnitController::class, 'stats'])
        ->middleware('permission:fleet.view');

    // Read surface
    Route::middleware('permission:fleet.view')->group(function (): void {
        Route::get('/units', [FleetUnitController::class, 'index']);
        Route::get('/units/{id}', [FleetUnitController::class, 'show']);
        Route::get('/units/{id}/fitness', [FleetUnitController::class, 'fitness']);
        Route::get('/units/{id}/health', [FleetUnitController::class, 'health']);
        Route::get('/units/{id}/odometer', [FleetUnitController::class, 'odometerHistory']);
        Route::get('/units/{unitId}/maintenance-plans', [FleetMaintenanceController::class, 'plans']);
        Route::get('/units/{unitId}/maintenance-plans/evaluate', [FleetMaintenanceController::class, 'evaluate']);
        Route::get('/units/{unitId}/inspections', [FleetInspectionController::class, 'index']);
        Route::get('/units/{unitId}/inspections/{id}', [FleetInspectionController::class, 'show']);
        Route::get('/units/{unitId}/fuel/efficiency', [FleetFuelController::class, 'efficiency']);
        Route::get('/inspection-templates', [FleetInspectionController::class, 'templates']);
        Route::get('/work-orders', [FleetMaintenanceController::class, 'workOrders']);
        Route::get('/defects', [FleetInspectionController::class, 'defects']);
        Route::get('/fuel-transactions', [FleetFuelController::class, 'index']);
        Route::get('/fuel-transactions/{id}', [FleetFuelController::class, 'show']);
    });

    // Unit lifecycle
    Route::middleware('permission:fleet.manage')->group(function (): void {
        Route::post('/units', [FleetUnitController::class, 'store']);
        Route::patch('/units/{id}/lifecycle', [FleetUnitController::class, 'setLifecycle']);
        Route::patch('/units/{id}/group', [FleetUnitController::class, 'moveGroup']);
        Route::patch('/defects/{id}/acknowledge', [FleetInspectionController::class, 'acknowledgeDefect']);
        Route::patch('/defects/{id}/repair', [FleetInspectionController::class, 'repairDefect']);
        Route::patch('/defects/{id}/resolve', [FleetInspectionController::class, 'resolveDefect']);
    });

    // Maintenance — schedule and complete are separate permissions so work
    // cannot be marked done that was never scheduled or performed.
    Route::middleware('permission:fleet.maintenance.schedule')->group(function (): void {
        Route::post('/units/{unitId}/maintenance-plans', [FleetMaintenanceController::class, 'storePlan']);
        Route::patch('/units/{unitId}/maintenance-plans/{planId}/reproject', [FleetMaintenanceController::class, 'reprojectPlan']);
        Route::post('/units/{unitId}/work-orders', [FleetMaintenanceController::class, 'storeWorkOrder']);
        Route::patch('/work-orders/{id}/schedule', [FleetMaintenanceController::class, 'scheduleWorkOrder']);
        Route::patch('/work-orders/{id}/start', [FleetMaintenanceController::class, 'startWorkOrder']);
        Route::patch('/work-orders/{id}/cancel', [FleetMaintenanceController::class, 'cancelWorkOrder']);
    });
    Route::patch('/work-orders/{id}/complete', [FleetMaintenanceController::class, 'completeWorkOrder'])
        ->middleware('permission:fleet.maintenance.complete');

    // Inspections — perform and approve are separate so evidence is not
    // self-certified (the LOG-005 POD capture/validate precedent).
    Route::middleware('permission:fleet.inspection.perform')->group(function (): void {
        Route::post('/units/{unitId}/inspections', [FleetInspectionController::class, 'store']);
        Route::patch('/units/{unitId}/inspections/{id}/submit', [FleetInspectionController::class, 'submit']);
        Route::post('/units/{unitId}/defects', [FleetInspectionController::class, 'reportDefect']);
    });
    Route::middleware('permission:fleet.inspection.approve')->group(function (): void {
        Route::patch('/units/{unitId}/inspections/{id}/approve', [FleetInspectionController::class, 'approve']);
        Route::patch('/units/{unitId}/inspections/{id}/reject', [FleetInspectionController::class, 'reject']);
    });

    // Dismissing a defect clears a blocker without repairing anything; a
    // CRITICAL one additionally requires fleet.health.override, checked in the
    // controller because the requirement depends on the record's severity.
    Route::patch('/defects/{id}/dismiss', [FleetInspectionController::class, 'dismissDefect'])
        ->middleware('permission:fleet.manage');

    // Fuel — record and reconcile are separate so the person entering a
    // purchase cannot clear their own anomaly.
    Route::middleware('permission:fleet.fuel.record')->group(function (): void {
        Route::post('/units/{unitId}/fuel-transactions', [FleetFuelController::class, 'store']);
        Route::post('/units/{id}/odometer', [FleetUnitController::class, 'recordOdometer']);
    });
    Route::middleware('permission:fleet.fuel.reconcile')->group(function (): void {
        Route::patch('/fuel-transactions/{id}/reconcile', [FleetFuelController::class, 'reconcile']);
        Route::patch('/fuel-transactions/{id}/dispute', [FleetFuelController::class, 'dispute']);
        Route::patch('/fuel-transactions/{id}/write-off', [FleetFuelController::class, 'writeOff']);
        Route::patch('/fuel-transactions/{id}/reject', [FleetFuelController::class, 'reject']);
    });

    Route::get('/units/{id}/costs', [FleetUnitController::class, 'costs'])
        ->middleware('permission:fleet.cost.view');
});

// ── Logistics V2 — Network (EPIC-LOG-V2-001, Phase 2) ─────────────────────────
// A service area COMPOSES existing geography — distribution_zones and
// logistics_cities — and stores no place of its own (Directive 8).
// Capacity endpoints are ADVISORY: Network answers, Orders decides.
Route::middleware('auth:sanctum')->prefix('logistics/network')->group(function (): void {
    Route::get('/options', [NetworkController::class, 'options'])
        ->middleware('permission:network.view');

    Route::middleware('permission:network.view')->group(function (): void {
        Route::get('/service-areas', [NetworkController::class, 'index']);
        Route::get('/service-areas/{id}', [NetworkController::class, 'show']);
        Route::get('/service-areas/{areaId}/capacity-plans', [NetworkController::class, 'capacityPlans']);
        Route::get('/dispatch-regions', [NetworkController::class, 'regions']);
        Route::get('/service-levels', [NetworkController::class, 'serviceLevels']);
        Route::post('/coverage/resolve', [NetworkController::class, 'resolveCoverage']);
        // Advisory — never rejects. This is the Orders integration point.
        Route::post('/capacity/availability', [NetworkController::class, 'availability']);
    });

    Route::middleware('permission:network.manage')->group(function (): void {
        Route::post('/service-areas', [NetworkController::class, 'store']);
        Route::patch('/service-areas/{id}/status', [NetworkController::class, 'setStatus']);
        Route::post('/service-areas/{id}/members', [NetworkController::class, 'attachMember']);
        Route::delete('/service-areas/{id}/members/{memberId}', [NetworkController::class, 'detachMember']);
        Route::post('/dispatch-regions', [NetworkController::class, 'storeRegion']);
        Route::post('/service-levels', [NetworkController::class, 'storeServiceLevel']);
    });

    // Reserving capacity is a separate permission from planning it, so sales
    // cannot raise the ceiling to fit their own order.
    Route::middleware('permission:network.capacity.commit')->group(function (): void {
        Route::post('/capacity/reserve', [NetworkController::class, 'reserve']);
        Route::patch('/capacity/{id}/commit', [NetworkController::class, 'commitReservation']);
        Route::patch('/capacity/{id}/release', [NetworkController::class, 'releaseReservation']);
    });

    Route::post('/capacity/sweep-expired', [NetworkController::class, 'sweepExpired'])
        ->middleware('permission:network.capacity.manage');
});

// ── Logistics V2 — Dispatch (Phase 2) ─────────────────────────────────────────
// Dispatch PROPOSES; V1 COMMITS. Release calls Drivers' assignment service and
// Distribution's TripService, and echoes the ids they return (Directives 5, 6).
Route::middleware('auth:sanctum')->prefix('logistics/dispatch')->group(function (): void {
    Route::get('/options', [DispatchController::class, 'options'])
        ->middleware('permission:dispatch.view');

    Route::middleware('permission:dispatch.view')->group(function (): void {
        Route::get('/boards', [DispatchController::class, 'index']);
        Route::get('/boards/{id}', [DispatchController::class, 'show']);
        // Fit vehicles × available drivers, each with the verdict that decided it.
        Route::get('/resource-pool', [DispatchController::class, 'resourcePool']);
    });

    Route::middleware('permission:dispatch.manage')->group(function (): void {
        Route::post('/boards', [DispatchController::class, 'store']);
        Route::patch('/boards/{id}/status', [DispatchController::class, 'setStatus']);
    });

    // Propose and release are separate so an automated proposal cannot commit
    // itself to V1.
    Route::middleware('permission:dispatch.propose')->group(function (): void {
        Route::post('/boards/{id}/propose', [DispatchController::class, 'propose']);
        Route::patch('/proposals/{id}/reject', [DispatchController::class, 'rejectProposal']);
        Route::patch('/assignments/{id}/override', [DispatchController::class, 'overrideAssignment']);
    });

    Route::middleware('permission:dispatch.release')->group(function (): void {
        Route::patch('/proposals/{id}/accept', [DispatchController::class, 'acceptProposal']);
        // Partial success is a normal 200 — see DispatchBoardStatus.
        Route::post('/proposals/{id}/release', [DispatchController::class, 'release']);
    });
});

// ── Logistics V2 — Dispatch Operations (Phase 3) ──────────────────────────────
// ADDITIVE: the Phase 2 /logistics/dispatch routes above are untouched.
// Sessions, queue, locks, allocation, conflicts, review and monitoring.
//
// Allocation ORCHESTRATES existing authorities — Fleet readiness, Network
// capacity, LOG-002 driver fitness — and re-implements none of them.
Route::middleware('auth:sanctum')->prefix('logistics/dispatch/ops')->group(function (): void {
    Route::get('/options', [DispatchOperationsController::class, 'options'])
        ->middleware('permission:dispatch.view');

    // Read surface
    Route::middleware('permission:dispatch.view')->group(function (): void {
        Route::get('/sessions', [DispatchOperationsController::class, 'sessions']);
        Route::get('/boards/{boardId}/queue', [DispatchOperationsController::class, 'queue']);
        Route::get('/boards/{boardId}/timeline', [DispatchOperationsController::class, 'boardTimeline']);
        Route::get('/conflicts', [DispatchOperationsController::class, 'conflicts']);
        Route::get('/reviews/pending', [DispatchOperationsController::class, 'pendingReviews']);
        Route::get('/locks', [DispatchOperationsController::class, 'locks']);
    });

    // Sessions
    Route::middleware('permission:dispatch.session.manage')->group(function (): void {
        Route::post('/boards/{boardId}/sessions', [DispatchOperationsController::class, 'openSession']);
        Route::patch('/sessions/{id}/status', [DispatchOperationsController::class, 'setSessionStatus']);
        Route::patch('/sessions/{id}/close', [DispatchOperationsController::class, 'closeSession']);
        Route::post('/maintenance/sweep', [DispatchOperationsController::class, 'sweepLocks']);
    });

    // Queue
    Route::middleware('permission:dispatch.queue.manage')->group(function (): void {
        Route::post('/boards/{boardId}/queue/build', [DispatchOperationsController::class, 'buildQueue']);
        Route::patch('/queue/{itemId}/priority', [DispatchOperationsController::class, 'prioritiseItem']);
        Route::patch('/queue/{itemId}/defer', [DispatchOperationsController::class, 'deferItem']);
    });

    // Claiming and allocating is the propose-side permission from Phase 2 —
    // reused rather than duplicated.
    Route::middleware('permission:dispatch.propose')->group(function (): void {
        Route::post('/sessions/{sessionId}/queue/claim-next', [DispatchOperationsController::class, 'claimNext']);
        Route::post('/sessions/{sessionId}/queue/{itemId}/claim', [DispatchOperationsController::class, 'claimItem']);
        Route::post('/sessions/{sessionId}/allocate', [DispatchOperationsController::class, 'allocate']);
        Route::patch('/allocations/{id}/release', [DispatchOperationsController::class, 'releaseAllocation']);
    });

    // Confirming an allocation commits resources, so it takes the release
    // permission — the same separation Phase 2 established.
    Route::patch('/allocations/{id}/confirm', [DispatchOperationsController::class, 'confirmAllocation'])
        ->middleware('permission:dispatch.release');

    // Conflicts
    Route::middleware('permission:dispatch.conflict.resolve')->group(function (): void {
        Route::patch('/conflicts/{id}/resolve', [DispatchOperationsController::class, 'resolveConflict']);
        Route::patch('/conflicts/{id}/override', [DispatchOperationsController::class, 'overrideConflict']);
    });

    // Review — requesting and deciding are separate so a risk decision is not
    // self-certified.
    Route::post('/assignments/{assignmentId}/review', [DispatchOperationsController::class, 'requestReview'])
        ->middleware('permission:dispatch.assignment.review');
    Route::middleware('permission:dispatch.assignment.approve')->group(function (): void {
        Route::patch('/reviews/{id}/approve', [DispatchOperationsController::class, 'approveReview']);
        Route::patch('/reviews/{id}/reject', [DispatchOperationsController::class, 'rejectReview']);
    });

    // Taking a resource from a colleague mid-decision. Always audited.
    Route::patch('/locks/{id}/break', [DispatchOperationsController::class, 'breakLock'])
        ->middleware('permission:dispatch.assignment.override');

    // Monitoring — operational metrics only, no prediction.
    Route::middleware('permission:dispatch.monitoring.view')->group(function (): void {
        Route::get('/monitoring/kpis', [DispatchOperationsController::class, 'kpis']);
        Route::get('/monitoring/queue', [DispatchOperationsController::class, 'queueStatistics']);
        Route::get('/monitoring/health', [DispatchOperationsController::class, 'assignmentHealth']);
        Route::get('/monitoring/capacity', [DispatchOperationsController::class, 'capacityUtilisation']);
        Route::get('/monitoring/exceptions', [DispatchOperationsController::class, 'exceptions']);
    });

    Route::get('/audit', [DispatchOperationsController::class, 'auditTrail'])
        ->middleware('permission:dispatch.audit.view');
});

// ── Logistics V2 — Routing (Phase 2) ──────────────────────────────────────────
// Deterministic strategies only; no optimisation AI. Every run stores its input
// snapshot, which is the replay harness and the future AI corpus (Directive 10).
Route::middleware('auth:sanctum')->prefix('logistics/routing')->group(function (): void {
    Route::middleware('permission:routing.view')->group(function (): void {
        Route::get('/options', [RoutingController::class, 'options']);
        Route::get('/strategies', [RoutingController::class, 'strategies']);
        Route::get('/trips/{tripId}/plan', [RoutingController::class, 'currentPlan']);
        Route::get('/trips/{tripId}/plans', [RoutingController::class, 'planHistory']);
        Route::get('/runs/{id}', [RoutingController::class, 'run']);
    });

    Route::middleware('permission:routing.optimize')->group(function (): void {
        Route::post('/trips/{tripId}/plan', [RoutingController::class, 'plan']);
        Route::patch('/trips/{tripId}/plans/{planId}/activate', [RoutingController::class, 'activate']);
        Route::patch('/trips/{tripId}/plans/{planId}/complete', [RoutingController::class, 'complete']);
        Route::post('/trips/{tripId}/plans/{planId}/eta', [RoutingController::class, 'projectEta']);
    });
});

// ── Logistics V2 — Carrier foundation (Phase 2) ───────────────────────────────
// Adapter registry, internal fleet adapter and account configuration only.
// No provider-specific integration yet (D4/D7). Credentials live in the
// Provider Platform and are never serialised here.
Route::middleware('auth:sanctum')->prefix('logistics/carriers')->group(function (): void {
    Route::middleware('permission:carrier.view')->group(function (): void {
        Route::get('/options', [CarrierController::class, 'options']);
        Route::get('/accounts', [CarrierController::class, 'index']);
        Route::get('/accounts/{id}', [CarrierController::class, 'show']);
        Route::get('/accounts/{id}/capabilities', [CarrierController::class, 'capabilities']);
        Route::get('/accounts/{id}/status-mappings', [CarrierController::class, 'statusMappings']);
    });

    Route::middleware('permission:carrier.manage')->group(function (): void {
        Route::post('/accounts', [CarrierController::class, 'store']);
        Route::post('/accounts/{id}/test-connection', [CarrierController::class, 'testConnection']);
        Route::put('/accounts/{id}/status-mappings', [CarrierController::class, 'upsertStatusMapping']);
    });
});

// ── Logistics V2 — Operations (Phase 4) ───────────────────────────────────────
// ADDITIVE: every Phase 0–3 route above is untouched.
//
// This context owns no business state beyond pool membership, its own
// reservation envelopes and the exception registry. Every readiness verdict
// comes from Fleet, every capacity decision from Network's ledger, and every
// dispatch figure from Phase 3 — reported here, never recomputed.
Route::middleware('auth:sanctum')->prefix('logistics/operations')->group(function (): void {

    // ── A. Resource pools ────────────────────────────────────────────────────
    Route::prefix('pools')->group(function (): void {
        Route::middleware('permission:operations.view')->group(function (): void {
            Route::get('/options', [ResourcePoolController::class, 'options']);
            Route::get('/', [ResourcePoolController::class, 'index']);
            Route::get('/health', [ResourcePoolController::class, 'healthOverview']);
            // Assignable resources in no pool — capacity nobody is planning with.
            Route::get('/unassigned', [ResourcePoolController::class, 'unassigned']);
            Route::get('/availability-matrix', [ResourcePoolController::class, 'availabilityMatrix']);
            Route::get('/{id}', [ResourcePoolController::class, 'show']);
            // Membership joined to Fleet's and Drivers' current verdicts.
            Route::get('/{id}/unified', [ResourcePoolController::class, 'unifiedView']);
            Route::get('/{id}/health', [ResourcePoolController::class, 'poolHealth']);
        });

        Route::middleware('permission:operations.pool.manage')->group(function (): void {
            Route::post('/', [ResourcePoolController::class, 'store']);
            Route::patch('/{id}/status', [ResourcePoolController::class, 'setStatus']);
            Route::post('/{id}/members', [ResourcePoolController::class, 'addMember']);
            Route::patch('/members/{memberId}/status', [ResourcePoolController::class, 'setMemberStatus']);
        });
    });

    // ── B. Capacity operations ───────────────────────────────────────────────
    Route::prefix('capacity')->group(function (): void {
        Route::middleware('permission:operations.view')->group(function (): void {
            Route::get('/options', [CapacityOperationsController::class, 'options']);
            Route::get('/reservations', [CapacityOperationsController::class, 'index']);
            Route::get('/reservations/{id}', [CapacityOperationsController::class, 'show']);
            Route::get('/monitoring', [CapacityOperationsController::class, 'monitoring']);
            Route::get('/reservations/{id}/rebalance-candidates', [CapacityOperationsController::class, 'rebalanceCandidates']);
        });

        // Reserving and confirming both consume capacity, so they share the
        // reserve permission.
        Route::middleware('permission:operations.capacity.reserve')->group(function (): void {
            Route::post('/reservations', [CapacityOperationsController::class, 'reserve']);
            Route::patch('/reservations/{id}/confirm', [CapacityOperationsController::class, 'confirm']);
        });

        // Giving capacity back is a separate decision someone must own.
        Route::middleware('permission:operations.capacity.release')->group(function (): void {
            Route::patch('/reservations/{id}/release', [CapacityOperationsController::class, 'release']);
            Route::patch('/reservations/{id}/rebalance', [CapacityOperationsController::class, 'rebalance']);
            Route::post('/maintenance/reconcile', [CapacityOperationsController::class, 'reconcile']);
        });

        Route::get('/reservations/{id}/audit', [CapacityOperationsController::class, 'auditTrail'])
            ->middleware('permission:operations.audit.view');
    });

    // ── C. Operational health — read-only dashboards ─────────────────────────
    Route::prefix('health')->middleware('permission:operations.view')->group(function (): void {
        Route::get('/overview', [OperationalHealthController::class, 'overview']);
        Route::get('/resources', [OperationalHealthController::class, 'resources']);
        Route::get('/capacity', [OperationalHealthController::class, 'capacity']);
        Route::get('/dispatch', [OperationalHealthController::class, 'dispatch']);
        Route::get('/utilisation', [OperationalHealthController::class, 'utilisation']);
    });

    // ── D. Exception management ──────────────────────────────────────────────
    Route::prefix('exceptions')->group(function (): void {
        Route::middleware('permission:operations.view')->group(function (): void {
            Route::get('/options', [OperationsExceptionController::class, 'options']);
            Route::get('/', [OperationsExceptionController::class, 'index']);
            Route::get('/summary', [OperationsExceptionController::class, 'summary']);
            Route::get('/alerts', [OperationsExceptionController::class, 'alerts']);
            Route::get('/alerts/summary', [OperationsExceptionController::class, 'alertSummary']);
            Route::get('/alerts/rules', [OperationsExceptionController::class, 'alertRules']);
            Route::get('/{id}', [OperationsExceptionController::class, 'show']);
            Route::get('/{id}/notes', [OperationsExceptionController::class, 'notes']);
            Route::get('/{id}/escalations', [OperationsExceptionController::class, 'escalationHistory']);
        });

        Route::middleware('permission:operations.exception.manage')->group(function (): void {
            Route::patch('/{id}/acknowledge', [OperationsExceptionController::class, 'acknowledge']);
            Route::patch('/{id}/resolve', [OperationsExceptionController::class, 'resolve']);
            Route::patch('/{id}/suppress', [OperationsExceptionController::class, 'suppress']);
            Route::post('/{id}/notes', [OperationsExceptionController::class, 'addNote']);
            Route::post('/maintenance/reconcile', [OperationsExceptionController::class, 'reconcile']);
        });

        // Escalating is its own permission: it commits somebody else's time.
        Route::middleware('permission:operations.exception.escalate')->group(function (): void {
            Route::post('/{id}/escalate', [OperationsExceptionController::class, 'escalate']);
            Route::post('/maintenance/escalate-overdue', [OperationsExceptionController::class, 'escalateOverdue']);
        });

        Route::post('/alerts/rules', [OperationsExceptionController::class, 'storeAlertRule'])
            ->middleware('permission:operations.alert.manage');
    });
});

// ── Logistics V2 — Operational surfaces (Phase 5) ─────────────────────────────
// ADDITIVE and READ-ONLY. No table, no writer, no permission is created here:
// every endpoint aggregates or unions state Phases 1-4 already own.
//
// Dashboards assemble Fleet/Drivers (via Dispatch's ResourcePool), Network's
// ledger and Phase 3's monitoring. Activity unions the append-only tables those
// modules keep. Nothing is recomputed; nothing is stored.
Route::middleware('auth:sanctum')->prefix('logistics/operations')->group(function (): void {

    // ── B. Operational dashboards ────────────────────────────────────────────
    Route::prefix('dashboards')->middleware('permission:operations.view')->group(function (): void {
        Route::get('/fleet', [DashboardController::class, 'fleet']);
        Route::get('/drivers', [DashboardController::class, 'drivers']);
        Route::get('/capacity', [DashboardController::class, 'capacity']);
        Route::get('/dispatch', [DashboardController::class, 'dispatch']);
        Route::get('/kpi', [DashboardController::class, 'kpi']);
    });

    // ── D. Activity, audit and the history views ─────────────────────────────
    Route::prefix('activity')->group(function (): void {
        Route::middleware('permission:operations.view')->group(function (): void {
            Route::get('/options', [ActivityController::class, 'options']);
            Route::get('/timeline', [ActivityController::class, 'timeline']);
            Route::get('/history/assignments', [ActivityController::class, 'assignments']);
            Route::get('/history/sessions', [ActivityController::class, 'sessions']);
            Route::get('/history/capacity', [ActivityController::class, 'capacity']);
        });

        // The audit explorer is who-did-what-and-why; it takes the audit view.
        Route::get('/audit', [ActivityController::class, 'audit'])
            ->middleware('permission:operations.audit.view');
    });
});

// ── Logistics V2 — Enterprise readiness & completion (Phase 6) ────────────────
// ADDITIVE and READ-ONLY. No table, no writer, no permission, no migration:
// every endpoint interprets or digests projections Phases 1-5 already own.
// Readiness never calculates Fleet readiness or Network capacity itself.
// SECURITY: both middleware go in ONE array. Chaining ->middleware() twice on a
// route registrar makes the second call REPLACE the first, which silently
// dropped auth:sanctum here and left these endpoints reachable without a
// session. Verified against the route table, not by reading the chain.
Route::middleware(['auth:sanctum', 'permission:operations.view'])
    ->prefix('logistics/operations')
    ->group(function (): void {

        // A + B. Operational readiness and cross-module validation.
        Route::prefix('readiness')->group(function (): void {
            Route::get('/', [ReadinessController::class, 'dashboard']);
            Route::get('/health-score', [ReadinessController::class, 'healthScore']);
            Route::get('/modules', [ReadinessController::class, 'modules']);
            Route::get('/checklist', [ReadinessController::class, 'checklist']);
            Route::get('/validate', [ReadinessController::class, 'validateAll']);
            Route::get('/validate/{module}', [ReadinessController::class, 'validateModule']);
        });

        // C. Operational diagnostics — projections only.
        Route::prefix('diagnostics')->group(function (): void {
            Route::get('/', [DiagnosticsController::class, 'center']);
            Route::get('/system', [DiagnosticsController::class, 'system']);
            Route::get('/dependencies', [DiagnosticsController::class, 'dependencies']);
            Route::get('/queue', [DiagnosticsController::class, 'queue']);
            Route::get('/capacity', [DiagnosticsController::class, 'capacity']);
            Route::get('/dispatch', [DiagnosticsController::class, 'dispatch']);
            Route::get('/exceptions', [DiagnosticsController::class, 'exceptions']);
        });

        // D. Enterprise summaries — digests over existing monitoring.
        Route::prefix('summary')->group(function (): void {
            Route::get('/executive', [SummaryController::class, 'executive']);
            Route::get('/today', [SummaryController::class, 'today']);
            Route::get('/capacity', [SummaryController::class, 'capacity']);
            Route::get('/dispatch', [SummaryController::class, 'dispatch']);
            Route::get('/fleet', [SummaryController::class, 'fleet']);
            Route::get('/exceptions', [SummaryController::class, 'exceptions']);
        });
    });

// ── Logistics V2 — Enterprise Intelligence (EPIC-LOG-V2-002) ──────────────────
// ADDITIVE and READ-ONLY. No table, no writer, no migration, no new permission,
// no change to any existing API. Every endpoint reads figures the operational
// modules already produce and returns decision support — recommendations,
// deterministic optimisations and deterministic forecasts. It reuses the
// existing operations.view permission.
// SECURITY: both middleware go in ONE array. Chaining ->middleware() twice on a
// route registrar makes the second call REPLACE the first, which silently
// dropped auth:sanctum here and left these endpoints reachable without a
// session. Verified against the route table, not by reading the chain.
Route::middleware(['auth:sanctum', 'permission:operations.view'])
    ->prefix('logistics/intelligence')
    ->group(function (): void {

        // Decision Engine.
        Route::prefix('decisions')->group(function (): void {
            Route::get('/', [DecisionController::class, 'decide']);
            Route::get('/recommendations', [DecisionController::class, 'recommendations']);
            Route::get('/priorities', [DecisionController::class, 'priorities']);
            Route::get('/conflicts', [DecisionController::class, 'conflicts']);
        });

        // Optimisation Engine.
        Route::prefix('optimization')->group(function (): void {
            Route::get('/vehicle', [OptimizationController::class, 'vehicle']);
            Route::get('/capacity', [OptimizationController::class, 'capacity']);
            Route::get('/route', [OptimizationController::class, 'route']);
            Route::get('/assignment', [OptimizationController::class, 'assignment']);
        });

        // Forecasting — deterministic projections.
        Route::prefix('forecast')->group(function (): void {
            Route::get('/capacity', [ForecastController::class, 'capacity']);
            Route::get('/dispatch', [ForecastController::class, 'dispatch']);
            Route::get('/workload', [ForecastController::class, 'workload']);
        });

        // AI Recommendation Layer.
        Route::prefix('insights')->group(function (): void {
            Route::get('/suggestions', [InsightController::class, 'suggestions']);
            Route::get('/bottlenecks', [InsightController::class, 'bottlenecks']);
            Route::get('/warnings', [InsightController::class, 'warnings']);
            Route::get('/', [InsightController::class, 'insights']);
        });

        // Enterprise Workspace — aggregated dashboards (one read each).
        Route::prefix('dashboard')->group(function (): void {
            Route::get('/executive', [EnterpriseDashboardController::class, 'executive']);
            Route::get('/operations', [EnterpriseDashboardController::class, 'operations']);
        });
    });

// ── Logistics V2 — Automation observability (EPIC-LOG-V2-002) ──────────────────
// ADDITIVE and READ-ONLY. The automation consumers run off event dispatch; these
// endpoints only expose what is wired up — policies, metrics and monitoring.
// No table, no writer, no new permission; reuses operations.view.
// SECURITY: both middleware go in ONE array. Chaining ->middleware() twice on a
// route registrar makes the second call REPLACE the first, which silently
// dropped auth:sanctum here and left these endpoints reachable without a
// session. Verified against the route table, not by reading the chain.
Route::middleware(['auth:sanctum', 'permission:operations.view'])
    ->prefix('logistics/automation')
    ->group(function (): void {
        Route::get('/policies', [AutomationController::class, 'policies']);
        Route::get('/monitoring', [AutomationController::class, 'monitoring']);
        Route::get('/metrics', [AutomationController::class, 'metrics']);
    });

// ── Finance OS — EPIC F1 · Ledger Core & Fiscal Foundation ────────────────────
// The financial system of record. All read/write is company-scoped from the
// authenticated user. Manual journals are under strict segregation of duties:
// create (maker), post (checker/poster) and reverse are DISTINCT permissions.
Route::middleware('auth:sanctum')->prefix('finance')->group(function (): void {

    // Chart of Accounts.
    Route::prefix('accounts')->group(function (): void {
        Route::middleware('permission:finance.gl.view')->group(function (): void {
            Route::get('/options', [FinanceAccountController::class, 'options']);
            Route::get('/', [FinanceAccountController::class, 'index']);
            Route::get('/{uuid}', [FinanceAccountController::class, 'show']);
        });
        Route::middleware('permission:finance.coa.manage')->group(function (): void {
            Route::post('/', [FinanceAccountController::class, 'store']);
            Route::patch('/{uuid}/active', [FinanceAccountController::class, 'setActive']);
        });
    });

    // Financial dimensions — cost centers.
    Route::prefix('cost-centers')->group(function (): void {
        Route::get('/', [FinanceCostCenterController::class, 'index'])->middleware('permission:finance.gl.view');
        Route::post('/', [FinanceCostCenterController::class, 'store'])->middleware('permission:finance.dimension.manage');
    });

    // Fiscal calendar.
    Route::prefix('fiscal')->group(function (): void {
        Route::middleware('permission:finance.gl.view')->group(function (): void {
            Route::get('/options', [FinanceFiscalController::class, 'options']);
            Route::get('/years', [FinanceFiscalController::class, 'index']);
        });
        Route::middleware('permission:finance.period.manage')->group(function (): void {
            Route::post('/years', [FinanceFiscalController::class, 'createYear']);
            Route::patch('/periods/{uuid}/open', [FinanceFiscalController::class, 'openPeriod']);
            Route::patch('/periods/{uuid}/close', [FinanceFiscalController::class, 'closePeriod']);
            Route::patch('/periods/{uuid}/lock', [FinanceFiscalController::class, 'lockPeriod']);
        });
    });

    // Manual journals — SEGREGATION OF DUTIES.
    Route::prefix('journals')->group(function (): void {
        Route::middleware('permission:finance.gl.view')->group(function (): void {
            Route::get('/', [FinanceJournalController::class, 'index']);
            Route::get('/{uuid}', [FinanceJournalController::class, 'show']);
        });
        // Maker creates the draft.
        Route::middleware('permission:finance.journal.create')->group(function (): void {
            Route::post('/', [FinanceJournalController::class, 'store']);
            Route::delete('/{uuid}', [FinanceJournalController::class, 'discard']);
        });
        // A DIFFERENT person (checker/poster) approves and posts.
        Route::patch('/{uuid}/approve', [FinanceJournalController::class, 'approve'])
            ->middleware('permission:finance.journal.post');
        Route::post('/{uuid}/reverse', [FinanceJournalController::class, 'reverse'])
            ->middleware('permission:finance.journal.reverse');
    });

    // Tax core.
    Route::prefix('tax')->group(function (): void {
        Route::middleware('permission:finance.gl.view')->group(function (): void {
            Route::get('/categories', [FinanceTaxController::class, 'categories']);
            Route::get('/codes', [FinanceTaxController::class, 'codes']);
        });
        Route::middleware('permission:finance.tax.manage')->group(function (): void {
            Route::post('/categories', [FinanceTaxController::class, 'storeCategory']);
            Route::post('/codes', [FinanceTaxController::class, 'storeCode']);
        });
    });

    // Trial Balance — read model.
    Route::get('/trial-balance', [FinanceTrialBalanceController::class, 'show'])
        ->middleware('permission:finance.trialbalance.view');

    // Statutory statements — read models over the ledger. They compute nothing
    // themselves: totals come from the metrics kernel, so a statement can never
    // disagree with the dashboards drawn from the same figures. Gated on the
    // trial-balance permission because they expose the same ledger, at the same
    // granularity, to the same audience.
    Route::middleware('permission:finance.trialbalance.view')->group(function (): void {
        Route::get('/statements/income-statement', [FinanceStatementController::class, 'incomeStatement']);
        Route::get('/statements/balance-sheet', [FinanceStatementController::class, 'balanceSheet']);
    });
});

// ── Finance OS — EPIC F2 · Subledgers (AR / AP / Cash / Banking) ──────────────
// Operational subledgers that feed and reconcile with the GL. They NEVER write
// the ledger: every posting passes through the Posting Engine. Permissions are
// segregated per subledger; money-out (supplier payments) carries an approval
// authority distinct from create.
Route::middleware('auth:sanctum')->prefix('finance')->group(function (): void {

    // ── Accounts Receivable ────────────────────────────────────────────────────
    Route::prefix('ar')->group(function (): void {
        // Customer documents.
        Route::prefix('invoices')->group(function (): void {
            Route::middleware('permission:finance.ar.view')->group(function (): void {
                Route::get('/', [FinanceCustomerInvoiceController::class, 'index']);
                Route::get('/{uuid}', [FinanceCustomerInvoiceController::class, 'show']);
            });
            Route::post('/', [FinanceCustomerInvoiceController::class, 'store'])
                ->middleware('permission:finance.ar.invoice.create');
            Route::patch('/{uuid}/post', [FinanceCustomerInvoiceController::class, 'post'])
                ->middleware('permission:finance.ar.invoice.post');
        });

        // Customer receipts, allocation and write-off.
        Route::prefix('receipts')->group(function (): void {
            Route::get('/', [FinanceCustomerReceiptController::class, 'index'])
                ->middleware('permission:finance.ar.view');
            Route::post('/', [FinanceCustomerReceiptController::class, 'store'])
                ->middleware('permission:finance.ar.receipt.create');
            Route::patch('/{uuid}/post', [FinanceCustomerReceiptController::class, 'post'])
                ->middleware('permission:finance.ar.receipt.create');
            Route::post('/{uuid}/allocate', [FinanceCustomerReceiptController::class, 'allocate'])
                ->middleware('permission:finance.allocation.manage');
            Route::post('/{uuid}/auto-allocate', [FinanceCustomerReceiptController::class, 'autoAllocate'])
                ->middleware('permission:finance.allocation.manage');
        });
        Route::post('/write-off', [FinanceCustomerReceiptController::class, 'writeOff'])
            ->middleware('permission:finance.ar.writeoff');

        // Customer ledger read models.
        Route::middleware('permission:finance.ar.view')->group(function (): void {
            Route::get('/aging', [FinanceCustomerLedgerController::class, 'aging']);
            Route::get('/customers/{customerId}/ledger', [FinanceCustomerLedgerController::class, 'history']);
            Route::get('/customers/{customerId}/statement', [FinanceCustomerLedgerController::class, 'statement']);
            Route::get('/customers/{customerId}/balance', [FinanceCustomerLedgerController::class, 'balance']);
        });
    });

    // ── Accounts Payable ───────────────────────────────────────────────────────
    Route::prefix('ap')->group(function (): void {
        Route::prefix('bills')->group(function (): void {
            Route::middleware('permission:finance.ap.view')->group(function (): void {
                Route::get('/', [FinanceSupplierBillController::class, 'index']);
                Route::get('/{uuid}', [FinanceSupplierBillController::class, 'show']);
            });
            Route::post('/', [FinanceSupplierBillController::class, 'store'])
                ->middleware('permission:finance.ap.bill.create');
            Route::patch('/{uuid}/post', [FinanceSupplierBillController::class, 'post'])
                ->middleware('permission:finance.ap.bill.post');
        });

        Route::prefix('payments')->group(function (): void {
            Route::get('/', [FinanceSupplierPaymentController::class, 'index'])
                ->middleware('permission:finance.ap.view');
            Route::post('/', [FinanceSupplierPaymentController::class, 'store'])
                ->middleware('permission:finance.ap.payment.create');
            // SEGREGATION OF DUTIES: approve is a DISTINCT authority from create.
            Route::patch('/{uuid}/approve', [FinanceSupplierPaymentController::class, 'approve'])
                ->middleware('permission:finance.ap.payment.approve');
            Route::patch('/{uuid}/post', [FinanceSupplierPaymentController::class, 'post'])
                ->middleware('permission:finance.ap.payment.approve');
            Route::post('/{uuid}/allocate', [FinanceSupplierPaymentController::class, 'allocate'])
                ->middleware('permission:finance.allocation.manage');
            Route::post('/{uuid}/auto-allocate', [FinanceSupplierPaymentController::class, 'autoAllocate'])
                ->middleware('permission:finance.allocation.manage');
        });

        Route::middleware('permission:finance.ap.view')->group(function (): void {
            Route::get('/aging', [FinanceSupplierLedgerController::class, 'aging']);
            Route::get('/suppliers/{supplierId}/ledger', [FinanceSupplierLedgerController::class, 'history']);
            Route::get('/suppliers/{supplierId}/statement', [FinanceSupplierLedgerController::class, 'statement']);
            Route::get('/suppliers/{supplierId}/balance', [FinanceSupplierLedgerController::class, 'balance']);
        });
    });

    // ── Control-account reconciliation (subledger ↔ GL integrity proof) ─────────
    Route::prefix('control-reconciliation')->group(function (): void {
        Route::get('/receivable', [FinanceControlReconciliationController::class, 'receivable'])
            ->middleware('permission:finance.ar.view');
        Route::get('/payable', [FinanceControlReconciliationController::class, 'payable'])
            ->middleware('permission:finance.ap.view');
    });

    // ── Cash Management ────────────────────────────────────────────────────────
    Route::prefix('cash')->group(function (): void {
        Route::get('/accounts', [FinanceCashController::class, 'accounts'])
            ->middleware('permission:finance.cash.view');
        Route::post('/accounts', [FinanceCashController::class, 'storeAccount'])
            ->middleware('permission:finance.cash.manage');
        Route::post('/accounts/{accountUuid}/sessions/open', [FinanceCashController::class, 'openSession'])
            ->middleware('permission:finance.cash.session.manage');
        Route::patch('/sessions/{sessionUuid}/close', [FinanceCashController::class, 'closeSession'])
            ->middleware('permission:finance.cash.session.manage');
        Route::post('/accounts/{accountUuid}/transactions', [FinanceCashController::class, 'transaction'])
            ->middleware('permission:finance.cash.manage');
        Route::post('/transfers', [FinanceCashController::class, 'transfer'])
            ->middleware('permission:finance.cash.manage');
    });

    // ── Banking ────────────────────────────────────────────────────────────────
    Route::prefix('bank')->group(function (): void {
        Route::get('/accounts', [FinanceBankController::class, 'accounts'])
            ->middleware('permission:finance.bank.view');
        Route::post('/accounts', [FinanceBankController::class, 'storeAccount'])
            ->middleware('permission:finance.bank.manage');
        Route::post('/accounts/{accountUuid}/statements', [FinanceBankController::class, 'importStatement'])
            ->middleware('permission:finance.bank.manage');
        Route::post('/rules', [FinanceBankController::class, 'createRule'])
            ->middleware('permission:finance.bank.rule.manage');

        // Reconciliation workflow.
        Route::middleware('permission:finance.bank.reconcile')->group(function (): void {
            Route::post('/statements/{statementUuid}/reconcile', [FinanceBankController::class, 'startReconciliation']);
            Route::post('/reconciliations/{reconUuid}/auto-match', [FinanceBankController::class, 'autoMatch']);
            Route::post('/reconciliations/{reconUuid}/match', [FinanceBankController::class, 'manualMatch']);
            Route::get('/reconciliations/{reconUuid}/outstanding', [FinanceBankController::class, 'outstanding']);
            Route::patch('/reconciliations/{reconUuid}/complete', [FinanceBankController::class, 'complete']);
        });
    });
});

// ── Finance OS — EPIC F3 · Enterprise Financial Integration ───────────────────
// The rule-driven posting pipeline that connects operations to the ledger. Every
// posting is business event → posting rule → journal → ledger, exactly once. No
// operational module writes the GL; no account is hardcoded (roles map to a
// company's accounts). This surface configures rules and role mappings, previews
// postings, reads the audit/trace, and administers the dead-letter queue.
Route::middleware('auth:sanctum')->prefix('finance/integration')->group(function (): void {

    // Posting rules — configuration.
    Route::prefix('rules')->middleware('permission:finance.posting.rule.manage')->group(function (): void {
        Route::get('/', [FinancePostingRuleController::class, 'index']);
        Route::get('/{uuid}', [FinancePostingRuleController::class, 'show']);
        Route::post('/', [FinancePostingRuleController::class, 'store']);
        Route::patch('/{uuid}/active', [FinancePostingRuleController::class, 'setActive']);
    });

    // Account-role mapping — the no-hardcoding bridge.
    Route::prefix('account-roles')->middleware('permission:finance.integration.map')->group(function (): void {
        Route::get('/', [FinanceAccountRoleController::class, 'index']);
        Route::post('/', [FinanceAccountRoleController::class, 'store']);
        Route::delete('/{role}', [FinanceAccountRoleController::class, 'destroy']);
    });

    // Posting preview — dry-run the journal for an event.
    Route::post('/preview', [FinancePostingIntegrationController::class, 'preview'])
        ->middleware('permission:finance.posting.preview');

    // Audit & traceability.
    Route::middleware('permission:finance.posting.audit.view')->group(function (): void {
        Route::get('/audit', [FinancePostingIntegrationController::class, 'audit']);
        Route::get('/trace/entity', [FinancePostingIntegrationController::class, 'traceEntity']);
        Route::get('/trace/journal/{journalUuid}', [FinancePostingIntegrationController::class, 'traceJournal']);
    });

    // Dead-letter queue — inspect and replay failed postings.
    Route::prefix('dead-letters')->middleware('permission:finance.posting.deadletter.manage')->group(function (): void {
        Route::get('/', [FinancePostingDeadLetterController::class, 'index']);
        Route::post('/{uuid}/retry', [FinancePostingDeadLetterController::class, 'retry']);
        Route::patch('/{uuid}/discard', [FinancePostingDeadLetterController::class, 'discard']);
    });
});

// ── Finance OS — EPIC F4 · Financial Control, Closing & Budget ─────────────────
// Enterprise financial governance layered on the ledger, never modifying it.
// Closing orchestrates the F1 period lifecycle; budgets are read-only against
// Finance; controls report only; VAT and year-end post exclusively through the
// Posting Engine. Maker/checker is enforced on closing, year-end and budgets.
Route::middleware('auth:sanctum')->prefix('finance')->group(function (): void {

    // Period management — soft/hard close and authorized reopen.
    Route::prefix('periods')->group(function (): void {
        Route::post('/{uuid}/soft-close', [FinancePeriodClosingController::class, 'softClose'])->middleware('permission:finance.period.close');
        Route::post('/{uuid}/hard-close', [FinancePeriodClosingController::class, 'hardClose'])->middleware('permission:finance.period.close');
        Route::post('/{uuid}/reopen', [FinancePeriodClosingController::class, 'reopen'])->middleware('permission:finance.period.reopen');
        Route::get('/{uuid}/closure-history', [FinancePeriodClosingController::class, 'history'])->middleware('permission:finance.period.close');
    });

    // Closing runs — validate before close (maker/checker).
    Route::prefix('closing/runs')->group(function (): void {
        Route::post('/period/{periodUuid}', [FinanceClosingController::class, 'start'])->middleware('permission:finance.closing.manage');
        Route::post('/{uuid}/validate', [FinanceClosingController::class, 'validateRun'])->middleware('permission:finance.closing.manage');
        Route::get('/{uuid}', [FinanceClosingController::class, 'show'])->middleware('permission:finance.closing.manage');
        Route::post('/{uuid}/close', [FinanceClosingController::class, 'close'])->middleware('permission:finance.closing.approve');
    });

    // Closing workspace dashboard.
    Route::get('/closing/workspace/period/{uuid}', [FinanceClosingWorkspaceController::class, 'period'])
        ->middleware('permission:finance.closing.workspace.view');

    // Year-end closing (maker/checker).
    Route::prefix('year-end')->group(function (): void {
        Route::get('/{yearUuid}', [FinanceYearEndController::class, 'show'])->middleware('permission:finance.yearend.manage');
        Route::post('/{yearUuid}/close', [FinanceYearEndController::class, 'close'])->middleware('permission:finance.yearend.manage');
        Route::post('/{uuid}/finalize', [FinanceYearEndController::class, 'finalize'])->middleware('permission:finance.yearend.finalize');
    });

    // Budgets.
    Route::prefix('budgets')->group(function (): void {
        Route::middleware('permission:finance.budget.view')->group(function (): void {
            Route::get('/', [FinanceBudgetController::class, 'index']);
            Route::get('/{uuid}/vs-actual', [FinanceBudgetController::class, 'vsActual']);
            Route::get('/{uuid}/alerts', [FinanceBudgetController::class, 'alerts']);
        });
        Route::middleware('permission:finance.budget.manage')->group(function (): void {
            Route::post('/', [FinanceBudgetController::class, 'store']);
            Route::post('/{uuid}/lines', [FinanceBudgetController::class, 'addLine']);
            Route::post('/{uuid}/versions', [FinanceBudgetController::class, 'newVersion']);
        });
        Route::post('/{uuid}/approve', [FinanceBudgetController::class, 'approve'])->middleware('permission:finance.budget.approve');
    });

    // Budget control — availability, blocking, commitments, rules.
    Route::prefix('budget-control')->group(function (): void {
        Route::get('/availability', [FinanceBudgetControlController::class, 'availability'])->middleware('permission:finance.budget.view');
        Route::post('/evaluate', [FinanceBudgetControlController::class, 'evaluate'])->middleware('permission:finance.budget.view');
        Route::middleware('permission:finance.budget.control')->group(function (): void {
            Route::post('/commitments', [FinanceBudgetControlController::class, 'commit']);
            Route::patch('/commitments/{uuid}/release', [FinanceBudgetControlController::class, 'release']);
            Route::post('/rules', [FinanceBudgetControlController::class, 'storeRule']);
        });
    });

    // VAT operations.
    Route::prefix('vat')->group(function (): void {
        Route::middleware('permission:finance.vat.view')->group(function (): void {
            Route::get('/periods', [FinanceVatController::class, 'index']);
            Route::get('/periods/{uuid}/report', [FinanceVatController::class, 'report']);
        });
        Route::middleware('permission:finance.vat.manage')->group(function (): void {
            Route::post('/periods', [FinanceVatController::class, 'store']);
            Route::post('/periods/{uuid}/return', [FinanceVatController::class, 'generateReturn']);
            Route::post('/periods/{uuid}/settle', [FinanceVatController::class, 'settle']);
        });
    });

    // Financial controls (report-only) + exception register.
    Route::prefix('controls')->group(function (): void {
        Route::middleware('permission:finance.controls.view')->group(function (): void {
            Route::post('/run', [FinanceFinancialControlsController::class, 'run']);
            Route::get('/dashboard', [FinanceFinancialControlsController::class, 'dashboard']);
            Route::get('/exceptions', [FinanceFinancialControlsController::class, 'index']);
        });
        Route::middleware('permission:finance.controls.resolve')->group(function (): void {
            Route::patch('/exceptions/{uuid}/acknowledge', [FinanceFinancialControlsController::class, 'acknowledge']);
            Route::patch('/exceptions/{uuid}/resolve', [FinanceFinancialControlsController::class, 'resolve']);
        });
    });
});

// ── Finance OS — EPIC F5 · Financial Intelligence & Executive Workspace ───────
// The executive intelligence platform. ENTIRELY READ-ONLY: every figure derives
// from existing Finance data (F1-F4). No journal creation, no posting, no ledger
// or budget update. Every route is a view authority; scenario analysis simulates
// in memory and writes nothing.
Route::middleware('auth:sanctum')->prefix('finance/intelligence')->group(function (): void {

    // Executive & CFO workspaces.
    Route::get('/executive-workspace', [FinanceExecutiveWorkspaceController::class, 'overview'])
        ->middleware('permission:finance.executive.workspace.view');
    Route::get('/cfo-workspace', [FinanceCfoWorkspaceController::class, 'overview'])
        ->middleware('permission:finance.cfo.workspace.view');

    // Financial intelligence (trends, forecasts, variance, risk).
    Route::middleware('permission:finance.analytics.view')->group(function (): void {
        Route::get('/trends', [FinanceFinancialIntelligenceController::class, 'trends']);
        Route::get('/forecasts', [FinanceFinancialIntelligenceController::class, 'forecasts']);
        Route::get('/risk', [FinanceFinancialIntelligenceController::class, 'risk']);
        Route::get('/variance/{budgetUuid}', [FinanceFinancialIntelligenceController::class, 'variance']);

        // Profitability.
        Route::prefix('profitability')->group(function (): void {
            Route::get('/company', [FinanceProfitabilityController::class, 'company']);
            Route::get('/branch', [FinanceProfitabilityController::class, 'branch']);
            Route::get('/cost-center', [FinanceProfitabilityController::class, 'costCenter']);
            Route::get('/project', [FinanceProfitabilityController::class, 'project']);
            Route::get('/customer', [FinanceProfitabilityController::class, 'customer']);
            Route::get('/product', [FinanceProfitabilityController::class, 'product']);
            Route::get('/channel', [FinanceProfitabilityController::class, 'channel']);
        });

        // Cost intelligence.
        Route::prefix('cost')->group(function (): void {
            Route::get('/breakdown', [FinanceCostIntelligenceController::class, 'breakdown']);
            Route::get('/operational', [FinanceCostIntelligenceController::class, 'operational']);
            Route::get('/trend', [FinanceCostIntelligenceController::class, 'trend']);
        });

        // Cash-flow intelligence.
        Route::prefix('cash-flow')->group(function (): void {
            Route::get('/current', [FinanceCashFlowController::class, 'current']);
            Route::get('/forecast', [FinanceCashFlowController::class, 'forecast']);
        });

        // Analytics dashboards.
        Route::prefix('dashboards')->group(function (): void {
            Route::get('/revenue', [FinanceFinancialAnalyticsController::class, 'revenue']);
            Route::get('/expense', [FinanceFinancialAnalyticsController::class, 'expense']);
            Route::get('/margin', [FinanceFinancialAnalyticsController::class, 'margin']);
            Route::get('/profit', [FinanceFinancialAnalyticsController::class, 'profit']);
            Route::get('/budget', [FinanceFinancialAnalyticsController::class, 'budget']);
            Route::get('/vat', [FinanceFinancialAnalyticsController::class, 'vat']);
            Route::get('/executive-kpi', [FinanceFinancialAnalyticsController::class, 'executiveKpis']);
        });
    });

    // Scenario analysis (read-only simulation).
    Route::post('/scenario', [FinanceScenarioController::class, 'simulate'])
        ->middleware('permission:finance.scenario.view');

    // Executive reporting.
    Route::prefix('reports')->middleware('permission:finance.reports.view')->group(function (): void {
        Route::post('/generate', [FinanceExecutiveReportingController::class, 'generate']);
        Route::post('/snapshot', [FinanceExecutiveReportingController::class, 'snapshot']);
        Route::get('/snapshots', [FinanceExecutiveReportingController::class, 'index']);
        Route::get('/snapshots/{uuid}', [FinanceExecutiveReportingController::class, 'show']);
    });
});

// ── Distribution OS — Planning ────────────────────────────────────────────────
Route::middleware('auth:sanctum')->prefix('logistics/distribution/planning')->group(function (): void {
    Route::get('/stats', [DistributionPlanningController::class, 'stats']);
    Route::get('/zones', [DistributionPlanningController::class, 'zones']);
    Route::get('/unassigned', [DistributionPlanningController::class, 'unassigned']);
    Route::get('/zones/{zoneId}/detail', [DistributionPlanningController::class, 'zoneDetail']);
    Route::patch('/zones/{zoneId}/start', [DistributionPlanningController::class, 'startPlanning'])->middleware('permission:logistics.distribution.update');
    Route::patch('/zones/{zoneId}/planned', [DistributionPlanningController::class, 'markPlanned'])->middleware('permission:logistics.distribution.update');
});

Route::middleware('auth:sanctum')->prefix('logistics/geography')->group(function (): void {
    // KPI stats
    Route::get('/stats', [GovernorateController::class, 'stats']);

    // Governorates
    Route::get('/governorates', [GovernorateController::class, 'index']);
    Route::post('/governorates', [GovernorateController::class, 'store'])->middleware('permission:logistics.geography.create');
    Route::patch('/governorates/reorder', [GovernorateController::class, 'reorder'])->middleware('permission:logistics.geography.update');
    Route::get('/governorates/{id}', [GovernorateController::class, 'show']);
    Route::put('/governorates/{id}', [GovernorateController::class, 'update'])->middleware('permission:logistics.geography.update');
    Route::delete('/governorates/{id}', [GovernorateController::class, 'destroy'])->middleware('permission:logistics.geography.delete');
    Route::patch('/governorates/{id}/status', [GovernorateController::class, 'toggleStatus'])->middleware('permission:logistics.geography.update');

    // Cities nested under governorate
    Route::get('/governorates/{govId}/cities', [CityController::class, 'index']);
    Route::post('/governorates/{govId}/cities', [CityController::class, 'store'])->middleware('permission:logistics.geography.create');
    Route::get('/governorates/{govId}/cities/{id}', [CityController::class, 'show']);
    Route::put('/governorates/{govId}/cities/{id}', [CityController::class, 'update'])->middleware('permission:logistics.geography.update');
    Route::delete('/governorates/{govId}/cities/{id}', [CityController::class, 'destroy'])->middleware('permission:logistics.geography.delete');
    Route::patch('/governorates/{govId}/cities/{id}/status', [CityController::class, 'toggleStatus'])->middleware('permission:logistics.geography.update');

    // Aliases nested under city
    Route::get('/cities/{cityId}/aliases', [CityAliasController::class, 'index']);
    Route::post('/cities/{cityId}/aliases', [CityAliasController::class, 'store'])->middleware('permission:logistics.geography.update');
    Route::put('/cities/{cityId}/aliases/{id}', [CityAliasController::class, 'update'])->middleware('permission:logistics.geography.update');
    Route::delete('/cities/{cityId}/aliases/{id}', [CityAliasController::class, 'destroy'])->middleware('permission:logistics.geography.update');
});

// ── Logistics OS — Shipping Companies (TASK-LOG-001) ─────────────────────────
Route::middleware('auth:sanctum')->prefix('logistics/shipping-companies')->group(function (): void {
    Route::get('/stats', [ShippingCompanyController::class, 'stats']);
    Route::get('/next-code', [ShippingCompanyController::class, 'nextCode']);

    Route::get('/', [ShippingCompanyController::class, 'index']);
    Route::post('/', [ShippingCompanyController::class, 'store'])->middleware('permission:logistics.carriers.create');
    Route::get('/{id}', [ShippingCompanyController::class, 'show']);
    Route::put('/{id}', [ShippingCompanyController::class, 'update'])->middleware('permission:logistics.carriers.update');
    Route::patch('/{id}/status', [ShippingCompanyController::class, 'setStatus'])->middleware('permission:logistics.carriers.update');

    // Contracts
    Route::get('/{id}/contracts', [ShippingCompanyController::class, 'contracts']);
    Route::post('/{id}/contracts', [ShippingCompanyController::class, 'storeContract'])->middleware('permission:logistics.carriers.update');
    Route::put('/{id}/contracts/{contractId}', [ShippingCompanyController::class, 'updateContract'])->middleware('permission:logistics.carriers.update');
    Route::delete('/{id}/contracts/{contractId}', [ShippingCompanyController::class, 'destroyContract'])->middleware('permission:logistics.carriers.update');
    Route::patch('/{id}/contracts/{contractId}/activate', [ShippingCompanyController::class, 'activateContract'])->middleware('permission:logistics.carriers.update');

    // ECOS company mappings
    Route::get('/{id}/companies', [ShippingCompanyController::class, 'mappings']);
    Route::post('/{id}/companies', [ShippingCompanyController::class, 'storeMapping'])->middleware('permission:logistics.carriers.update');
    Route::delete('/{id}/companies/{mappingId}', [ShippingCompanyController::class, 'destroyMapping'])->middleware('permission:logistics.carriers.update');
});

// ── Logistics OS — Vehicles / Fleet (TASK-LOG-003) ───────────────────────────
// No destroy route by design: vehicles are archived, never deleted.
Route::middleware('auth:sanctum')->prefix('logistics/vehicles')->group(function (): void {
    Route::get('/options', [VehicleController::class, 'options']);
    Route::get('/stats', [VehicleController::class, 'stats']);
    Route::get('/next-code', [VehicleController::class, 'nextCode']);
    Route::get('/maintenance-permissions', [VehicleMaintenanceController::class, 'permissions']);

    Route::get('/', [VehicleController::class, 'index']);
    Route::post('/', [VehicleController::class, 'store'])->middleware('permission:logistics.vehicles.create');
    Route::get('/{id}', [VehicleController::class, 'show']);
    Route::put('/{id}', [VehicleController::class, 'update'])->middleware('permission:logistics.vehicles.update');
    Route::patch('/{id}/status', [VehicleController::class, 'setStatus'])->middleware('permission:logistics.vehicles.update');

    // Documents
    Route::get('/{id}/documents', [VehicleController::class, 'documents']);
    Route::post('/{id}/documents', [VehicleController::class, 'storeDocument'])->middleware('permission:logistics.vehicles.update');
    Route::get('/{id}/documents/{documentId}/download', [VehicleController::class, 'downloadDocument']);
    Route::delete('/{id}/documents/{documentId}', [VehicleController::class, 'destroyDocument'])->middleware('permission:logistics.vehicles.update');

    // Maintenance ledger — amend/delete are permission-gated (BR-8)
    Route::get('/{id}/maintenance', [VehicleMaintenanceController::class, 'index']);
    Route::post('/{id}/maintenance', [VehicleMaintenanceController::class, 'store'])->middleware('permission:logistics.vehicles.update');
    Route::put('/{id}/maintenance/{recordId}', [VehicleMaintenanceController::class, 'update'])->middleware('permission:logistics.vehicles.update');
    Route::delete('/{id}/maintenance/{recordId}', [VehicleMaintenanceController::class, 'destroy'])->middleware('permission:logistics.vehicles.update');
});

// ── Logistics OS — Drivers (TASK-LOG-002) ────────────────────────────────────
// No destroy route by design: drivers are archived, never deleted (BR-4, BR-5).
Route::middleware('auth:sanctum')->prefix('logistics/drivers')->group(function (): void {
    Route::get('/stats', [DriverController::class, 'stats']);
    Route::get('/next-code', [DriverController::class, 'nextCode']);

    Route::get('/', [DriverController::class, 'index']);
    Route::post('/', [DriverController::class, 'store'])->middleware('permission:logistics.drivers.create');
    Route::get('/{id}', [DriverController::class, 'show']);
    Route::put('/{id}', [DriverController::class, 'update'])->middleware('permission:logistics.drivers.update');
    Route::patch('/{id}/status', [DriverController::class, 'setStatus'])->middleware('permission:logistics.drivers.update');

    // Documents
    Route::get('/{id}/documents', [DriverController::class, 'documents']);
    Route::post('/{id}/documents', [DriverController::class, 'storeDocument'])->middleware('permission:logistics.drivers.update');
    Route::get('/{id}/documents/{documentId}/download', [DriverController::class, 'downloadDocument']);
    Route::delete('/{id}/documents/{documentId}', [DriverController::class, 'destroyDocument'])->middleware('permission:logistics.drivers.update');

    // Vehicle assignment + history
    Route::get('/{id}/assignments', [DriverController::class, 'assignmentHistory']);
    Route::post('/{id}/vehicle', [DriverController::class, 'assignVehicle'])->middleware('permission:logistics.drivers.update');
    Route::delete('/{id}/vehicle', [DriverController::class, 'releaseVehicle'])->middleware('permission:logistics.drivers.update');
});

/*
|--------------------------------------------------------------------------
| Engineering OS — System module (Super Admin / CTO / DevOps only)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:engineering.platform.manage'])->prefix('system/engineering')->group(function (): void {
    // Certification data
    Route::get('/dashboard', [EngineeringDashboardController::class, 'dashboard']);
    Route::get('/runs',      [EngineeringDashboardController::class, 'runs']);
    Route::get('/runs/{id}', [EngineeringDashboardController::class, 'show']);
    Route::get('/findings',  [EngineeringDashboardController::class, 'findings']);

    // Analytics (ENG-007)
    Route::get('/analytics', [PipelineAnalyticsController::class, 'index']);

    // Templates (ENG-007)
    Route::get('/templates',        [PipelineTemplateController::class, 'index']);
    Route::get('/templates/{slug}', [PipelineTemplateController::class, 'show']);

    // Release Manager — pipelines
    Route::get('/pipelines/active',       [PipelineController::class, 'active']);
    Route::get('/pipelines',              [PipelineController::class, 'index']);
    Route::post('/pipelines',             [PipelineController::class, 'store']);
    Route::get('/pipelines/{id}',         [PipelineController::class, 'show']);
    Route::post('/pipelines/{id}/cancel', [PipelineController::class, 'cancel']);
    Route::post('/pipelines/{id}/retry',  [PipelineController::class, 'retry']);

    // Recovery actions (ENG-007)
    Route::post('/pipelines/{id}/resume',        [PipelineRecoveryController::class, 'resume']);
    Route::post('/pipelines/{id}/restart',       [PipelineRecoveryController::class, 'restart']);
    Route::post('/pipelines/{id}/restart-stage', [PipelineRecoveryController::class, 'restartStage']);
    Route::post('/pipelines/{id}/skip-stage',    [PipelineRecoveryController::class, 'skipStage']);

    // Notifications
    Route::get('/notifications',                    [EngineeringNotificationController::class, 'index']);
    Route::post('/notifications/mark-all-read',     [EngineeringNotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{id}/read',        [EngineeringNotificationController::class, 'markRead']);

    // Inbox KPIs
    Route::get('/inbox/kpis', [InboxTaskController::class, 'kpis']);

    // Tasks CRUD
    Route::get('/inbox/tasks', [InboxTaskController::class, 'index']);
    Route::post('/inbox/tasks', [InboxTaskController::class, 'store']);
    Route::get('/inbox/tasks/{task}', [InboxTaskController::class, 'show']);
    Route::put('/inbox/tasks/{task}', [InboxTaskController::class, 'update']);
    Route::delete('/inbox/tasks/{task}', [InboxTaskController::class, 'destroy']);
    Route::post('/inbox/tasks/{task}/transition', [InboxTaskController::class, 'transition']);

    // Task relations
    Route::get('/inbox/tasks/{task}/comments', [InboxCommentController::class, 'index']);
    Route::post('/inbox/tasks/{task}/comments', [InboxCommentController::class, 'store']);
    Route::put('/inbox/comments/{comment}', [InboxCommentController::class, 'update']);
    Route::delete('/inbox/comments/{comment}', [InboxCommentController::class, 'destroy']);

    Route::get('/inbox/tasks/{task}/attachments', [InboxTaskController::class, 'attachments']);
    Route::post('/inbox/tasks/{task}/attachments', [InboxTaskController::class, 'storeAttachment']);
    Route::delete('/inbox/attachments/{attachment}', [InboxTaskController::class, 'destroyAttachment']);

    Route::get('/inbox/tasks/{task}/dependencies', [InboxTaskController::class, 'dependencies']);
    Route::post('/inbox/tasks/{task}/dependencies', [InboxTaskController::class, 'storeDependency']);
    Route::delete('/inbox/dependencies/{dependency}', [InboxTaskController::class, 'destroyDependency']);

    // Release Candidates
    Route::get('/inbox/release-candidates', [InboxReleaseCandidateController::class, 'index']);
    Route::post('/inbox/release-candidates', [InboxReleaseCandidateController::class, 'store']);
    Route::get('/inbox/release-candidates/{releaseCandidate}', [InboxReleaseCandidateController::class, 'show']);
    Route::post('/inbox/release-candidates/{releaseCandidate}/transition', [InboxReleaseCandidateController::class, 'transition']);
    Route::post('/inbox/release-candidates/{releaseCandidate}/tasks', [InboxReleaseCandidateController::class, 'addTask']);
    Route::delete('/inbox/release-candidates/{releaseCandidate}/tasks', [InboxReleaseCandidateController::class, 'removeTask']);

    // Agents
    Route::get('/agents/dashboard', [AgentRegistrationController::class, 'dashboard']);
    Route::get('/agents', [AgentRegistrationController::class, 'index']);
    Route::post('/agents/register', [AgentRegistrationController::class, 'register']);
    Route::get('/agents/{agent}', [AgentRegistrationController::class, 'show']);
    Route::post('/agents/{agent}/deregister', [AgentRegistrationController::class, 'deregister']);
    Route::post('/agents/{agent}/heartbeat', [AgentRegistrationController::class, 'heartbeat']);

    // Execution Sessions
    Route::get('/sessions', [ExecutionSessionController::class, 'index']);
    Route::get('/sessions/{session}', [ExecutionSessionController::class, 'show']);
    Route::post('/sessions/{session}/progress', [ExecutionSessionController::class, 'updateProgress']);
    Route::post('/sessions/{session}/complete', [ExecutionSessionController::class, 'complete']);
    Route::post('/sessions/{session}/fail', [ExecutionSessionController::class, 'fail']);
    Route::post('/sessions/{session}/abort', [ExecutionSessionController::class, 'abort']);
    Route::post('/sessions/{session}/log', [ExecutionSessionController::class, 'appendLog']);
    Route::get('/sessions/{session}/artifacts', [ExecutionSessionController::class, 'artifacts']);
    Route::post('/sessions/{session}/artifacts', [ExecutionSessionController::class, 'uploadArtifact']);
});

/*
|--------------------------------------------------------------------------
| Driver Mobile OS — ADR-DIST-009
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Claude Bridge — UI-facing endpoints (Sanctum auth)
|--------------------------------------------------------------------------
*/
Route::middleware(['auth:sanctum', 'permission:claude_bridge.platform.manage'])->prefix('cb')->group(function (): void {
    Route::get('/dashboard', [CbDashboardController::class, 'show']);

    // Tasks
    Route::get('/tasks', [CbTaskController::class, 'index']);
    Route::post('/tasks', [CbTaskController::class, 'store']);
    Route::get('/tasks/{id}', [CbTaskController::class, 'show']);
    Route::patch('/tasks/{id}', [CbTaskController::class, 'update']);
    Route::post('/tasks/{id}/queue', [CbTaskController::class, 'queue']);
    Route::post('/tasks/{id}/cancel', [CbTaskController::class, 'cancel']);
    Route::post('/tasks/{id}/approve', [CbTaskController::class, 'approve']);
    Route::post('/tasks/{id}/request-changes', [CbTaskController::class, 'requestChanges']);
    Route::post('/tasks/{id}/mark-merged', [CbTaskController::class, 'markMerged']);
    Route::get('/tasks/{id}/log', [CbTaskController::class, 'log']);

    // Workers
    Route::get('/workers', [CbWorkerController::class, 'index']);
    Route::post('/workers', [CbWorkerController::class, 'store']);
    Route::delete('/workers/{id}', [CbWorkerController::class, 'destroy']);
    Route::post('/workers/{id}/regenerate-token', [CbWorkerController::class, 'regenerateToken']);

    // Artifacts
    Route::get('/artifacts/{id}/download', [CbArtifactController::class, 'download']);
});

/*
|--------------------------------------------------------------------------
| Claude Bridge — Worker-facing endpoints (bcrypt Bearer token auth)
|--------------------------------------------------------------------------
*/
Route::middleware(VerifyWorkerToken::class)->prefix('cb/worker')->group(function (): void {
    Route::post('/heartbeat', [CbWorkerApiController::class, 'heartbeat']);
    Route::get('/my-running-task', [CbWorkerApiController::class, 'myRunningTask']);
    Route::get('/tasks/next', [CbWorkerApiController::class, 'nextTask']);
    Route::post('/tasks/{id}/start', [CbWorkerApiController::class, 'startTask']);
    Route::post('/tasks/{id}/log-chunk', [CbWorkerApiController::class, 'logChunk']);
    Route::post('/tasks/{id}/artifact', [CbWorkerApiController::class, 'uploadArtifact']);
    Route::post('/tasks/{id}/complete', [CbWorkerApiController::class, 'completeTask']);
    Route::post('/tasks/{id}/fail', [CbWorkerApiController::class, 'failTask']);
});

// ─── Execution Cluster ───────────────────────────────────────────────────────
Route::prefix('system/engineering')->middleware(['auth:sanctum', 'throttle:60,1', 'permission:engineering.platform.manage'])->group(function () {

    // Workers
    Route::get('workers', [\Modules\System\Engineering\Presentation\Http\Controllers\WorkerController::class, 'index']);
    Route::post('workers', [\Modules\System\Engineering\Presentation\Http\Controllers\WorkerController::class, 'store']);
    Route::get('workers/{worker}', [\Modules\System\Engineering\Presentation\Http\Controllers\WorkerController::class, 'show']);
    Route::post('workers/{worker}/start', [\Modules\System\Engineering\Presentation\Http\Controllers\WorkerController::class, 'start']);
    Route::post('workers/{worker}/stop', [\Modules\System\Engineering\Presentation\Http\Controllers\WorkerController::class, 'stop']);
    Route::post('workers/{worker}/drain', [\Modules\System\Engineering\Presentation\Http\Controllers\WorkerController::class, 'drain']);
    Route::delete('workers/{worker}', [\Modules\System\Engineering\Presentation\Http\Controllers\WorkerController::class, 'destroy']);
    Route::post('workers/{worker}/heartbeat', [\Modules\System\Engineering\Presentation\Http\Controllers\WorkerController::class, 'heartbeat']);
    Route::get('workers/{worker}/sessions', [\Modules\System\Engineering\Presentation\Http\Controllers\WorkerController::class, 'sessions']);

    // Queue
    Route::get('queue', [\Modules\System\Engineering\Presentation\Http\Controllers\QueueController::class, 'index']);
    Route::post('queue/enqueue', [\Modules\System\Engineering\Presentation\Http\Controllers\QueueController::class, 'enqueue']);
    Route::get('queue/status', [\Modules\System\Engineering\Presentation\Http\Controllers\QueueController::class, 'status']);
    Route::post('queue/pause', [\Modules\System\Engineering\Presentation\Http\Controllers\QueueController::class, 'pause']);
    Route::post('queue/resume', [\Modules\System\Engineering\Presentation\Http\Controllers\QueueController::class, 'resume']);
    Route::post('queue/drain', [\Modules\System\Engineering\Presentation\Http\Controllers\QueueController::class, 'drain']);
    Route::post('queue/{entry}/cancel', [\Modules\System\Engineering\Presentation\Http\Controllers\QueueController::class, 'cancel']);
    Route::post('queue/{entry}/prioritize', [\Modules\System\Engineering\Presentation\Http\Controllers\QueueController::class, 'prioritize']);

    // Cluster
    Route::get('cluster/dashboard', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterController::class, 'dashboard']);
    Route::post('cluster/tick', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterController::class, 'tick']);
    Route::post('cluster/purge-locks', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterController::class, 'purgeExpiredLocks']);
    Route::post('cluster/recover-stale', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterController::class, 'recoverStaleWorkers']);

    // Health
    Route::get('cluster/health', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterHealthController::class, 'report']);
    Route::get('cluster/workers/{worker}/health', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterHealthController::class, 'workerHealth']);
    Route::post('cluster/workers/{worker}/recover', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterHealthController::class, 'recoverWorker']);

    // Metrics
    Route::get('cluster/metrics/snapshot', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterMetricsController::class, 'snapshot']);
    Route::get('cluster/metrics/trend', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterMetricsController::class, 'trend']);
    Route::get('cluster/metrics/timeseries', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterMetricsController::class, 'timeseries']);
    Route::delete('cluster/metrics/purge', [\Modules\System\Engineering\Presentation\Http\Controllers\ClusterMetricsController::class, 'purge']);
});

// ─── Release Orchestrator ───────────────────────────────────────────────────
Route::prefix('system/engineering')->middleware(['auth:sanctum', 'throttle:60,1', 'permission:engineering.platform.manage'])->group(function () {

    // Dashboard
    Route::get('releases/dashboard', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'dashboard']);

    // Release CRUD
    Route::get('releases', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'index']);
    Route::post('releases', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'store']);
    Route::get('releases/{release}', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'show']);
    Route::put('releases/{release}', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'update']);
    Route::delete('releases/{release}', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'destroy']);
    Route::post('releases/{release}/transition', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'transition']);
    Route::post('releases/{release}/clone', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'clone']);
    Route::post('releases/{release}/archive', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'archive']);
    Route::post('releases/{release}/tasks/add', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'addTasks']);
    Route::post('releases/{release}/tasks/remove', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'removeTasks']);

    // Validation & Readiness
    Route::post('releases/{release}/validate', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'validate']);
    Route::get('releases/{release}/readiness', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'readiness']);
    Route::post('releases/{release}/analyze-risks', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'analyzeRisks']);
    Route::post('releases/{release}/analyze-dependencies', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'analyzeDependencies']);
    Route::get('releases/{release}/audit', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseController::class, 'audit']);

    // Reports
    Route::get('releases/{release}/reports', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseReportController::class, 'index']);
    Route::post('releases/{release}/reports/generate', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseReportController::class, 'generate']);
    Route::get('releases/{release}/risks', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseReportController::class, 'risks']);
    Route::post('releases/{release}/risks/{risk}/accept', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseReportController::class, 'acceptRisk']);
    Route::get('releases/{release}/notes', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseReportController::class, 'notes']);
    Route::post('releases/{release}/notes', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseReportController::class, 'storeNote']);

    // Approvals
    Route::post('releases/{release}/approvals/initiate', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseApprovalController::class, 'initiate']);
    Route::get('releases/{release}/approvals/status', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseApprovalController::class, 'status']);
    Route::post('releases/{release}/approvals/{approval}/decide', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseApprovalController::class, 'decide']);
    Route::post('releases/{release}/approvals/{approval}/skip', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleaseApprovalController::class, 'skip']);

    // Pipeline
    Route::post('releases/{release}/pipeline/build', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleasePipelineController::class, 'build']);
    Route::post('releases/{release}/pipeline/trigger', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleasePipelineController::class, 'trigger']);
    Route::get('releases/{release}/pipeline/history', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleasePipelineController::class, 'history']);
    Route::post('releases/{release}/pipeline/{run}/result', [\Modules\System\Engineering\Presentation\Http\Controllers\ReleasePipelineController::class, 'captureResult']);
});

// ─── AI Engineering Supervisor (ENG-009) ────────────────────────────────────
Route::prefix('system/engineering')->middleware(['auth:sanctum', 'throttle:60,1', 'permission:engineering.platform.manage'])->group(function () {

    // AI Reviews
    Route::prefix('ai-reviews')->group(function () {
        Route::get('/', [AIReviewController::class, 'index']);
        Route::post('/', [AIReviewController::class, 'store']);
        Route::get('/dashboard', [AIReviewController::class, 'dashboard']);
        Route::get('/{id}', [AIReviewController::class, 'show']);
        Route::delete('/{id}', [AIReviewController::class, 'destroy']);
        Route::post('/{id}/run', [AIReviewController::class, 'run']);
        Route::post('/{id}/cancel', [AIReviewController::class, 'cancel']);
        Route::get('/{id}/results', [AIReviewController::class, 'results']);
        Route::get('/{id}/scores', [AIScoreController::class, 'forReview']);
        Route::get('/{id}/architecture-checks', [AIScoreController::class, 'architectureChecks']);
        Route::get('/{id}/security-checks', [AIScoreController::class, 'securityChecks']);
        Route::get('/{id}/risks', [AIRiskController::class, 'forReview']);
        Route::get('/{id}/risks/{riskId}', [AIRiskController::class, 'show']);
        Route::post('/{id}/risks/{riskId}/acknowledge', [AIRiskController::class, 'acknowledge']);
        Route::get('/{id}/recommendations', [AIRecommendationController::class, 'forReview']);
        Route::post('/{id}/recommendations/{recId}/resolve', [AIRecommendationController::class, 'resolve']);
    });

    // AI Supervisor Dashboard & Trends
    Route::prefix('ai-supervisor')->group(function () {
        Route::get('/dashboard', [AIDashboardController::class, 'index']);
        Route::get('/trends/daily', [AITrendController::class, 'daily']);
        Route::get('/trends/weekly', [AITrendController::class, 'weekly']);
        Route::get('/trends/monthly', [AITrendController::class, 'monthly']);
        Route::get('/trends/score', [AITrendController::class, 'scoreTrend']);
        Route::get('/learning/recurring-issues', [AITrendController::class, 'recurringIssues']);
        Route::get('/learning/patterns', [AITrendController::class, 'patterns']);
        Route::get('/metrics', [AITrendController::class, 'metrics']);
        Route::get('/recommendations/open', [AIRecommendationController::class, 'openForCompany']);
    });

    // AI Review hooks on Releases
    Route::prefix('releases')->group(function () {
        Route::post('/{releaseId}/ai-review', [AIReleaseReviewController::class, 'trigger']);
        Route::get('/{releaseId}/ai-review', [AIReleaseReviewController::class, 'show']);
        Route::get('/{releaseId}/ai-review/recommendation', [AIReleaseReviewController::class, 'recommendation']);
    });
});

// ─── AI Repair Platform (ENG-V2-001) ────────────────────────────────────────
Route::prefix('system/engineering')->middleware(['auth:sanctum', 'throttle:60,1', 'permission:engineering.platform.manage'])->group(function () {

    Route::prefix('repair')->group(function () {
        Route::get('/dashboard', [RepairDashboardController::class, 'index']);
        Route::prefix('sessions')->group(function () {
            Route::get('/', [RepairSessionController::class, 'index']);
            Route::post('/', [RepairSessionController::class, 'store']);
            Route::get('/{id}', [RepairSessionController::class, 'show']);
            Route::delete('/{id}', [RepairSessionController::class, 'destroy']);
            Route::post('/{id}/analyze', [RepairSessionController::class, 'analyze']);
            Route::post('/{id}/generate-prompt', [RepairSessionController::class, 'generatePrompt']);
            Route::get('/{id}/prompt-package', [RepairSessionController::class, 'getPromptPackage']);
            Route::post('/{id}/response', [RepairSessionController::class, 'submitResponse']);
            Route::post('/{id}/patches/{patchId}/apply', [RepairSessionController::class, 'applyPatch']);
            Route::post('/{id}/complete', [RepairSessionController::class, 'complete']);
            Route::post('/{id}/fail', [RepairSessionController::class, 'fail']);
            Route::post('/{id}/cancel', [RepairSessionController::class, 'cancel']);
            Route::post('/{id}/retry', [RepairSessionController::class, 'retry']);
            Route::get('/{id}/history', [RepairSessionController::class, 'history']);
            Route::get('/{id}/prompts', [RepairPromptController::class, 'forSession']);
            Route::get('/{id}/prompts/active', [RepairPromptController::class, 'active']);
            Route::post('/{id}/prompts/{promptId}/mark-sent', [RepairPromptController::class, 'markSent']);
            Route::get('/{id}/responses', [RepairResponseController::class, 'forSession']);
            Route::post('/{id}/responses/{responseId}/review', [RepairResponseController::class, 'review']);
            Route::get('/{id}/patches', [RepairPatchController::class, 'forSession']);
        });

        // Self-Healing Pipeline (ENG-V2-002)
        Route::prefix('patches')->group(function () {
            Route::post('/{patchId}/validate', [PatchValidationController::class, 'validatePatch']);
            Route::post('/{patchId}/revalidate', [PatchValidationController::class, 'revalidate']);
            Route::get('/{patchId}/validations', [PatchValidationController::class, 'forPatch']);
            Route::get('/{patchId}/validations/latest', [PatchValidationController::class, 'latest']);
            Route::get('/{patchId}/reports', [ValidationReportController::class, 'forPatch']);
            Route::get('/{patchId}/snapshots', [PatchRollbackController::class, 'snapshots']);
            Route::post('/{patchId}/rollback', [PatchRollbackController::class, 'rollback']);
        });
        Route::prefix('validations')->group(function () {
            Route::get('/{id}', [PatchValidationController::class, 'show']);
            Route::get('/{id}/steps', [PatchValidationController::class, 'steps']);
            Route::post('/{id}/cancel', [PatchValidationController::class, 'cancel']);
            Route::get('/{id}/report', [ValidationReportController::class, 'forValidation']);
        });
    });

    // Autonomous Engineering Guardian (ENG-V2-003)
    Route::prefix('guardian')->group(function () {
        Route::get('/dashboard', [GuardianDashboardController::class, 'index']);
        Route::prefix('runs')->group(function () {
            Route::get('/', [GuardianRunController::class, 'index']);
            Route::post('/', [GuardianRunController::class, 'evaluate']);
            Route::get('/{id}', [GuardianRunController::class, 'show']);
            Route::get('/{id}/checks', [GuardianRunController::class, 'checks']);
            Route::get('/{id}/decision', [GuardianRunController::class, 'decision']);
            Route::get('/{id}/report', [GuardianRunController::class, 'report']);
            Route::post('/{id}/revalidate', [GuardianRunController::class, 'revalidate']);
            Route::post('/{id}/cancel', [GuardianRunController::class, 'cancel']);
        });
        Route::prefix('policies')->group(function () {
            Route::get('/', [GuardianPolicyController::class, 'index']);
            Route::get('/active', [GuardianPolicyController::class, 'active']);
            Route::post('/', [GuardianPolicyController::class, 'store']);
            Route::patch('/{id}', [GuardianPolicyController::class, 'update']);
            Route::post('/{id}/activate', [GuardianPolicyController::class, 'activate']);
            Route::post('/{id}/deactivate', [GuardianPolicyController::class, 'deactivate']);
            Route::delete('/{id}', [GuardianPolicyController::class, 'destroy']);
        });
    });

    // Engineering Intelligence Platform (ENG-V2-004) — read-only analytics
    Route::prefix('intelligence')->group(function () {
        Route::get('/analytics/overview', [IntelAnalyticsController::class, 'overview']);
        Route::get('/analytics/validators', [IntelAnalyticsController::class, 'validators']);
        Route::get('/analytics/trends', [IntelAnalyticsController::class, 'trends']);
        Route::get('/analytics/debt', [IntelAnalyticsController::class, 'debt']);
        Route::get('/analytics/compare-periods', [IntelAnalyticsController::class, 'comparePeriods']);
        Route::post('/analytics/compare-releases', [IntelAnalyticsController::class, 'compareReleases']);
        Route::post('/analytics/snapshots', [IntelAnalyticsController::class, 'snapshot']);
        Route::get('/analytics/snapshots', [IntelAnalyticsController::class, 'snapshots']);
        Route::get('/knowledge', [IntelKnowledgeController::class, 'index']);
        Route::post('/knowledge/learn', [IntelKnowledgeController::class, 'learn']);
        Route::get('/knowledge/patterns', [IntelKnowledgeController::class, 'patterns']);
        Route::get('/knowledge/recommendations', [IntelKnowledgeController::class, 'recommendations']);
        Route::get('/knowledge/confidence', [IntelKnowledgeController::class, 'confidence']);
        Route::get('/insights', [IntelInsightsController::class, 'index']);
        Route::post('/insights/generate', [IntelInsightsController::class, 'generate']);
        Route::post('/insights/{id}/acknowledge', [IntelInsightsController::class, 'acknowledge']);
        Route::get('/predictions', [IntelInsightsController::class, 'predictions']);
    });

    // Enterprise Engineering Workspace (ENG-V2-005) — visualization only
    Route::prefix('workspace')->group(function () {
        Route::get('/executive', [WorkspaceController::class, 'executive']);
        Route::get('/live', [WorkspaceController::class, 'live']);
        Route::get('/timeline', [WorkspaceController::class, 'timeline']);
        Route::get('/search', [WorkspaceController::class, 'search']);
        Route::get('/release-readiness', [WorkspaceController::class, 'releaseReadiness']);
        Route::get('/export', [WorkspaceController::class, 'export']);
        Route::prefix('views')->group(function () {
            Route::get('/', [WorkspaceViewController::class, 'index']);
            Route::post('/', [WorkspaceViewController::class, 'store']);
            Route::patch('/{id}', [WorkspaceViewController::class, 'update']);
            Route::delete('/{id}', [WorkspaceViewController::class, 'destroy']);
        });
    });
});

// ── CRM & Customer Service OS — EPIC C1 · Customer Foundation ──────────────────
// The single source of truth for customer identity. Commerce, Finance, Logistics
// and Marketing REFERENCE the customer; they never duplicate it. Permissions use
// the existing crm.customers.* namespace; merge and archive are their own gates.
Route::middleware('auth:sanctum')->prefix('crm/customers')->group(function (): void {

    // Groups.
    Route::prefix('groups')->group(function (): void {
        Route::get('/', [CrmCustomerGroupController::class, 'index'])->middleware('permission:crm.customers.view');
        Route::post('/', [CrmCustomerGroupController::class, 'store'])->middleware('permission:crm.customers.update');
    });

    // Duplicate detection & merge.
    Route::post('/detect-duplicates', [CrmCustomerMergeController::class, 'detect'])->middleware('permission:crm.customers.view');
    Route::post('/merge', [CrmCustomerMergeController::class, 'merge'])->middleware('permission:crm.customers.merge');

    // Master.
    Route::middleware('permission:crm.customers.view')->group(function (): void {
        Route::get('/', [CrmCustomerController::class, 'index']);
        Route::get('/{id}', [CrmCustomerController::class, 'show']);
        Route::get('/{id}/profile', [CrmCustomerController::class, 'profile']);
        Route::get('/{id}/duplicates', [CrmCustomerMergeController::class, 'duplicates']);
    });
    Route::post('/', [CrmCustomerController::class, 'store'])->middleware('permission:crm.customers.create');
    Route::patch('/{id}', [CrmCustomerController::class, 'update'])->middleware('permission:crm.customers.update');
    Route::patch('/{id}/status', [CrmCustomerController::class, 'setStatus'])->middleware('permission:crm.customers.update');
    Route::patch('/{id}/archive', [CrmCustomerController::class, 'archive'])->middleware('permission:crm.customers.archive');

    // Sub-resources (edit authority).
    Route::middleware('permission:crm.customers.update')->group(function (): void {
        Route::post('/{id}/phones', [CrmCustomerContactController::class, 'addPhone']);
        Route::post('/{id}/emails', [CrmCustomerContactController::class, 'addEmail']);
        Route::post('/{id}/addresses', [CrmCustomerContactController::class, 'addAddress']);
        Route::patch('/{id}/addresses/{addressId}/default', [CrmCustomerContactController::class, 'setDefaultAddress']);
        Route::post('/{id}/tags', [CrmCustomerContactController::class, 'assignTag']);
        Route::delete('/{id}/tags/{tagId}', [CrmCustomerContactController::class, 'removeTag']);
        Route::post('/{id}/notes', [CrmCustomerContactController::class, 'addNote']);
        Route::post('/{id}/documents', [CrmCustomerContactController::class, 'addDocument']);
        Route::put('/{id}/preferences', [CrmCustomerContactController::class, 'setPreference']);
    });
});

// ── CRM & Customer Service OS — EPIC C2 · Customer Engagement ──────────────────
// The append-only customer timeline. The CRM owns its activities & tasks and
// READS every other interaction (conversations, orders, notes) live from the
// existing systems — no duplicated business data. All view endpoints use
// crm.engagement.view; logging and task management have their own authorities.
Route::middleware('auth:sanctum')->prefix('crm/customers/{id}')->group(function (): void {

    // Timeline, interaction history, omnichannel feed, journey (read-only).
    Route::middleware('permission:crm.engagement.view')->group(function (): void {
        Route::get('/timeline', [CrmTimelineController::class, 'timeline']);
        Route::get('/interactions', [CrmTimelineController::class, 'interactions']);
        Route::get('/feed', [CrmTimelineController::class, 'feed']);
        Route::get('/journey', [CrmTimelineController::class, 'journey']);
        Route::get('/activities', [CrmActivityController::class, 'index']);
        Route::get('/tasks', [CrmTaskController::class, 'index']);
    });

    // Log activities (append-only).
    Route::post('/activities', [CrmActivityController::class, 'log'])->middleware('permission:crm.engagement.log');

    // Tasks / follow-ups / appointments / meetings.
    Route::middleware('permission:crm.engagement.task.manage')->group(function (): void {
        Route::post('/tasks', [CrmTaskController::class, 'store']);
        Route::patch('/tasks/{taskId}/complete', [CrmTaskController::class, 'complete']);
        Route::patch('/tasks/{taskId}/cancel', [CrmTaskController::class, 'cancel']);
    });
});

// ── CRM & Customer Service OS — EPIC C3 · Customer Service ─────────────────────
// The CRM owns service cases (tickets, complaints, service requests, RMA
// returns, warranty). It references Finance/Inventory/Shipping BY REFERENCE ONLY
// (opaque ids in source_reference) — it owns none of their data.
Route::middleware('auth:sanctum')->prefix('crm/service')->group(function (): void {

    // Tickets.
    Route::prefix('tickets')->group(function (): void {
        Route::middleware('permission:crm.service.view')->group(function (): void {
            Route::get('/', [CrmTicketController::class, 'index']);
            Route::get('/{id}', [CrmTicketController::class, 'show']);
        });
        Route::post('/', [CrmTicketController::class, 'store'])->middleware('permission:crm.service.manage');
        Route::middleware('permission:crm.service.manage')->group(function (): void {
            Route::post('/{id}/notes', [CrmTicketNoteController::class, 'addNote']);
            Route::post('/{id}/attachments', [CrmTicketNoteController::class, 'addAttachment']);
            Route::post('/{id}/resolution', [CrmResolutionLibraryController::class, 'apply']);
        });
        Route::patch('/{id}/transition', [CrmTicketController::class, 'transition'])->middleware('permission:crm.service.resolve');
        Route::patch('/{id}/assign', [CrmTicketController::class, 'assign'])->middleware('permission:crm.service.assign');
        Route::patch('/{id}/escalate', [CrmTicketController::class, 'escalate'])->middleware('permission:crm.service.assign');
    });

    // SLA / assignment / escalation administration + the escalation sweep.
    Route::middleware('permission:crm.service.admin')->group(function (): void {
        Route::get('/sla-policies', [CrmServiceAdminController::class, 'slaPolicies']);
        Route::post('/sla-policies', [CrmServiceAdminController::class, 'storeSlaPolicy']);
        Route::get('/assignment-rules', [CrmServiceAdminController::class, 'assignmentRules']);
        Route::post('/assignment-rules', [CrmServiceAdminController::class, 'storeAssignmentRule']);
        Route::get('/escalation-rules', [CrmServiceAdminController::class, 'escalationRules']);
        Route::post('/escalation-rules', [CrmServiceAdminController::class, 'storeEscalationRule']);
        Route::post('/escalations/run', [CrmServiceAdminController::class, 'runEscalation']);
    });

    // Resolution library.
    Route::prefix('resolutions')->group(function (): void {
        Route::get('/', [CrmResolutionLibraryController::class, 'index'])->middleware('permission:crm.kb.view');
        Route::post('/', [CrmResolutionLibraryController::class, 'store'])->middleware('permission:crm.kb.manage');
    });
});

// Knowledge base.
Route::middleware('auth:sanctum')->prefix('crm/knowledge-base')->group(function (): void {
    Route::middleware('permission:crm.kb.view')->group(function (): void {
        Route::get('/', [CrmKnowledgeBaseController::class, 'index']);
        Route::get('/{id}', [CrmKnowledgeBaseController::class, 'show']);
    });
    Route::middleware('permission:crm.kb.manage')->group(function (): void {
        Route::post('/', [CrmKnowledgeBaseController::class, 'store']);
        Route::patch('/{id}/publish', [CrmKnowledgeBaseController::class, 'publish']);
        Route::patch('/{id}/archive', [CrmKnowledgeBaseController::class, 'archive']);
    });
});

// ── CRM & Customer Service OS — EPIC C4 · Sales & Loyalty ──────────────────────
// The CRM owns the sales relationship (leads, opportunities, pipeline, quotes)
// and the loyalty program (points, tiers, rewards, wallet). Commerce owns Orders
// and Finance owns Payments — both referenced by opaque id only.
Route::middleware('auth:sanctum')->prefix('crm/sales')->group(function (): void {

    // Leads.
    Route::prefix('leads')->group(function (): void {
        Route::middleware('permission:crm.sales.view')->group(function (): void {
            Route::get('/', [CrmLeadController::class, 'index']);
            Route::get('/{id}', [CrmLeadController::class, 'show']);
        });
        Route::post('/', [CrmLeadController::class, 'store'])->middleware('permission:crm.sales.manage');
        Route::patch('/{id}/status', [CrmLeadController::class, 'setStatus'])->middleware('permission:crm.sales.manage');
        Route::post('/{id}/convert', [CrmLeadController::class, 'convert'])->middleware('permission:crm.sales.convert');
    });

    // Opportunities & pipeline.
    Route::prefix('opportunities')->group(function (): void {
        Route::middleware('permission:crm.sales.view')->group(function (): void {
            Route::get('/', [CrmOpportunityController::class, 'index']);
            Route::get('/forecast', [CrmOpportunityController::class, 'forecast']);
        });
        Route::post('/', [CrmOpportunityController::class, 'store'])->middleware('permission:crm.sales.manage');
        Route::patch('/{id}/stage', [CrmOpportunityController::class, 'moveStage'])->middleware('permission:crm.sales.manage');
        Route::patch('/{id}/win', [CrmOpportunityController::class, 'win'])->middleware('permission:crm.sales.convert');
        Route::patch('/{id}/lose', [CrmOpportunityController::class, 'lose'])->middleware('permission:crm.sales.convert');
        Route::patch('/{id}/reopen', [CrmOpportunityController::class, 'reopen'])->middleware('permission:crm.sales.convert');
    });
    Route::get('/pipelines', [CrmPipelineController::class, 'index'])->middleware('permission:crm.sales.view');
    Route::post('/pipelines', [CrmPipelineController::class, 'store'])->middleware('permission:crm.sales.manage');

    // Quotes.
    Route::prefix('quotes')->group(function (): void {
        Route::middleware('permission:crm.sales.view')->group(function (): void {
            Route::get('/', [CrmQuoteController::class, 'index']);
            Route::get('/{id}', [CrmQuoteController::class, 'show']);
        });
        Route::middleware('permission:crm.sales.manage')->group(function (): void {
            Route::post('/', [CrmQuoteController::class, 'store']);
            Route::patch('/{id}/send', [CrmQuoteController::class, 'send']);
            Route::patch('/{id}/accept', [CrmQuoteController::class, 'accept']);
            Route::patch('/{id}/reject', [CrmQuoteController::class, 'reject']);
        });
    });

    // Sales activities, reminders & follow-ups.
    Route::prefix('activities')->group(function (): void {
        Route::middleware('permission:crm.sales.view')->group(function (): void {
            Route::get('/', [CrmSalesActivityController::class, 'index']);
            Route::get('/due', [CrmSalesActivityController::class, 'due']);
        });
        Route::middleware('permission:crm.sales.manage')->group(function (): void {
            Route::post('/', [CrmSalesActivityController::class, 'store']);
            Route::patch('/{id}/complete', [CrmSalesActivityController::class, 'complete']);
            Route::patch('/{id}/cancel', [CrmSalesActivityController::class, 'cancel']);
        });
    });
});

// Loyalty.
Route::middleware('auth:sanctum')->prefix('crm/loyalty')->group(function (): void {
    Route::middleware('permission:crm.loyalty.view')->group(function (): void {
        Route::get('/programs', [CrmLoyaltyController::class, 'programs']);
        Route::get('/rewards', [CrmRewardController::class, 'index']);
        Route::get('/accounts/{accountId}/wallet', [CrmLoyaltyController::class, 'wallet']);
        Route::get('/accounts/{accountId}/history', [CrmLoyaltyController::class, 'history']);
    });
    Route::middleware('permission:crm.loyalty.manage')->group(function (): void {
        Route::post('/programs', [CrmLoyaltyController::class, 'storeProgram']);
        Route::post('/enroll', [CrmLoyaltyController::class, 'enroll']);
        Route::post('/rewards', [CrmRewardController::class, 'store']);
    });
    Route::middleware('permission:crm.loyalty.transact')->group(function (): void {
        Route::post('/accounts/{accountId}/earn', [CrmPointsController::class, 'earn']);
        Route::post('/accounts/{accountId}/redeem', [CrmPointsController::class, 'redeem']);
        Route::post('/accounts/{accountId}/adjust', [CrmPointsController::class, 'adjust']);
        Route::post('/rewards/redeem', [CrmRewardController::class, 'redeem']);
    });
});

/*
|--------------------------------------------------------------------------
| CRM & Customer Service OS — EPIC C5. Customer Intelligence.
|--------------------------------------------------------------------------
| Deterministic, explainable analytics over purchase facts fed by opaque
| reference. Commerce owns Orders and Finance owns Payments — referenced only.
*/
Route::middleware('auth:sanctum')->prefix('crm/intelligence')->group(function (): void {
    Route::middleware('permission:crm.intelligence.view')->group(function (): void {
        Route::get('/profiles', [CrmIntelligenceController::class, 'index']);
        Route::get('/customers/{customerId}', [CrmIntelligenceController::class, 'show']);
        Route::get('/customers/{customerId}/facts', [CrmPurchaseFactController::class, 'index']);
        Route::get('/customers/{customerId}/recommendations', [CrmRecommendationController::class, 'forCustomer']);
        Route::get('/segments', [CrmSegmentationController::class, 'index']);
        Route::get('/segments/distribution', [CrmSegmentationController::class, 'distribution']);
        Route::get('/analytics', [CrmAnalyticsController::class, 'overview']);
        Route::get('/retention', [CrmAnalyticsController::class, 'retention']);
        Route::get('/recommendations', [CrmRecommendationController::class, 'index']);
    });
    Route::middleware('permission:crm.intelligence.ingest')->group(function (): void {
        Route::post('/facts', [CrmPurchaseFactController::class, 'store']);
        Route::patch('/recommendations/{id}/status', [CrmRecommendationController::class, 'updateStatus']);
    });
    Route::middleware('permission:crm.intelligence.recompute')->group(function (): void {
        Route::post('/customers/{customerId}/recompute', [CrmIntelligenceController::class, 'recompute']);
        Route::post('/recompute', [CrmIntelligenceController::class, 'recomputeAll']);
    });
});

/*
|--------------------------------------------------------------------------
| CRM & Customer Service OS — EPIC C6. Executive Workspace.
|--------------------------------------------------------------------------
| Read-only and derived only — every route here is a GET. The workspace owns no
| tables and performs no operational, Finance or Commerce writes.
*/
Route::middleware('auth:sanctum')->prefix('crm/executive')->group(function (): void {
    Route::middleware('permission:crm.executive.view')->group(function (): void {
        Route::get('/dashboard', [CrmExecutiveDashboardController::class, 'overview']);
        Route::get('/kpis', [CrmExecutiveDashboardController::class, 'kpis']);
        Route::get('/growth', [CrmExecutiveDashboardController::class, 'growth']);
        Route::get('/retention', [CrmExecutiveDashboardController::class, 'retention']);
        Route::get('/lifetime-value', [CrmExecutiveDashboardController::class, 'lifetimeValue']);
        Route::get('/satisfaction', [CrmExecutiveDashboardController::class, 'satisfaction']);
        Route::get('/performance/service', [CrmExecutivePerformanceController::class, 'service']);
        Route::get('/performance/sales', [CrmExecutivePerformanceController::class, 'sales']);
        Route::get('/performance/loyalty', [CrmExecutivePerformanceController::class, 'loyalty']);
    });
    Route::middleware('permission:crm.executive.report')->group(function (): void {
        Route::get('/reports/monthly', [CrmExecutiveReportController::class, 'monthly']);
        Route::get('/reports/quarterly', [CrmExecutiveReportController::class, 'quarterly']);
        Route::get('/reports/annual', [CrmExecutiveReportController::class, 'annual']);
        Route::get('/reports/generate', [CrmExecutiveReportController::class, 'generate']);
    });
    Route::middleware('permission:crm.executive.export')->group(function (): void {
        Route::get('/reports/export', [CrmExecutiveReportController::class, 'export']);
    });
});

/*
|--------------------------------------------------------------------------
| HR & Workforce OS — EPIC H1. Organization & Workforce Foundation.
|--------------------------------------------------------------------------
| The employee master, the structure around it, contracts and reporting lines.
| Companies and branches are owned by the Organization module and referenced here.
*/
Route::middleware('auth:sanctum')->prefix('hr')->group(function (): void {
    // Structure — departments, positions, job grades, employment types.
    Route::middleware('permission:hr.workforce.view')->group(function (): void {
        Route::get('/departments', [HrStructureController::class, 'departments']);
        Route::get('/departments/tree', [HrStructureController::class, 'departmentTree']);
        Route::get('/positions', [HrStructureController::class, 'positions']);
        Route::get('/job-grades', [HrStructureController::class, 'jobGrades']);
        Route::get('/employment-types', [HrStructureController::class, 'employmentTypes']);
    });
    Route::middleware('permission:hr.workforce.manage')->group(function (): void {
        Route::post('/departments', [HrStructureController::class, 'storeDepartment']);
        Route::put('/departments/{id}', [HrStructureController::class, 'updateDepartment']);
        Route::post('/positions', [HrStructureController::class, 'storePosition']);
        Route::put('/positions/{id}', [HrStructureController::class, 'updatePosition']);
        Route::post('/job-grades', [HrStructureController::class, 'storeJobGrade']);
        Route::put('/job-grades/{id}', [HrStructureController::class, 'updateJobGrade']);
        Route::post('/employment-types', [HrStructureController::class, 'storeEmploymentType']);
    });

    // Employees — the workforce single source of truth.
    Route::middleware('permission:hr.employees.view')->group(function (): void {
        Route::get('/employees', [HrEmployeeController::class, 'index']);
        Route::get('/employees/next-number', [HrEmployeeController::class, 'nextNumber']);
        Route::get('/employees/{id}', [HrEmployeeController::class, 'show']);
        Route::get('/employees/{id}/overview', [HrEmployeeController::class, 'overview']);
        Route::get('/employees/{employeeId}/documents', [HrDocumentController::class, 'index']);
        Route::get('/documents/expiring', [HrDocumentController::class, 'expiring']);
    });
    Route::middleware('permission:hr.employees.manage')->group(function (): void {
        Route::post('/employees', [HrEmployeeController::class, 'store']);
        Route::put('/employees/{id}', [HrEmployeeController::class, 'update']);
        Route::patch('/employees/{id}/transfer', [HrEmployeeController::class, 'transfer']);
        Route::patch('/employees/{id}/status', [HrEmployeeController::class, 'changeStatus']);
        Route::patch('/employees/{id}/terminate', [HrEmployeeController::class, 'terminate']);
        Route::post('/employees/{employeeId}/documents', [HrDocumentController::class, 'store']);
        Route::delete('/employees/{employeeId}/documents/{id}', [HrDocumentController::class, 'destroy']);
    });

    // Employment contracts.
    Route::middleware('permission:hr.contracts.view')->group(function (): void {
        Route::get('/contracts', [HrContractController::class, 'index']);
        Route::get('/contracts/expiring', [HrContractController::class, 'expiring']);
    });
    Route::middleware('permission:hr.contracts.manage')->group(function (): void {
        Route::post('/contracts', [HrContractController::class, 'store']);
        Route::patch('/contracts/{id}/activate', [HrContractController::class, 'activate']);
        Route::patch('/contracts/{id}/terminate', [HrContractController::class, 'terminate']);
        Route::patch('/contracts/{id}/expire', [HrContractController::class, 'expire']);
    });

    // Organisation chart and reporting lines.
    Route::middleware('permission:hr.org.view')->group(function (): void {
        Route::get('/organization-chart', [HrOrgChartController::class, 'chart']);
        Route::get('/employees/{employeeId}/reporting-lines', [HrOrgChartController::class, 'linesFor']);
    });
    Route::middleware('permission:hr.org.manage')->group(function (): void {
        Route::post('/employees/{employeeId}/reporting-lines', [HrOrgChartController::class, 'assignManager']);
        Route::patch('/reporting-lines/{id}/end', [HrOrgChartController::class, 'endLine']);
    });
});

/*
|--------------------------------------------------------------------------
| HR & Workforce OS — EPIC H2. Attendance & Workforce Availability.
|--------------------------------------------------------------------------
| Manual registration only — no device capture of any kind. No overtime, no
| compensatory time, no leave balances: attendance stays simple and operational.
*/
Route::middleware('auth:sanctum')->prefix('hr/attendance')->group(function (): void {
    Route::middleware('permission:hr.attendance.view')->group(function (): void {
        Route::get('/sheet', [HrAttendanceController::class, 'sheet']);
        Route::get('/days', [HrAttendanceController::class, 'index']);
        Route::get('/availability', [HrAvailabilityController::class, 'today']);
        Route::get('/availability/departments', [HrAvailabilityController::class, 'byDepartment']);
        Route::get('/availability/departments/{departmentId}/trend', [HrAvailabilityController::class, 'departmentTrend']);
        Route::get('/calendars', [HrScheduleController::class, 'calendars']);
        Route::get('/shifts', [HrScheduleController::class, 'shifts']);
        Route::get('/holidays', [HrScheduleController::class, 'holidays']);
    });
    Route::middleware('permission:hr.attendance.register')->group(function (): void {
        Route::post('/register', [HrAttendanceController::class, 'register']);
        Route::post('/register-many', [HrAttendanceController::class, 'registerMany']);
        Route::post('/calendars', [HrScheduleController::class, 'storeCalendar']);
        Route::put('/calendars/{id}', [HrScheduleController::class, 'updateCalendar']);
        Route::post('/shifts', [HrScheduleController::class, 'storeShift']);
        Route::put('/shifts/{id}', [HrScheduleController::class, 'updateShift']);
        Route::post('/employees/{employeeId}/shift', [HrScheduleController::class, 'assignShift']);
        Route::post('/holidays', [HrScheduleController::class, 'storeHoliday']);
        Route::put('/holidays/{id}', [HrScheduleController::class, 'updateHoliday']);
        Route::delete('/holidays/{id}', [HrScheduleController::class, 'destroyHoliday']);
    });
});

Route::middleware('auth:sanctum')->prefix('hr/leave')->group(function (): void {
    Route::middleware('permission:hr.leave.view')->group(function (): void {
        Route::get('/requests', [HrLeaveController::class, 'index']);
        Route::get('/requests/pending', [HrLeaveController::class, 'pending']);
    });
    Route::middleware('permission:hr.leave.request')->group(function (): void {
        Route::post('/requests', [HrLeaveController::class, 'store']);
        Route::patch('/requests/{id}/cancel', [HrLeaveController::class, 'cancel']);
    });
    Route::middleware('permission:hr.leave.approve')->group(function (): void {
        Route::patch('/requests/{id}/approve', [HrLeaveController::class, 'approve']);
        Route::patch('/requests/{id}/reject', [HrLeaveController::class, 'reject']);
    });
});

/*
|--------------------------------------------------------------------------
| HR & Workforce OS — EPIC H3. Compensation Engine.
|--------------------------------------------------------------------------
| Payroll calculates compensation. Finance owns the journal entries and the
| salary payment; approving a run announces the totals and stops there.
| Entering, approving and running payroll are separate permissions on purpose.
*/
Route::middleware('auth:sanctum')->prefix('hr/compensation')->group(function (): void {
    Route::middleware('permission:hr.compensation.view')->group(function (): void {
        Route::get('/periods', [HrPayrollController::class, 'periods']);
        Route::get('/runs', [HrPayrollController::class, 'runs']);
        Route::get('/payslips', [HrPayrollController::class, 'payslips']);
        Route::get('/payslips/{id}', [HrPayrollController::class, 'payslip']);
        Route::get('/employees/{employeeId}/overview', [HrCompensationController::class, 'overview']);
        Route::get('/bonuses', [HrCompensationController::class, 'bonuses']);
        Route::get('/deductions', [HrCompensationController::class, 'deductions']);
        Route::get('/advances', [HrCompensationController::class, 'advances']);
        Route::get('/periods/{id}/employees/{employeeId}/attendance-suggestions', [HrPayrollController::class, 'attendanceSuggestions']);
    });
    Route::middleware('permission:hr.compensation.manage')->group(function (): void {
        Route::post('/periods', [HrPayrollController::class, 'storePeriod']);
        Route::patch('/periods/{id}/open', [HrPayrollController::class, 'openPeriod']);
        Route::post('/employees/{employeeId}/salary', [HrCompensationController::class, 'assignSalary']);
        Route::post('/bonuses', [HrCompensationController::class, 'storeBonus']);
        Route::post('/deductions', [HrCompensationController::class, 'storeDeduction']);
        Route::post('/advances', [HrCompensationController::class, 'storeAdvance']);
    });
    Route::middleware('permission:hr.compensation.calculate')->group(function (): void {
        Route::post('/periods/{id}/calculate', [HrPayrollController::class, 'calculate']);
    });
    Route::middleware('permission:hr.compensation.approve')->group(function (): void {
        Route::patch('/runs/{runId}/approve', [HrPayrollController::class, 'approveRun']);
        Route::patch('/periods/{id}/close', [HrPayrollController::class, 'closePeriod']);
        Route::patch('/bonuses/{id}/decide', [HrCompensationController::class, 'decideBonus']);
        Route::patch('/deductions/{id}/decide', [HrCompensationController::class, 'decideDeduction']);
        Route::patch('/advances/{id}/decide', [HrCompensationController::class, 'decideAdvance']);
    });
});

/*
|--------------------------------------------------------------------------
| HR & Workforce OS — EPIC H3. Commission rules engine.
|--------------------------------------------------------------------------
| Rules are configuration: which metric, which method, what rate, for whom.
*/
Route::middleware('auth:sanctum')->prefix('hr/commission')->group(function (): void {
    Route::middleware('permission:hr.commission.view')->group(function (): void {
        Route::get('/rules', [HrCommissionController::class, 'index']);
        Route::get('/metrics', [HrCommissionController::class, 'metrics']);
        Route::get('/employees/{employeeId}/preview', [HrCommissionController::class, 'preview']);
    });
    Route::middleware('permission:hr.commission.manage')->group(function (): void {
        Route::post('/rules', [HrCommissionController::class, 'store']);
        Route::put('/rules/{id}', [HrCommissionController::class, 'update']);
    });
});

/*
|--------------------------------------------------------------------------
| HR & Workforce OS — EPIC H4. KPI facts, goals, dashboards and reviews.
|--------------------------------------------------------------------------
| KPIs are collected from the operational modules by reference; nobody types in
| their own score. HR imports no operational class to do it.
*/
Route::middleware('auth:sanctum')->prefix('hr/kpi')->group(function (): void {
    Route::middleware('permission:hr.performance.view')->group(function (): void {
        Route::get('/facts', [HrKpiFactController::class, 'index']);
    });
    Route::middleware('permission:hr.kpi.ingest')->group(function (): void {
        Route::post('/facts', [HrKpiFactController::class, 'store']);
        Route::post('/facts/batch', [HrKpiFactController::class, 'storeMany']);
    });
});

Route::middleware('auth:sanctum')->prefix('hr/performance')->group(function (): void {
    Route::middleware('permission:hr.performance.view')->group(function (): void {
        Route::get('/goals', [HrPerformanceController::class, 'goals']);
        Route::get('/metrics', [HrPerformanceController::class, 'metrics']);
        Route::get('/employees/{employeeId}/dashboard', [HrPerformanceController::class, 'employeeDashboard']);
        Route::get('/employees/{employeeId}/history', [HrPerformanceController::class, 'history']);
        Route::get('/departments/{departmentId}/dashboard', [HrPerformanceController::class, 'departmentDashboard']);
        Route::get('/reviews', [HrReviewController::class, 'reviews']);
        Route::get('/recommendations', [HrReviewController::class, 'recommendations']);
        Route::get('/incidents', [HrReviewController::class, 'incidents']);
    });
    Route::middleware('permission:hr.performance.manage')->group(function (): void {
        Route::post('/goals', [HrPerformanceController::class, 'storeGoal']);
        Route::post('/evaluate', [HrPerformanceController::class, 'evaluate']);
        Route::post('/incidents', [HrReviewController::class, 'storeIncident']);
        Route::post('/incidents/{id}/deduction', [HrReviewController::class, 'raiseDeduction']);
    });
    Route::middleware('permission:hr.performance.review')->group(function (): void {
        Route::post('/employees/{employeeId}/review', [HrReviewController::class, 'saveReview']);
        Route::post('/recommendations/generate', [HrReviewController::class, 'generateRecommendations']);
        Route::patch('/recommendations/{id}/decide', [HrReviewController::class, 'decideRecommendation']);
    });
});

/*
|--------------------------------------------------------------------------
| HR & Workforce OS — EPIC H5. THE PUBLIC CAREERS PORTAL.
|--------------------------------------------------------------------------
| ⚠ THE ONLY UNAUTHENTICATED ROUTES IN THE APPLICATION.
|
| Anyone on the internet can reach these three endpoints, so they are throttled
| at the route — reads generously, the write tightly, because submitting an
| application is what costs storage and creates records. Everything they return
| is whitelisted field by field in the controller, and the write path can create
| an applicant and an application and nothing else.
|
| Adding a route to this group puts it on the public internet. Do not.
*/
Route::prefix('careers')->group(function (): void {
    Route::middleware('throttle:60,1')->group(function (): void {
        Route::get('/jobs', [HrPublicCareersController::class, 'jobs']);
        Route::get('/jobs/{slug}', [HrPublicCareersController::class, 'job']);
    });

    // Five submissions a minute from one address is generous for a human and
    // useless for a script.
    Route::middleware('throttle:5,1')->group(function (): void {
        Route::post('/jobs/{slug}/apply', [HrPublicCareersController::class, 'apply']);
    });
});

/*
|--------------------------------------------------------------------------
| HR & Workforce OS — EPIC H5. Recruitment (ATS), hiring and lifecycle.
|--------------------------------------------------------------------------
| Recruiters run the pipeline; HR executes the hire and owns the lifecycle;
| managers interview and decide. Three separate permissions, on purpose.
*/
Route::middleware('auth:sanctum')->prefix('hr/recruitment')->group(function (): void {
    Route::middleware('permission:hr.recruitment.view')->group(function (): void {
        Route::get('/jobs', [HrRecruitmentController::class, 'jobs']);
        Route::get('/stages', [HrRecruitmentController::class, 'stages']);
        Route::get('/board', [HrRecruitmentController::class, 'board']);
        Route::get('/applications', [HrRecruitmentController::class, 'applications']);
        Route::get('/applications/{id}', [HrRecruitmentController::class, 'application']);
        Route::get('/applicants', [HrRecruitmentController::class, 'applicants']);
        Route::get('/applicants/duplicates', [HrRecruitmentController::class, 'duplicates']);
        Route::get('/interviews/upcoming', [HrHiringController::class, 'upcomingInterviews']);
    });
    Route::middleware('permission:hr.recruitment.manage')->group(function (): void {
        Route::post('/jobs', [HrRecruitmentController::class, 'storeJob']);
        Route::put('/jobs/{id}', [HrRecruitmentController::class, 'updateJob']);
        Route::patch('/jobs/{id}/transition', [HrRecruitmentController::class, 'transitionJob']);
        Route::post('/stages', [HrRecruitmentController::class, 'storeStage']);
        Route::put('/stages/{id}', [HrRecruitmentController::class, 'updateStage']);
        Route::post('/applicants/merge', [HrRecruitmentController::class, 'merge']);
        Route::patch('/applicants/{id}/talent-pool', [HrRecruitmentController::class, 'talentPool']);
    });
    Route::middleware('permission:hr.recruitment.decide')->group(function (): void {
        Route::patch('/applications/{id}/stage', [HrRecruitmentController::class, 'moveStage']);
        Route::patch('/applications/{id}/decide', [HrRecruitmentController::class, 'decide']);
        Route::post('/applications/{applicationId}/evaluations', [HrHiringController::class, 'evaluate']);
    });
    Route::middleware('permission:hr.interviews.manage')->group(function (): void {
        Route::post('/applications/{applicationId}/interviews', [HrHiringController::class, 'scheduleInterview']);
        Route::patch('/interviews/{id}/complete', [HrHiringController::class, 'completeInterview']);
        Route::patch('/interviews/{id}/cancel', [HrHiringController::class, 'cancelInterview']);
    });
    Route::middleware('permission:hr.hiring.execute')->group(function (): void {
        Route::get('/applications/{applicationId}/hire-prefill', [HrHiringController::class, 'prefill']);
        Route::post('/applications/{applicationId}/hire', [HrHiringController::class, 'hire']);
    });

    /*
    | HR V1 enhancements — tags, timeline, bulk actions, analytics.
    |
    | Tagging is its own permission, and bulk work is its own again: one click
    | that moves eighty candidacies is not the same authority as moving one.
    */
    Route::middleware('permission:hr.recruitment.view')->group(function (): void {
        Route::get('/tags', [HrRecruitmentEnhancementController::class, 'tagCatalogue']);
        Route::get('/tags/search', [HrRecruitmentEnhancementController::class, 'searchByTag']);
        Route::get('/applicants/{applicantId}/tags', [HrRecruitmentEnhancementController::class, 'applicantTags']);
        Route::get('/applicants/{applicantId}/timeline', [HrRecruitmentEnhancementController::class, 'applicantTimeline']);
        Route::get('/applications/{applicationId}/timeline', [HrRecruitmentEnhancementController::class, 'applicationTimeline']);
        Route::get('/bulk/actions', [HrRecruitmentEnhancementController::class, 'bulkActions']);
    });
    Route::middleware('permission:hr.recruitment.tag')->group(function (): void {
        Route::post('/applicants/{applicantId}/tags', [HrRecruitmentEnhancementController::class, 'assignTag']);
        Route::put('/applicants/{applicantId}/tags', [HrRecruitmentEnhancementController::class, 'syncTags']);
        Route::delete('/applicants/{applicantId}/tags/{tagId}', [HrRecruitmentEnhancementController::class, 'removeTag']);
    });
    Route::middleware('permission:hr.recruitment.tags.manage')->group(function (): void {
        Route::post('/tags', [HrRecruitmentEnhancementController::class, 'storeTag']);
        Route::put('/tags/{id}', [HrRecruitmentEnhancementController::class, 'updateTag']);
        Route::delete('/tags/{id}', [HrRecruitmentEnhancementController::class, 'destroyTag']);
    });
    Route::middleware('permission:hr.recruitment.bulk')->group(function (): void {
        Route::post('/bulk/preview', [HrRecruitmentEnhancementController::class, 'bulkPreview']);
        Route::post('/bulk/execute', [HrRecruitmentEnhancementController::class, 'bulkExecute']);
    });
    Route::middleware('permission:hr.recruitment.analytics.view')->group(function (): void {
        Route::get('/analytics', [HrRecruitmentEnhancementController::class, 'analytics']);
    });
});

/*
|--------------------------------------------------------------------------
| HR V1 enhancements — offer letters.
|--------------------------------------------------------------------------
| Offers commit the company to a salary, so drafting and sending one is its
| own permission rather than part of "manage recruitment".
*/
Route::middleware('auth:sanctum')->prefix('hr/offers')->group(function (): void {
    Route::middleware('permission:hr.offers.view')->group(function (): void {
        Route::get('/', [HrOfferController::class, 'index']);
        Route::get('/{id}', [HrOfferController::class, 'show']);
        Route::get('/{id}/document', [HrOfferController::class, 'document']);
    });
    Route::middleware('permission:hr.offers.manage')->group(function (): void {
        Route::post('/applications/{applicationId}', [HrOfferController::class, 'store']);
        Route::post('/{id}/revise', [HrOfferController::class, 'revise']);
        Route::patch('/{id}/send', [HrOfferController::class, 'send']);
        Route::patch('/{id}/accept', [HrOfferController::class, 'accept']);
        Route::patch('/{id}/decline', [HrOfferController::class, 'decline']);
        Route::patch('/{id}/withdraw', [HrOfferController::class, 'withdraw']);
        Route::post('/expire-lapsed', [HrOfferController::class, 'expireLapsed']);
    });
});

/*
|--------------------------------------------------------------------------
| HR V1 enhancements — employee exit.
|--------------------------------------------------------------------------
| Completing an exit changes the employee record and writes the separation
| into their history, so it sits behind its own grant.
*/
Route::middleware('auth:sanctum')->prefix('hr/exits')->group(function (): void {
    Route::middleware('permission:hr.exit.view')->group(function (): void {
        Route::get('/', [HrExitController::class, 'index']);
        Route::get('/types', [HrExitController::class, 'types']);
        Route::get('/checklist-template', [HrExitController::class, 'checklistTemplate']);
        Route::get('/assigned/{employeeId}', [HrExitController::class, 'myItems']);
        Route::get('/{id}', [HrExitController::class, 'show']);
    });
    Route::middleware('permission:hr.exit.manage')->group(function (): void {
        Route::post('/employees/{employeeId}', [HrExitController::class, 'store']);
        Route::patch('/{id}/complete', [HrExitController::class, 'complete']);
        Route::patch('/{id}/cancel', [HrExitController::class, 'cancel']);
        Route::post('/{id}/items', [HrExitController::class, 'addItem']);
        Route::patch('/items/{itemId}/complete', [HrExitController::class, 'completeItem']);
        Route::patch('/items/{itemId}/waive', [HrExitController::class, 'waiveItem']);
        Route::patch('/items/{itemId}/not-applicable', [HrExitController::class, 'notApplicableItem']);
        Route::patch('/items/{itemId}/reopen', [HrExitController::class, 'reopenItem']);
    });
});

/*
|--------------------------------------------------------------------------
| HR V1 enhancements — compensation explainability, protection, versioning.
|--------------------------------------------------------------------------
| Every read here shows the working behind a number. The only writes are
| adjustments and new rule versions — the two things that exist BECAUSE
| approved pay and historical rules can no longer be edited.
*/
Route::middleware('auth:sanctum')->prefix('hr/compensation')->group(function (): void {
    Route::middleware('permission:hr.compensation.view')->group(function (): void {
        Route::get('/periods/{periodId}/commission-preview', [HrCompensationExplainabilityController::class, 'commissionPreview']);
        Route::get('/employees/{employeeId}/commission/{ruleId}/drill-down', [HrCompensationExplainabilityController::class, 'commissionDrillDown']);
        Route::get('/payslips/{payslipId}/explain', [HrCompensationExplainabilityController::class, 'explainPayslip']);
        Route::get('/employees/{employeeId}/kpi-traceability', [HrCompensationExplainabilityController::class, 'kpiTraceability']);
        Route::get('/bonuses/{bonusId}/decision-audit', [HrCompensationExplainabilityController::class, 'bonusDecisionAudit']);
        Route::get('/lock-status', [HrCompensationExplainabilityController::class, 'lockStatus']);
        Route::get('/adjustments/pending', [HrCompensationExplainabilityController::class, 'pendingAdjustments']);
        Route::get('/employees/{employeeId}/adjustments', [HrCompensationExplainabilityController::class, 'employeeAdjustments']);
        Route::get('/commission-rules/{ruleId}/versions', [HrCompensationExplainabilityController::class, 'ruleVersions']);
        Route::get('/commission-rules/{ruleId}/version-on', [HrCompensationExplainabilityController::class, 'ruleVersionOn']);
    });
    Route::middleware('permission:hr.compensation.adjust')->group(function (): void {
        Route::post('/employees/{employeeId}/adjustments', [HrCompensationExplainabilityController::class, 'raiseAdjustment']);
    });
    // Raising and approving are deliberately different grants: the whole point of
    // an adjustment is that changing approved pay is not one person's decision.
    Route::middleware('permission:hr.compensation.adjust.approve')->group(function (): void {
        Route::patch('/adjustments/{id}/approve', [HrCompensationExplainabilityController::class, 'approveAdjustment']);
        Route::patch('/adjustments/{id}/reject', [HrCompensationExplainabilityController::class, 'rejectAdjustment']);
    });
    Route::middleware('permission:hr.commission.manage')->group(function (): void {
        Route::post('/commission-rules/{ruleId}/versions', [HrCompensationExplainabilityController::class, 'newRuleVersion']);
    });
});

Route::middleware('auth:sanctum')->prefix('hr/lifecycle')->group(function (): void {
    Route::middleware('permission:hr.employees.view')->group(function (): void {
        Route::get('/types', [HrHiringController::class, 'lifecycleTypes']);
        Route::get('/movements', [HrHiringController::class, 'movements']);
        Route::get('/employees/{employeeId}/history', [HrHiringController::class, 'history']);
    });
    Route::middleware('permission:hr.lifecycle.manage')->group(function (): void {
        Route::post('/employees/{employeeId}/move', [HrHiringController::class, 'move']);
        Route::post('/employees/{employeeId}/probation-passed', [HrHiringController::class, 'passProbation']);
        Route::post('/employees/{employeeId}/separate', [HrHiringController::class, 'separate']);
    });
});

/*
|--------------------------------------------------------------------------
| HR & Workforce OS — EPIC H6. Executive workspace and analytics.
|--------------------------------------------------------------------------
| Visualization only — every route is a GET and the services own no data.
*/
Route::middleware('auth:sanctum')->prefix('hr/executive')->group(function (): void {
    Route::middleware('permission:hr.executive.view')->group(function (): void {
        Route::get('/dashboard', [HrExecutiveController::class, 'dashboard']);
        Route::get('/workforce', [HrExecutiveController::class, 'workforce']);
        Route::get('/attendance', [HrExecutiveController::class, 'attendance']);
        Route::get('/compensation', [HrExecutiveController::class, 'compensation']);
        Route::get('/performance', [HrExecutiveController::class, 'performanceSummary']);
        Route::get('/recruitment', [HrExecutiveController::class, 'recruitment']);
        Route::get('/operations', [HrExecutiveController::class, 'operations']);
        Route::get('/departments/{departmentId}', [HrExecutiveController::class, 'department']);
        Route::get('/branches/{branchId}', [HrExecutiveController::class, 'branch']);
        Route::get('/employees/{employeeId}', [HrExecutiveController::class, 'employee']);
    });
    Route::middleware('permission:hr.analytics.view')->group(function (): void {
        Route::get('/analytics/trends', [HrExecutiveController::class, 'trends']);
        Route::get('/analytics/trends/{series}', [HrExecutiveController::class, 'trend']);
    });
});
