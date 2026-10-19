<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Infrastructure\Database\Seeders\AccountRoleSeeder;
use Modules\Finance\Infrastructure\Database\Seeders\ChartOfAccountsSeeder;
use Modules\Finance\Integration\Domain\Enums\BusinessEventType;
use Modules\Finance\Integration\Domain\Services\FinancialEventProcessor;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;
use Modules\Finance\Reporting\Domain\Services\FinancialStatementService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * The Income Statement and Balance Sheet (EPIC-FIN-005).
 *
 * The properties that matter for a statement are not "does it return data" but
 * "do the lines sum to the totals above them", "does the sheet balance", and
 * "can it show another tenant's books". Each is asserted here against journals
 * posted through the real engine rather than hand-written rows.
 */
class FinancialStatementTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $cid = (string) $this->company->id;
        $this->user = User::factory()->create(['company_id' => $cid]);

        (new ChartOfAccountsSeeder)->seedCompany($cid);
        (new AccountRoleSeeder)->seedCompany($cid);

        // Period 1 must cover today, or postings land in a period that was
        // never opened and the statements read an empty ledger.
        $start = Carbon::today()->startOfMonth();
        app(FiscalCalendarService::class)->createYear(
            $cid, 'FY-'.substr($cid, 0, 8), $start, $start->copy()->addMonths(11)->endOfMonth(),
        );

        config(['finance.integration.posting_mode' => 'sync']);
    }

    /** Post a real POS sale: DR cash 1,140 / CR revenue 1,000 / CR VAT 140. */
    private function postSale(float $net = 1000.0, float $tax = 140.0): void
    {
        app(FinancialEventProcessor::class)->process(new FinancialEvent(
            companyId: (string) $this->company->id,
            eventType: BusinessEventType::from('pos.sale'),
            sourceModule: 'pos',
            entityType: 'pos_sale',
            entityId: 'sale-'.uniqid('', true),
            amounts: ['net' => $net, 'tax' => $tax, 'gross' => $net + $tax],
            occurredAt: Carbon::today(),
            idempotencyKey: 'stmt-'.uniqid('', true),
        ));
    }

    private function statements(): FinancialStatementService
    {
        return app(FinancialStatementService::class);
    }

    // ═══ INCOME STATEMENT ══════════════════════════════════════════════════

    public function test_the_income_statement_reports_revenue_that_was_posted(): void
    {
        $this->postSale();

        $s = $this->statements()->incomeStatement(
            (string) $this->company->id,
            Carbon::today()->startOfMonth(),
            Carbon::today()->endOfDay(),
        );

        $this->assertSame(1000.0, $s['sections']['revenue']['total']);
        $this->assertSame(1000.0, $s['totals']['total_revenue']);

        $codes = array_column($s['sections']['revenue']['lines'], 'code');
        $this->assertContains('4110', $codes, 'Product Sales must appear as a revenue line.');
    }

    /** The property that makes a statement trustworthy: lines sum to their total. */
    public function test_every_section_total_equals_the_sum_of_its_lines(): void
    {
        $this->postSale();
        $this->postSale(250.0, 35.0);

        $s = $this->statements()->incomeStatement(
            (string) $this->company->id,
            Carbon::today()->startOfMonth(),
            Carbon::today()->endOfDay(),
        );

        foreach ($s['sections'] as $name => $section) {
            $this->assertSame(
                round((float) array_sum(array_column($section['lines'], 'amount')), 4),
                round((float) $section['total'], 4),
                "Section '{$name}' lines do not sum to its total.",
            );
        }
    }

    public function test_activity_outside_the_window_is_excluded(): void
    {
        $this->postSale();

        $s = $this->statements()->incomeStatement(
            (string) $this->company->id,
            Carbon::today()->subYears(2)->startOfYear(),
            Carbon::today()->subYears(2)->endOfYear(),
        );

        $this->assertSame(0.0, $s['sections']['revenue']['total']);
        $this->assertSame([], $s['sections']['revenue']['lines']);
    }

    // ═══ BALANCE SHEET ═════════════════════════════════════════════════════

    public function test_the_balance_sheet_balances_once_the_years_result_is_included(): void
    {
        $this->postSale();

        $s = $this->statements()->balanceSheet((string) $this->company->id, Carbon::today());

        // Revenue is not closed into equity until year end, so the result for
        // the year is what makes the sheet balance mid-year.
        $this->assertSame(1000.0, $s['totals']['result_for_year']);
        $this->assertTrue($s['is_balanced'], 'Balance sheet did not balance; variance '.$s['variance']);
        $this->assertSame(0.0, $s['variance']);
    }

    public function test_assets_equal_liabilities_plus_equity_including_the_result(): void
    {
        $this->postSale();

        $s = $this->statements()->balanceSheet((string) $this->company->id, Carbon::today());

        $this->assertSame(
            round((float) $s['totals']['total_assets'], 4),
            round((float) $s['totals']['total_liabilities_and_equity'], 4),
        );
    }

    public function test_the_balance_sheet_lines_sum_to_their_section_totals(): void
    {
        $this->postSale();

        $s = $this->statements()->balanceSheet((string) $this->company->id, Carbon::today());

        foreach ($s['sections'] as $name => $section) {
            $this->assertSame(
                round((float) array_sum(array_column($section['lines'], 'amount')), 4),
                round((float) $section['total'], 4),
                "Section '{$name}' lines do not sum to its total.",
            );
        }
    }

    public function test_cash_and_vat_land_on_the_correct_sides(): void
    {
        $this->postSale();

        $s = $this->statements()->balanceSheet((string) $this->company->id, Carbon::today());

        $assetCodes = array_column($s['sections']['current_assets']['lines'], 'code');
        $liabilityCodes = array_column($s['sections']['current_liabilities']['lines'], 'code');

        $this->assertContains('1110', $assetCodes, 'Cash on Hand belongs in current assets.');
        $this->assertContains('2210', $liabilityCodes, 'VAT Payable belongs in current liabilities.');
    }

    // ═══ API + TENANCY ═════════════════════════════════════════════════════

    public function test_the_endpoints_return_the_statements(): void
    {
        $this->postSale();

        $this->actingAs($this->user)
            ->getJson('/api/finance/statements/income-statement?from='
                .Carbon::today()->startOfMonth()->toDateString().'&to='.Carbon::today()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.sections.revenue.total', fn ($v): bool => (float) $v === 1000.0);

        $this->actingAs($this->user)
            ->getJson('/api/finance/statements/balance-sheet?as_of='.Carbon::today()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.is_balanced', true);
    }

    public function test_the_income_statement_requires_a_valid_window(): void
    {
        $this->actingAs($this->user)
            ->getJson('/api/finance/statements/income-statement')
            ->assertStatus(422);

        // A window that ends before it starts is rejected rather than returning
        // an empty statement that looks like "no activity".
        $this->actingAs($this->user)
            ->getJson('/api/finance/statements/income-statement?from='
                .Carbon::today()->toDateString().'&to='.Carbon::today()->subMonth()->toDateString())
            ->assertStatus(422);
    }

    public function test_a_statement_never_shows_another_companys_books(): void
    {
        $this->postSale();

        $other = Company::factory()->create();
        $outsider = User::factory()->create(['company_id' => $other->id]);

        $response = $this->actingAs($outsider)
            ->getJson('/api/finance/statements/balance-sheet?as_of='.Carbon::today()->toDateString())
            ->assertOk();

        $this->assertSame(0.0, (float) $response->json('data.totals.total_assets'));
        $this->assertSame((string) $other->id, $response->json('data.company_id'));
    }

    public function test_the_statement_reconciles_with_the_posted_ledger(): void
    {
        $this->postSale();

        $s = $this->statements()->balanceSheet((string) $this->company->id, Carbon::today());

        // Independent check against the raw ledger: total debits must equal total
        // credits, and assets must equal the net debit balance of asset accounts.
        $totals = DB::table('finance_journal_lines')
            ->where('company_id', $this->company->id)
            ->selectRaw('COALESCE(SUM(debit),0) as d, COALESCE(SUM(credit),0) as c')
            ->first();

        $this->assertSame(round((float) $totals->d, 4), round((float) $totals->c, 4), 'The ledger itself is unbalanced.');
        $this->assertSame(1140.0, round((float) $s['totals']['total_assets'], 4));
    }
}
