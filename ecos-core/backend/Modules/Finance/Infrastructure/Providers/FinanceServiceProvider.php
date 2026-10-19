<?php

declare(strict_types=1);

namespace Modules\Finance\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Finance\Allocation\Domain\Services\AllocationEngine;
use Modules\Finance\Analytics\Domain\Services\FinancialDashboardService;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Intelligence\Domain\Services\CashFlowIntelligenceService;
use Modules\Finance\Intelligence\Domain\Services\CostIntelligenceService;
use Modules\Finance\Intelligence\Domain\Services\ForecastService;
use Modules\Finance\Intelligence\Domain\Services\ProfitabilityService;
use Modules\Finance\Intelligence\Domain\Services\ScenarioEngine;
use Modules\Finance\Intelligence\Domain\Services\TrendAnalysisService;
use Modules\Finance\Intelligence\Domain\Services\VarianceAnalysisService;
use Modules\Finance\Reporting\Domain\Services\ExecutiveReportingService;
use Modules\Finance\Workspace\Domain\Services\CfoWorkspaceService;
use Modules\Finance\Workspace\Domain\Services\ExecutiveWorkspaceService;
use Modules\Finance\Budget\Domain\Services\BudgetControlEngine;
use Modules\Finance\Budget\Domain\Services\BudgetService;
use Modules\Finance\Closing\Domain\Services\ClosingService;
use Modules\Finance\Closing\Domain\Services\ClosingWorkspaceService;
use Modules\Finance\Closing\Domain\Services\CloseReadinessScorer;
use Modules\Finance\Closing\Domain\Services\PeriodClosingService;
use Modules\Finance\Closing\Domain\Services\YearEndClosingService;
use Modules\Finance\Controls\Domain\Services\ControlExceptionService;
use Modules\Finance\Controls\Domain\Services\FinancialValidationEngine;
use Modules\Finance\Integration\Application\Bridge\EventPostingCatalog;
use Modules\Finance\Integration\Application\Bridge\EventPostingSubscriber;
use Modules\Finance\Integration\Application\Services\FinancialIntegrationService;
use Modules\Finance\Integration\Domain\Services\AccountRoleResolver;
use Modules\Finance\Integration\Domain\Services\DeadLetterService;
use Modules\Finance\Integration\Domain\Services\FinancialEventProcessor;
use Modules\Finance\Integration\Domain\Services\PostingAuditRecorder;
use Modules\Finance\Integration\Domain\Services\PostingRuleRegistry;
use Modules\Finance\Integration\Domain\Services\PostingRuleResolver;
use Modules\Finance\Integration\Domain\Services\PostingTraceService;
use Modules\Finance\Integration\Domain\Services\RulePostingStrategy;
use Modules\Finance\Banking\Domain\Services\BankingService;
use Modules\Finance\Banking\Domain\Services\BankReconciliationService;
use Modules\Finance\Cash\Domain\Services\CashService;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Ledger\Domain\Services\ChartOfAccountsService;
use Modules\Finance\Ledger\Domain\Services\JournalEngine;
use Modules\Finance\Ledger\Domain\Services\TrialBalanceService;
use Modules\Finance\Payables\Domain\Services\AccountsPayableService;
use Modules\Finance\Payables\Domain\Services\ApAgingService;
use Modules\Finance\Payables\Domain\Services\SupplierLedgerService;
use Modules\Finance\Posting\Domain\Services\PostingCoordinator;
use Modules\Finance\Posting\Domain\Services\PostingValidator;
use Modules\Finance\Posting\Domain\Strategies\DirectPostingStrategy;
use Modules\Finance\Vat\Domain\Services\VatService;
use Modules\Finance\Receivables\Domain\Services\AccountsReceivableService;
use Modules\Finance\Receivables\Domain\Services\ArAgingService;
use Modules\Finance\Receivables\Domain\Services\CustomerLedgerService;
use Modules\Finance\Shared\Domain\Services\ControlAccountReconciliationService;
use Modules\Finance\Shared\Domain\Services\ControlAccountResolver;
use Modules\Finance\Tax\Domain\Services\TaxService;

/**
 * Finance OS — EPIC F1. Ledger Core & Fiscal Foundation.
 *
 * ┌─ THE FINANCIAL SYSTEM OF RECORD ────────────────────────────────────────┐
 * │ Registers the Journal Engine (the sole GL writer), the Posting Engine    │
 * │ (which requests journals, never writes), the fiscal calendar, the chart  │
 * │ of accounts, tax core, and the trial-balance read model. It integrates   │
 * │ with NO operational module — that is EPIC F3. This is the foundation      │
 * │ every future accounting feature stands on.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class FinanceServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Ledger — the source of truth and its read model.
        $this->app->singleton(JournalEngine::class);
        $this->app->singleton(ChartOfAccountsService::class);
        $this->app->singleton(TrialBalanceService::class);

        // Fiscal.
        $this->app->singleton(FiscalCalendarService::class);

        // Posting — validator, strategy, and the idempotent coordinator.
        $this->app->singleton(PostingValidator::class);
        $this->app->singleton(DirectPostingStrategy::class);
        $this->app->singleton(PostingCoordinator::class);

        // Tax core.
        $this->app->singleton(TaxService::class);

        // ── EPIC F2 · Subledgers ────────────────────────────────────────────────
        // Shared control-account wiring.
        $this->app->singleton(ControlAccountResolver::class);
        $this->app->singleton(ControlAccountReconciliationService::class);

        // Accounts Receivable.
        $this->app->singleton(AccountsReceivableService::class);
        $this->app->singleton(CustomerLedgerService::class);
        $this->app->singleton(ArAgingService::class);

        // Accounts Payable.
        $this->app->singleton(AccountsPayableService::class);
        $this->app->singleton(SupplierLedgerService::class);
        $this->app->singleton(ApAgingService::class);

        // Allocation Engine (shared AR/AP matching).
        $this->app->singleton(AllocationEngine::class);

        // Cash & Banking.
        $this->app->singleton(CashService::class);
        $this->app->singleton(BankingService::class);
        $this->app->singleton(BankReconciliationService::class);

        // ── EPIC F3 · Financial Integration ─────────────────────────────────────
        // The rule-driven, event-sourced posting pipeline. It requests journals
        // through the Posting Engine only — never the ledger.
        $this->app->singleton(AccountRoleResolver::class);
        $this->app->singleton(PostingRuleRegistry::class);
        $this->app->singleton(PostingRuleResolver::class);
        $this->app->singleton(RulePostingStrategy::class);
        $this->app->singleton(PostingAuditRecorder::class);
        $this->app->singleton(DeadLetterService::class);
        $this->app->singleton(FinancialEventProcessor::class);
        $this->app->singleton(PostingTraceService::class);
        $this->app->singleton(EventPostingCatalog::class);
        $this->app->singleton(EventPostingSubscriber::class);
        $this->app->singleton(FinancialIntegrationService::class);

        // ── EPIC F4 · Financial Control, Closing & Budget ───────────────────────
        // Governance over the ledger, never a change to it. Closing orchestrates
        // F1 transitions; budgets are read-only against Finance; controls report
        // only; VAT and year-end post exclusively through the Posting Engine.
        $this->app->singleton(PeriodClosingService::class);
        $this->app->singleton(CloseReadinessScorer::class);
        $this->app->singleton(ClosingService::class);
        $this->app->singleton(ClosingWorkspaceService::class);
        $this->app->singleton(YearEndClosingService::class);
        $this->app->singleton(BudgetService::class);
        $this->app->singleton(BudgetControlEngine::class);
        $this->app->singleton(VatService::class);
        $this->app->singleton(FinancialValidationEngine::class);
        $this->app->singleton(ControlExceptionService::class);

        // ── EPIC F5 · Financial Intelligence & Executive Workspace ──────────────
        // Entirely read-driven. Every figure derives from the metrics kernel; no
        // service here writes the ledger or any financial transaction.
        $this->app->singleton(FinancialMetricsService::class);
        $this->app->singleton(FinancialDashboardService::class);
        $this->app->singleton(TrendAnalysisService::class);
        $this->app->singleton(ForecastService::class);
        $this->app->singleton(ProfitabilityService::class);
        $this->app->singleton(CostIntelligenceService::class);
        $this->app->singleton(CashFlowIntelligenceService::class);
        $this->app->singleton(ScenarioEngine::class);
        $this->app->singleton(VarianceAnalysisService::class);
        $this->app->singleton(ExecutiveWorkspaceService::class);
        $this->app->singleton(CfoWorkspaceService::class);
        $this->app->singleton(ExecutiveReportingService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../Database/Migrations');

        $this->registerIntegrationSubscribers();
    }

    /**
     * Wire the operational event bridge onto the enterprise event bus — OFF by
     * default so existing environments see zero behaviour change. Enabling it is
     * a deliberate per-environment decision, made once account roles are mapped;
     * the bus dispatches subscribers as isolated jobs, so a posting failure can
     * never roll back an operational transaction.
     */
    private function registerIntegrationSubscribers(): void
    {
        // No inline fallback: config/finance.php is the single source of truth
        // for whether the bridge is live. A default here would let a missing or
        // misspelled key decide the platform's posting behaviour silently.
        if (! (bool) config('finance.integration.auto_subscribe')) {
            return;
        }

        $busClass = \Modules\Platform\EventPlatform\Application\Services\EnterpriseEventBus::class;
        if (! class_exists($busClass) || ! $this->app->bound($busClass)) {
            return;
        }

        /** @var \Modules\Platform\EventPlatform\Application\Services\EnterpriseEventBus $bus */
        $bus = $this->app->make($busClass);
        $catalog = $this->app->make(EventPostingCatalog::class);

        foreach ($catalog->knownEventNames() as $eventName) {
            $bus->subscribe(
                $eventName,
                EventPostingSubscriber::class,
                priority: (int) config('finance.integration.subscriber_priority'),
                queue: (string) config('finance.integration.queue'),
            );
        }
    }
}
