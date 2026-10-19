<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Analytics\Domain\Services\FinancialDashboardService;
use Modules\Finance\Analytics\Domain\Services\FinancialMetricsService;
use Modules\Finance\Cash\Domain\Models\CashAccount;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Intelligence\Domain\Services\CostIntelligenceService;
use Modules\Finance\Intelligence\Domain\Services\ForecastService;
use Modules\Finance\Intelligence\Domain\Services\ProfitabilityService;
use Modules\Finance\Intelligence\Domain\Services\ScenarioEngine;
use Modules\Finance\Intelligence\Domain\Services\TrendAnalysisService;
use Modules\Finance\Ledger\Domain\Enums\AccountCategory;
use Modules\Finance\Ledger\Domain\Enums\AccountType;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Services\ChartOfAccountsService;
use Modules\Finance\Ledger\Domain\Services\JournalEngine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Reporting\Domain\Models\ReportSnapshot;
use Modules\Finance\Reporting\Domain\Services\ExecutiveReportingService;
use Modules\Finance\Workspace\Domain\Services\CfoWorkspaceService;
use Modules\Finance\Workspace\Domain\Services\ExecutiveWorkspaceService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Finance OS — EPIC F5. Financial Intelligence & Executive Workspace.
 *
 * These tests protect the read-only intelligence guarantees: every figure is
 * derived from existing Finance data, forecasts are deterministic and
 * explainable, scenarios simulate without writing, and NO service in the
 * intelligence layer touches the ledger.
 */
class FinancialIntelligenceWorkspaceTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private string $companyId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->companyId = (string) $this->company->id;

        $start = Carbon::today()->startOfMonth()->subMonths(6);
        $year = app(FiscalCalendarService::class)->createYear($this->companyId, 'FY-'.$this->suffix(), $start, $start->copy()->addMonths(11)->endOfMonth());
        foreach ($year->periods as $p) {
            if ($p->status->value !== 'open') {
                app(FiscalCalendarService::class)->openPeriod($p);
            }
        }
    }

    // ═══ METRICS KERNEL ════════════════════════════════════════════════════════

    public function test_the_kernel_derives_profit_and_loss(): void
    {
        $cash = $this->account(AccountType::Asset, AccountCategory::CurrentAsset);
        $revenue = $this->account(AccountType::Revenue, AccountCategory::OperatingRevenue);
        $cogs = $this->account(AccountType::Expense, AccountCategory::CostOfSales);
        $opex = $this->account(AccountType::Expense, AccountCategory::OperatingExpense);

        $this->postJournal($cash, $revenue, 1000.0);
        $this->postJournal($cogs, $cash, 400.0);
        $this->postJournal($opex, $cash, 100.0);

        $pnl = app(FinancialMetricsService::class)->profitAndLoss($this->companyId, $this->windowFrom(), $this->windowTo());

        $this->assertSame(1000.0, $pnl['revenue']);
        $this->assertSame(400.0, $pnl['cost_of_sales']);
        $this->assertSame(600.0, $pnl['gross_profit']);
        $this->assertSame(500.0, $pnl['operating_profit']);
        $this->assertSame(500.0, $pnl['net_profit']);
        $this->assertSame(60.0, $pnl['gross_margin_pct']);
    }

    public function test_the_kernel_derives_working_capital_and_cash(): void
    {
        $cashGl = $this->account(AccountType::Asset, AccountCategory::CurrentAsset);
        $liability = $this->account(AccountType::Liability, AccountCategory::CurrentLiability);
        $revenue = $this->account(AccountType::Revenue, AccountCategory::OperatingRevenue);

        // A cash account so the cash position picks up this GL account.
        CashAccount::create(['company_id' => $this->companyId, 'code' => 'T-'.$this->suffix(), 'name' => 'Till', 'gl_account_id' => $cashGl->id]);

        $this->postJournal($cashGl, $revenue, 800.0);          // current asset +800
        $this->postJournal($cashGl, $liability, 300.0);        // current liability +300, asset +300

        $bs = app(FinancialMetricsService::class)->balanceSheet($this->companyId, $this->windowTo());
        $this->assertSame(1100.0, $bs['current_assets']);
        $this->assertSame(300.0, $bs['current_liabilities']);
        $this->assertSame(800.0, $bs['working_capital']);

        $this->assertSame(1100.0, app(FinancialMetricsService::class)->cashPosition($this->companyId, $this->windowTo()));
    }

    public function test_health_score_is_explainable(): void
    {
        $this->seedProfitableMonth();
        $health = app(FinancialMetricsService::class)->healthScore($this->companyId, $this->windowFrom(), $this->windowTo(), $this->windowTo());

        $this->assertArrayHasKey('score', $health);
        $this->assertArrayHasKey('components', $health);
        $this->assertNotEmpty($health['components']);
        $this->assertContains($health['rating'], ['strong', 'healthy', 'watch', 'at_risk']);
    }

    // ═══ INTELLIGENCE ══════════════════════════════════════════════════════════

    public function test_revenue_forecast_is_deterministic_and_explainable(): void
    {
        $cash = $this->account(AccountType::Asset, AccountCategory::CurrentAsset);
        $revenue = $this->account(AccountType::Revenue, AccountCategory::OperatingRevenue);

        // Rising revenue across three months.
        $this->postJournal($cash, $revenue, 100.0, Carbon::today()->startOfMonth()->subMonths(2));
        $this->postJournal($cash, $revenue, 200.0, Carbon::today()->startOfMonth()->subMonth());
        $this->postJournal($cash, $revenue, 300.0, Carbon::today()->startOfMonth());

        $forecast = app(ForecastService::class)->revenueForecast($this->companyId, 6, 2);

        $this->assertSame('linear_least_squares', $forecast['method']);
        $this->assertSame('up', $forecast['direction']);
        $this->assertCount(2, $forecast['forecast']);
        $this->assertArrayHasKey('explanation', $forecast);
    }

    public function test_revenue_trend_direction(): void
    {
        $cash = $this->account(AccountType::Asset, AccountCategory::CurrentAsset);
        $revenue = $this->account(AccountType::Revenue, AccountCategory::OperatingRevenue);
        $this->postJournal($cash, $revenue, 100.0, Carbon::today()->startOfMonth()->subMonths(2));
        $this->postJournal($cash, $revenue, 500.0, Carbon::today()->startOfMonth());

        $trend = app(TrendAnalysisService::class)->revenue($this->companyId, 6);
        $this->assertSame('up', $trend['direction']);
    }

    public function test_profitability_by_branch_uses_ledger_dimensions(): void
    {
        $cash = $this->account(AccountType::Asset, AccountCategory::CurrentAsset);
        $revenue = $this->account(AccountType::Revenue, AccountCategory::OperatingRevenue);
        $cogs = $this->account(AccountType::Expense, AccountCategory::CostOfSales);

        $branch = (string) \Illuminate\Support\Str::uuid();
        $this->postDim($cash, $revenue, 1000.0, $branch);
        $this->postDim($cogs, $cash, 300.0, $branch);

        $result = app(ProfitabilityService::class)->byBranch($this->companyId, $this->windowFrom(), $this->windowTo());
        $row = collect($result['rows'])->firstWhere('branch', $branch);
        $this->assertSame(1000.0, $row['revenue']);
        $this->assertSame(300.0, $row['expense']);
        $this->assertSame(700.0, $row['profit']);
    }

    public function test_cost_intelligence_classifies_operationally(): void
    {
        $cash = $this->account(AccountType::Asset, AccountCategory::CurrentAsset);
        $logistics = $this->account(AccountType::Expense, AccountCategory::OperatingExpense, 'Shipping & Freight');
        $marketing = $this->account(AccountType::Expense, AccountCategory::OperatingExpense, 'Marketing Campaigns');

        $this->postJournal($logistics, $cash, 250.0);
        $this->postJournal($marketing, $cash, 150.0);

        $classified = app(CostIntelligenceService::class)->operationalClassification($this->companyId, $this->windowFrom(), $this->windowTo());
        $this->assertSame(250.0, $classified['buckets']['logistics']);
        $this->assertSame(150.0, $classified['buckets']['marketing']);
    }

    public function test_scenario_analysis_simulates_without_writing(): void
    {
        $this->seedProfitableMonth(); // revenue 1000, cogs 400 => net 600

        $journalsBefore = DB::table('finance_journal_entries')->count();

        $result = app(ScenarioEngine::class)->simulate($this->companyId, $this->windowFrom(), $this->windowTo(), ['revenue_pct' => 10]);

        // +10% revenue on 1000 => 1100; net profit rises by 100.
        $this->assertSame(1100.0, $result['scenario']['revenue']);
        $this->assertSame(100.0, $result['deltas']['net_profit']);
        // Nothing was written.
        $this->assertSame($journalsBefore, DB::table('finance_journal_entries')->count());
    }

    // ═══ WORKSPACES & DASHBOARDS ═══════════════════════════════════════════════

    public function test_executive_workspace_assembles_all_sections(): void
    {
        $this->seedProfitableMonth();
        $ws = app(ExecutiveWorkspaceService::class)->overview($this->companyId);

        foreach (['financial_health', 'cash_position', 'revenue', 'expenses', 'profit', 'working_capital', 'financial_kpis', 'closing_status', 'alerts'] as $key) {
            $this->assertArrayHasKey($key, $ws);
        }
    }

    public function test_cfo_workspace_assembles_all_sections(): void
    {
        $this->seedProfitableMonth();
        $ws = app(CfoWorkspaceService::class)->overview($this->companyId);

        foreach (['daily_summary', 'financial_exceptions', 'budget_performance', 'cash_position', 'outstanding_receivables', 'outstanding_payables', 'liquidity_overview', 'executive_recommendations'] as $key) {
            $this->assertArrayHasKey($key, $ws);
        }
    }

    public function test_revenue_dashboard_composes_trend_and_forecast(): void
    {
        $this->seedProfitableMonth();
        $dash = app(FinancialDashboardService::class)->revenue($this->companyId, $this->windowFrom(), $this->windowTo());

        $this->assertArrayHasKey('total', $dash);
        $this->assertArrayHasKey('trend', $dash);
        $this->assertArrayHasKey('forecast', $dash);
    }

    // ═══ REPORTING ═════════════════════════════════════════════════════════════

    public function test_executive_report_generates_and_snapshots(): void
    {
        $this->seedProfitableMonth();

        $report = app(ExecutiveReportingService::class)->generate($this->companyId, 'executive_summary', $this->windowFrom(), $this->windowTo());
        $this->assertSame('executive_summary', $report['report']);
        $this->assertArrayHasKey('headline', $report);

        $snapshot = app(ExecutiveReportingService::class)->snapshot($this->companyId, 'executive_summary', $this->windowFrom(), $this->windowTo(), 1);
        $this->assertDatabaseHas('finance_report_snapshots', ['uuid' => $snapshot->uuid, 'report_type' => 'executive_summary']);
        $this->assertNotEmpty($snapshot->payload);

        // A snapshot is an immutable archive.
        $snapshot->title = 'changed';
        $this->assertFalse($snapshot->save());
    }

    // ═══ SECURITY ══════════════════════════════════════════════════════════════

    public function test_intelligence_routes_require_authentication(): void
    {
        $this->getJson('/api/finance/intelligence/executive-workspace')->assertUnauthorized();
        $this->getJson('/api/finance/intelligence/dashboards/revenue')->assertUnauthorized();
    }

    // ═══ ARCHITECTURE / SOURCE SCAN (read-only) ════════════════════════════════

    public function test_the_intelligence_layer_never_writes_finance_data(): void
    {
        foreach (['Analytics', 'Intelligence', 'Workspace'] as $context) {
            $dir = base_path("Modules/Finance/{$context}");
            $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));
            foreach ($it as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }
                $source = (string) file_get_contents($file->getPathname());
                foreach (['JournalEngine', 'PostingCoordinator', '->insert(', '->update(', '->delete(', '::create(', '->save('] as $needle) {
                    $this->assertStringNotContainsString($needle, $source, "{$context}/".basename($file->getPathname())." must be read-only ({$needle}).");
                }
            }
        }
    }

    // ═══ HELPERS ═══════════════════════════════════════════════════════════════

    private function suffix(): string
    {
        return substr(md5(uniqid('', true)), 0, 8);
    }

    private function windowFrom(): Carbon
    {
        return Carbon::today()->subMonths(11)->startOfMonth();
    }

    private function windowTo(): Carbon
    {
        return Carbon::today();
    }

    private function account(AccountType $type, AccountCategory $category, ?string $name = null): Account
    {
        return app(ChartOfAccountsService::class)->create([
            'company_id' => $this->companyId,
            'code' => strtoupper($type->value[0]).'-'.$this->suffix(),
            'name' => $name ?? (ucfirst($type->value).' account'),
            'account_type' => $type,
            'account_category' => $category,
            'is_postable' => true,
        ]);
    }

    private function seedProfitableMonth(): void
    {
        $cash = $this->account(AccountType::Asset, AccountCategory::CurrentAsset);
        $revenue = $this->account(AccountType::Revenue, AccountCategory::OperatingRevenue);
        $cogs = $this->account(AccountType::Expense, AccountCategory::CostOfSales);
        $this->postJournal($cash, $revenue, 1000.0);
        $this->postJournal($cogs, $cash, 400.0);
    }

    private function postJournal(Account $debit, Account $credit, float $amount, ?Carbon $date = null): void
    {
        app(JournalEngine::class)->post(new PostingRequest(
            companyId: $this->companyId,
            entryDate: $date ?? Carbon::today(),
            lines: [
                PostingLine::debit((int) $debit->id, $amount, $this->companyId),
                PostingLine::credit((int) $credit->id, $amount, $this->companyId),
            ],
            description: 'setup',
            source: 'posting',
        ));
    }

    private function postDim(Account $debit, Account $credit, float $amount, string $branchId): void
    {
        app(JournalEngine::class)->post(new PostingRequest(
            companyId: $this->companyId,
            entryDate: Carbon::today(),
            lines: [
                PostingLine::debit((int) $debit->id, $amount, $this->companyId, ['branchId' => $branchId]),
                PostingLine::credit((int) $credit->id, $amount, $this->companyId, ['branchId' => $branchId]),
            ],
            description: 'setup',
            source: 'posting',
        ));
    }
}
