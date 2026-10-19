<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Modules\Finance\Budget\Domain\Enums\BudgetDimension;
use Modules\Finance\Budget\Domain\Services\BudgetControlEngine;
use Modules\Finance\Budget\Domain\Services\BudgetService;
use Modules\Finance\Closing\Domain\Enums\ClosingRunStatus;
use Modules\Finance\Closing\Domain\Enums\YearEndStatus;
use Modules\Finance\Closing\Domain\Services\ClosingService;
use Modules\Finance\Closing\Domain\Services\ClosingWorkspaceService;
use Modules\Finance\Closing\Domain\Services\PeriodClosingService;
use Modules\Finance\Closing\Domain\Services\YearEndClosingService;
use Modules\Finance\Controls\Domain\Models\ControlException;
use Modules\Finance\Controls\Domain\Services\FinancialValidationEngine;
use Modules\Finance\Fiscal\Domain\Enums\PeriodStatus;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Fiscal\Domain\Models\FiscalYear;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Integration\Domain\Models\AccountRole;
use Modules\Finance\Ledger\Domain\Enums\AccountType;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Services\ChartOfAccountsService;
use Modules\Finance\Ledger\Domain\Services\JournalEngine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Vat\Domain\Enums\VatPeriodStatus;
use Modules\Finance\Vat\Domain\Services\VatService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Finance OS — EPIC F4. Financial Control, Closing & Budget Platform.
 *
 * These tests protect the governance guarantees: period lifecycle, repeatable
 * year-end that never mutates history, budget-vs-actual derived read-only,
 * budget blocking, VAT settlement through the Posting Engine, report-only
 * controls, and close-readiness scoring.
 */
class FinancialControlPlatformTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private string $companyId;

    private FiscalYear $year1;

    private FiscalYear $year2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->companyId = (string) $this->company->id;

        $start = Carbon::today()->startOfMonth()->subMonths(6);
        $this->year1 = $this->openYear('Y1', $start);
        $this->year2 = $this->openYear('Y2', $start->copy()->addYear());
    }

    // ═══ PERIOD MANAGEMENT ═════════════════════════════════════════════════════

    public function test_period_soft_close_reopen_and_hard_close_lifecycle(): void
    {
        $period = $this->firstPeriod($this->year1);
        $svc = app(PeriodClosingService::class);

        $svc->softClose($period, 1);
        $this->assertSame(PeriodStatus::Closed, $period->fresh()->status);

        $svc->reopen($period->fresh(), 2, 'late adjustment');
        $this->assertSame(PeriodStatus::Open, $period->fresh()->status);

        $svc->softClose($period->fresh(), 1);
        $svc->hardClose($period->fresh(), 3, 'year audit');
        $this->assertSame(PeriodStatus::Locked, $period->fresh()->status);
    }

    public function test_hard_close_requires_a_prior_soft_close(): void
    {
        $this->expectException(FinanceException::class);
        app(PeriodClosingService::class)->hardClose($this->firstPeriod($this->year1), 1);
    }

    public function test_a_locked_period_cannot_be_reopened(): void
    {
        $period = $this->firstPeriod($this->year1);
        app(PeriodClosingService::class)->softClose($period, 1);
        app(PeriodClosingService::class)->hardClose($period->fresh(), 1);

        $this->expectException(FinanceException::class);
        app(PeriodClosingService::class)->reopen($period->fresh(), 2, 'nope');
    }

    // ═══ BUDGET ════════════════════════════════════════════════════════════════

    public function test_budget_approval_enforces_maker_checker(): void
    {
        $budget = app(BudgetService::class)->create($this->companyId, (int) $this->year1->id, 'OPEX', createdBy: 1);
        app(BudgetService::class)->addLine($budget, (int) $this->account(AccountType::Expense)->id, 10000.0);

        // The author cannot approve their own budget.
        $this->expectException(FinanceException::class);
        app(BudgetService::class)->approve($budget, 1);
    }

    public function test_budget_vs_actual_is_derived_from_the_ledger(): void
    {
        $expense = $this->account(AccountType::Expense);
        $cash = $this->account(AccountType::Asset);

        $budget = app(BudgetService::class)->create($this->companyId, (int) $this->year1->id, 'OPEX', createdBy: 1);
        app(BudgetService::class)->addLine($budget, (int) $expense->id, 10000.0);
        app(BudgetService::class)->approve($budget->fresh(), 2);

        // Actual spend of 3000.
        $this->postJournal($expense, $cash, 3000.0);

        $vsa = app(BudgetControlEngine::class)->budgetVsActual($budget->fresh());
        $line = $vsa['lines'][0];
        $this->assertSame(10000.0, $line['budget']);
        $this->assertSame(3000.0, $line['actual']);
        $this->assertSame(7000.0, $line['available']);
        $this->assertSame(30.0, $line['consumption_pct']);
    }

    public function test_budget_control_blocks_a_spend_over_the_threshold(): void
    {
        $expense = $this->account(AccountType::Expense);
        $cash = $this->account(AccountType::Asset);

        $budget = app(BudgetService::class)->create($this->companyId, (int) $this->year1->id, 'CAPEX', createdBy: 1);
        app(BudgetService::class)->addLine($budget, (int) $expense->id, 1000.0);
        app(BudgetService::class)->approve($budget->fresh(), 2);

        \Modules\Finance\Budget\Domain\Models\BudgetControlRule::create([
            'company_id' => $this->companyId, 'scope' => 'global',
            'warn_threshold_pct' => 80, 'block_threshold_pct' => 100, 'action' => 'block', 'is_active' => true,
        ]);

        $this->postJournal($expense, $cash, 900.0); // 90% consumed

        $verdict = app(BudgetControlEngine::class)->evaluate(
            $this->companyId, (int) $this->year1->id, (int) $expense->id, 200.0, BudgetDimension::Company,
        );
        $this->assertFalse($verdict['allowed']);
        $this->assertSame('blocked', $verdict['verdict']);
    }

    // ═══ VAT ═══════════════════════════════════════════════════════════════════

    public function test_vat_return_and_settlement_post_through_the_engine(): void
    {
        $output = $this->mapRole('vat_output', AccountType::Liability);
        $input = $this->mapRole('vat_input', AccountType::Asset);
        $payable = $this->mapRole('vat_payable', AccountType::Liability);
        $cash = $this->account(AccountType::Asset);

        $window = Carbon::today()->startOfMonth();
        // Output VAT 140 (CR output / DR cash), input VAT 40 (DR input / CR cash).
        $this->postJournal($cash, $output, 140.0, $window);
        $this->postJournal($input, $cash, 40.0, $window);

        $period = app(VatService::class)->createPeriod($this->companyId, 'VAT-'.$window->format('Y-m'), $window, $window->copy()->endOfMonth());
        $return = app(VatService::class)->generateReturn($period);

        $this->assertSame(140.0, (float) $return->output_vat);
        $this->assertSame(40.0, (float) $return->input_vat_recoverable);
        $this->assertSame(100.0, (float) $return->net_payable);

        $settled = app(VatService::class)->settle($period->fresh(), 1);
        $this->assertSame(VatPeriodStatus::Settled, $settled->status);
        $this->assertNotNull($settled->settlement_journal_id);
    }

    // ═══ YEAR-END CLOSING ══════════════════════════════════════════════════════

    public function test_year_end_closing_sweeps_pnl_to_retained_earnings_and_carries_forward(): void
    {
        $revenue = $this->account(AccountType::Revenue);
        $expense = $this->account(AccountType::Expense);
        $cash = $this->account(AccountType::Asset);
        $retained = $this->account(AccountType::Equity);

        $date = Carbon::parse($this->year1->start_date)->addMonths(1);
        $this->postJournal($cash, $revenue, 1000.0, $date);   // income 1000
        $this->postJournal($expense, $cash, 400.0, $date);    // cost 400 → net 600

        $closing = app(YearEndClosingService::class)->close($this->year1, (int) $retained->id, $this->year2, 1);

        $this->assertSame(YearEndStatus::Closed, $closing->status);
        $this->assertSame(600.0, (float) $closing->net_income);
        $this->assertNotNull($closing->pnl_closing_journal_id);
        $this->assertNotNull($closing->opening_journal_id);

        // Retained earnings now carries the net income.
        $this->assertSame(600.0, $this->balance($retained));
    }

    public function test_year_end_is_repeatable_until_finalized(): void
    {
        $revenue = $this->account(AccountType::Revenue);
        $cash = $this->account(AccountType::Asset);
        $retained = $this->account(AccountType::Equity);
        $this->postJournal($cash, $revenue, 500.0, Carbon::parse($this->year1->start_date)->addMonth());

        $svc = app(YearEndClosingService::class);
        $first = $svc->close($this->year1, (int) $retained->id, $this->year2, 1);
        $this->assertSame(1, $first->run_count);

        // Re-run: reverses and re-posts. Same net income, incremented run.
        $second = $svc->close($this->year1->fresh(), (int) $retained->id, $this->year2, 1);
        $this->assertSame(2, $second->run_count);
        $this->assertSame(500.0, (float) $second->net_income);

        // Finalize → immutable; a further run is refused.
        $svc->finalize($second->fresh(), 2);
        $this->expectException(FinanceException::class);
        $svc->close($this->year1->fresh(), (int) $retained->id, $this->year2, 1);
    }

    // ═══ FINANCIAL CONTROLS ════════════════════════════════════════════════════

    public function test_controls_open_an_exception_for_an_unposted_journal(): void
    {
        // A lingering draft journal.
        $a = $this->account(AccountType::Asset);
        $b = $this->account(AccountType::Revenue);
        app(JournalEngine::class)->submitDraft(new PostingRequest(
            companyId: $this->companyId, entryDate: Carbon::today(),
            lines: [PostingLine::debit((int) $a->id, 50.0, $this->companyId), PostingLine::credit((int) $b->id, 50.0, $this->companyId)],
            description: 'draft',
        ), 1);

        $result = app(FinancialValidationEngine::class)->run($this->companyId);
        $this->assertGreaterThanOrEqual(1, $result['open_exceptions']);
        $this->assertSame(1, ControlException::query()->where('company_id', $this->companyId)->where('check_key', 'unposted_journal')->where('status', 'open')->count());
    }

    public function test_controls_never_modify_financial_data(): void
    {
        // Running controls with a clean ledger opens nothing and changes nothing.
        $before = \Illuminate\Support\Facades\DB::table('finance_journal_entries')->count();
        app(FinancialValidationEngine::class)->run($this->companyId);
        $after = \Illuminate\Support\Facades\DB::table('finance_journal_entries')->count();
        $this->assertSame($before, $after);
    }

    // ═══ CLOSING WORKFLOW + WORKSPACE ══════════════════════════════════════════

    public function test_a_closing_run_blocks_on_a_failing_check_then_closes_when_clean(): void
    {
        $period = $this->firstPeriod($this->year1);
        $a = $this->account(AccountType::Asset);
        $b = $this->account(AccountType::Revenue);

        // A draft journal in the period makes the no-drafts check fail.
        $draft = app(JournalEngine::class)->submitDraft(new PostingRequest(
            companyId: $this->companyId, entryDate: Carbon::parse($period->start_date),
            lines: [PostingLine::debit((int) $a->id, 10.0, $this->companyId), PostingLine::credit((int) $b->id, 10.0, $this->companyId)],
            description: 'draft',
        ), 1);

        $run = app(ClosingService::class)->startPeriodRun($period, 1);
        app(ClosingService::class)->validate($run);
        $this->assertNotNull($run->fresh()->readiness_score);

        try {
            app(ClosingService::class)->close($run->fresh(), 2);
            $this->fail('A blocking check should prevent the close.');
        } catch (FinanceException) {
            // expected
        }

        // Clear the draft, re-validate, and close.
        app(JournalEngine::class)->discardDraft($draft);
        app(ClosingService::class)->validate($run->fresh());
        $closed = app(ClosingService::class)->close($run->fresh(), 2);

        $this->assertSame(ClosingRunStatus::Closed, $closed->status);
        $this->assertSame(PeriodStatus::Closed, $period->fresh()->status);
    }

    public function test_the_closing_workspace_reports_a_readiness_score(): void
    {
        $workspace = app(ClosingWorkspaceService::class)->forPeriod($this->firstPeriod($this->year1));

        $this->assertArrayHasKey('close_readiness_score', $workspace);
        $this->assertArrayHasKey('closing_progress', $workspace);
        $this->assertArrayHasKey('reconciliation_status', $workspace);
        $this->assertIsFloat($workspace['close_readiness_score']);
    }

    // ═══ ARCHITECTURE / SOURCE SCAN ════════════════════════════════════════════

    public function test_budget_and_controls_are_read_only_against_finance(): void
    {
        foreach (['Budget', 'Controls'] as $context) {
            $dir = base_path("Modules/Finance/{$context}");
            $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));
            foreach ($it as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }
                $source = (string) file_get_contents($file->getPathname());
                foreach (['JournalEngine', 'PostingCoordinator', 'JournalEntry::create', '->lines()->create('] as $needle) {
                    $this->assertStringNotContainsString($needle, $source, "{$context}/".basename($file->getPathname())." must stay read-only against Finance ({$needle}).");
                }
            }
        }
    }

    public function test_no_f4_service_writes_the_ledger_tables_directly(): void
    {
        $dir = base_path('Modules/Finance');
        foreach (['Closing', 'Budget', 'Vat', 'Controls'] as $context) {
            $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator("{$dir}/{$context}"));
            foreach ($it as $file) {
                if (! $file->isFile() || $file->getExtension() !== 'php') {
                    continue;
                }
                $source = (string) file_get_contents($file->getPathname());
                foreach (["finance_journal_entries')", "finance_journal_lines')", 'JournalEntry::create(', 'JournalLine::create('] as $needle) {
                    $this->assertStringNotContainsString($needle, $source, basename($file->getPathname())." must not write the ledger tables directly ({$needle}).");
                }
            }
        }
    }

    // ═══ HELPERS ═══════════════════════════════════════════════════════════════

    private function suffix(): string
    {
        return substr(md5(uniqid('', true)), 0, 8);
    }

    private function openYear(string $label, Carbon $start): FiscalYear
    {
        $year = app(FiscalCalendarService::class)->createYear(
            $this->companyId, $label.'-'.$this->suffix(), $start, $start->copy()->addMonths(11)->endOfMonth(),
        );
        foreach ($year->periods as $period) {
            if ($period->status->value !== 'open') {
                app(FiscalCalendarService::class)->openPeriod($period);
            }
        }

        return $year->refresh();
    }

    private function firstPeriod(FiscalYear $year): FiscalPeriod
    {
        return FiscalPeriod::query()->where('fiscal_year_id', $year->id)->orderBy('period_number')->firstOrFail();
    }

    private function account(AccountType $type): Account
    {
        return app(ChartOfAccountsService::class)->create([
            'company_id' => $this->companyId,
            'code' => strtoupper($type->value[0]).'-'.$this->suffix(),
            'name' => ucfirst($type->value).' account',
            'account_type' => $type,
            'is_postable' => true,
        ]);
    }

    private function mapRole(string $role, AccountType $type): Account
    {
        $account = $this->account($type);
        AccountRole::create(['company_id' => $this->companyId, 'role' => $role, 'account_id' => $account->id]);

        return $account;
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

    private function balance(Account $account): float
    {
        $row = \Illuminate\Support\Facades\DB::table('finance_journal_lines as l')
            ->join('finance_journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->where('l.account_id', $account->id)
            ->whereIn('e.status', ['posted', 'reversed'])
            ->selectRaw('COALESCE(SUM(l.debit),0) as d, COALESCE(SUM(l.credit),0) as c')->first();

        $normal = $account->normal_balance->value;

        return round($normal === 'debit' ? (float) $row->d - (float) $row->c : (float) $row->c - (float) $row->d, 4);
    }
}
