<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Modules\Finance\Fiscal\Domain\Enums\PeriodStatus;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Ledger\Domain\Enums\AccountType;
use Modules\Finance\Ledger\Domain\Enums\JournalStatus;
use Modules\Finance\Ledger\Domain\Enums\NormalBalance;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Models\JournalEntry;
use Modules\Finance\Ledger\Domain\Models\JournalLine;
use Modules\Finance\Ledger\Domain\Services\ChartOfAccountsService;
use Modules\Finance\Ledger\Domain\Services\JournalEngine;
use Modules\Finance\Ledger\Domain\Services\TrialBalanceService;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingLine;
use Modules\Finance\Ledger\Domain\ValueObjects\PostingRequest;
use Modules\Finance\Posting\Domain\Services\PostingCoordinator;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Finance OS — EPIC F1. Ledger Core & Fiscal Foundation.
 *
 * These tests protect the financial system of record: double entry,
 * immutability, exactly-once posting, period control and segregation of duties.
 * They are the guarantees every future accounting Epic depends on.
 */
class LedgerFoundationTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private FiscalPeriod $period;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        // A fiscal year whose first period covers today and is open.
        $this->period = $this->openPeriodForToday();
    }

    // (helper defined below)

    private function suffix(): string
    {
        return substr(md5(uniqid('', true)), 0, 8);
    }

    private function openPeriodForToday(): FiscalPeriod
    {
        $start = Carbon::today()->startOfMonth();
        $year = app(FiscalCalendarService::class)->createYear(
            (string) $this->company->id,
            'FY-'.$this->suffix(),
            $start,
            $start->copy()->addMonths(11)->endOfMonth(),
        );

        return $year->periods()->where('period_number', 1)->firstOrFail();
    }

    private function account(AccountType $type, bool $postable = true): Account
    {
        return app(ChartOfAccountsService::class)->create([
            'company_id' => (string) $this->company->id,
            'code' => strtoupper($type->value[0]).'-'.$this->suffix(),
            'name' => ucfirst($type->value).' account',
            'account_type' => $type,
            'is_postable' => $postable,
        ]);
    }

    /** A balanced request: debit one account, credit another. */
    private function balanced(Account $debit, Account $credit, float $amount = 100.0, ?Carbon $date = null): PostingRequest
    {
        $company = (string) $this->company->id;

        return new PostingRequest(
            companyId: $company,
            entryDate: $date ?? Carbon::today(),
            lines: [
                PostingLine::debit((int) $debit->id, $amount, $company),
                PostingLine::credit((int) $credit->id, $amount, $company),
            ],
            description: 'test',
        );
    }

    // ═══ DOUBLE ENTRY ════════════════════════════════════════════════════════

    public function test_a_balanced_journal_posts(): void
    {
        $cash = $this->account(AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);

        $entry = app(JournalEngine::class)->post($this->balanced($cash, $revenue, 250));

        $this->assertSame(JournalStatus::Posted, $entry->status);
        $this->assertSame(250.0, (float) $entry->totalDebit());
        $this->assertSame(250.0, (float) $entry->totalCredit());
        $this->assertCount(2, $entry->lines);
    }

    public function test_an_unbalanced_journal_is_refused(): void
    {
        $cash = $this->account(AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $company = (string) $this->company->id;

        $request = new PostingRequest(
            companyId: $company,
            entryDate: Carbon::today(),
            lines: [
                PostingLine::debit((int) $cash->id, 100, $company),
                PostingLine::credit((int) $revenue->id, 90, $company), // ≠
            ],
        );

        $this->expectException(FinanceException::class);
        $this->expectExceptionMessage('does not balance');
        app(JournalEngine::class)->post($request);
    }

    public function test_a_line_cannot_be_both_sides(): void
    {
        $company = (string) $this->company->id;
        $this->expectException(FinanceException::class);
        // Both debit and credit — rejected at construction.
        new PostingLine(1, 50.0, 50.0, $company);
    }

    public function test_a_journal_needs_at_least_two_lines(): void
    {
        $cash = $this->account(AccountType::Asset);
        $company = (string) $this->company->id;

        $request = new PostingRequest(
            companyId: $company,
            entryDate: Carbon::today(),
            lines: [PostingLine::debit((int) $cash->id, 100, $company)],
        );

        $this->expectException(FinanceException::class);
        app(JournalEngine::class)->post($request);
    }

    public function test_a_non_postable_account_is_refused(): void
    {
        $parent = $this->account(AccountType::Asset, postable: false);
        $revenue = $this->account(AccountType::Revenue);

        $this->expectException(FinanceException::class);
        $this->expectExceptionMessage('rollup account');
        app(JournalEngine::class)->post($this->balanced($parent, $revenue));
    }

    public function test_normal_balance_is_derived_from_account_type(): void
    {
        $this->assertSame(NormalBalance::Debit, $this->account(AccountType::Asset)->normal_balance);
        $this->assertSame(NormalBalance::Debit, $this->account(AccountType::Expense)->normal_balance);
        $this->assertSame(NormalBalance::Credit, $this->account(AccountType::Liability)->normal_balance);
        $this->assertSame(NormalBalance::Credit, $this->account(AccountType::Revenue)->normal_balance);
        $this->assertSame(NormalBalance::Credit, $this->account(AccountType::Equity)->normal_balance);
    }

    public function test_a_control_account_cannot_be_posted_manually(): void
    {
        // A control account is postable (a subledger posts to it in F3) but is
        // barred from MANUAL journals.
        $control = app(ChartOfAccountsService::class)->create([
            'company_id' => (string) $this->company->id,
            'code' => 'AR-'.$this->suffix(),
            'name' => 'Accounts Receivable',
            'account_type' => AccountType::Asset,
            'is_control' => true,
            'control_subledger' => 'ar',
        ]);
        $revenue = $this->account(AccountType::Revenue);
        $company = (string) $this->company->id;

        $request = new PostingRequest(
            companyId: $company,
            entryDate: Carbon::today(),
            lines: [
                PostingLine::debit((int) $control->id, 100, $company),
                PostingLine::credit((int) $revenue->id, 100, $company),
            ],
            source: 'manual',
        );

        $this->expectException(FinanceException::class);
        $this->expectExceptionMessage('control account and cannot be posted to manually');
        app(JournalEngine::class)->post($request);
    }

    public function test_an_account_category_must_match_its_type(): void
    {
        $this->expectException(FinanceException::class);
        $this->expectExceptionMessage('belongs to');
        app(ChartOfAccountsService::class)->create([
            'company_id' => (string) $this->company->id,
            'code' => 'X-'.$this->suffix(),
            'name' => 'Bad',
            'account_type' => AccountType::Asset,
            'account_category' => \Modules\Finance\Ledger\Domain\Enums\AccountCategory::OperatingExpense, // wrong type
        ]);
    }

    public function test_a_manual_journal_is_typed_manual_and_a_reversal_is_typed_reversal(): void
    {
        $entry = app(JournalEngine::class)->submitDraft(
            $this->balanced($this->account(AccountType::Asset), $this->account(AccountType::Revenue)),
            makerId: 3,
        );
        $this->assertSame(\Modules\Finance\Ledger\Domain\Enums\JournalType::Manual, $entry->journal_type);

        $posted = app(JournalEngine::class)->approveAndPost($entry, checkerId: 4);
        $reversal = app(JournalEngine::class)->reverse($posted, 'fix');
        $this->assertSame(\Modules\Finance\Ledger\Domain\Enums\JournalType::Reversal, $reversal->journal_type);
    }

    // ═══ IMMUTABILITY ════════════════════════════════════════════════════════

    public function test_a_posted_line_cannot_be_updated(): void
    {
        $entry = app(JournalEngine::class)->post(
            $this->balanced($this->account(AccountType::Asset), $this->account(AccountType::Revenue))
        );

        $line = $entry->lines->first();
        $this->assertFalse($line->update(['debit' => 999]));
        $this->assertNotSame('999.0000', (string) $line->refresh()->debit);
    }

    public function test_a_posted_entry_cannot_be_deleted(): void
    {
        $entry = app(JournalEngine::class)->post(
            $this->balanced($this->account(AccountType::Asset), $this->account(AccountType::Revenue))
        );

        $this->assertFalse($entry->delete());
        $this->assertNotNull($entry->fresh());
    }

    public function test_a_posted_entrys_identity_is_frozen(): void
    {
        $entry = app(JournalEngine::class)->post(
            $this->balanced($this->account(AccountType::Asset), $this->account(AccountType::Revenue))
        );

        // Changing the date of a posted entry is refused.
        $this->assertFalse($entry->update(['entry_date' => Carbon::today()->subYear()->toDateString()]));
    }

    // ═══ REVERSAL ════════════════════════════════════════════════════════════

    public function test_reversing_a_journal_creates_a_balanced_mirror(): void
    {
        $cash = $this->account(AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $original = app(JournalEngine::class)->post($this->balanced($cash, $revenue, 400));

        $reversal = app(JournalEngine::class)->reverse($original, 'error');

        $this->assertSame($original->id, $reversal->reverses_journal_id);
        $this->assertSame(JournalStatus::Reversed, $original->refresh()->status);
        $this->assertSame($reversal->id, $original->refresh()->reversed_by_journal_id);

        // The mirror swaps sides and still balances.
        $this->assertSame(400.0, (float) $reversal->totalDebit());
        $this->assertSame(400.0, (float) $reversal->totalCredit());
        $origDebitAccount = $original->lines->firstWhere('debit', '>', 0)->account_id;
        $revCreditAccount = $reversal->lines->firstWhere('credit', '>', 0)->account_id;
        $this->assertSame($origDebitAccount, $revCreditAccount);
    }

    public function test_a_journal_cannot_be_reversed_twice(): void
    {
        $entry = app(JournalEngine::class)->post(
            $this->balanced($this->account(AccountType::Asset), $this->account(AccountType::Revenue))
        );
        app(JournalEngine::class)->reverse($entry, 'first');

        $this->expectException(FinanceException::class);
        $this->expectExceptionMessage('already been reversed');
        app(JournalEngine::class)->reverse($entry->refresh(), 'second');
    }

    // ═══ IDEMPOTENCY ═════════════════════════════════════════════════════════

    public function test_the_same_source_event_posts_exactly_once(): void
    {
        $cash = $this->account(AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $eventId = 'evt-'.$this->suffix();

        $first = app(PostingCoordinator::class)->post('sales', $eventId, $this->balanced($cash, $revenue));
        $second = app(PostingCoordinator::class)->post('sales', $eventId, $this->balanced($cash, $revenue));

        // Same journal — no duplicate posting; exactly one journal exists.
        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, JournalEntry::where('company_id', $this->company->id)->count());
    }

    // ═══ PERIOD CONTROL ══════════════════════════════════════════════════════

    public function test_posting_into_a_closed_period_is_refused(): void
    {
        $cash = $this->account(AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);

        app(FiscalCalendarService::class)->closePeriod($this->period);

        $this->expectException(FinanceException::class);
        $this->expectExceptionMessage('only accepted while it is open');
        app(JournalEngine::class)->post($this->balanced($cash, $revenue));
    }

    public function test_a_period_cannot_skip_from_open_to_locked(): void
    {
        $this->expectException(FinanceException::class);
        app(FiscalCalendarService::class)->lockPeriod($this->period); // open → locked not allowed
    }

    public function test_a_locked_period_is_permanent(): void
    {
        app(FiscalCalendarService::class)->closePeriod($this->period);
        $locked = app(FiscalCalendarService::class)->lockPeriod($this->period->refresh());

        $this->assertSame(PeriodStatus::Locked, $locked->status);
        $this->assertFalse($locked->status->canTransitionTo(PeriodStatus::Open));
    }

    // ═══ SEGREGATION OF DUTIES ═══════════════════════════════════════════════

    public function test_the_maker_cannot_approve_their_own_journal(): void
    {
        $entry = app(JournalEngine::class)->submitDraft(
            $this->balanced($this->account(AccountType::Asset), $this->account(AccountType::Revenue)),
            makerId: 7,
        );

        $this->assertSame(JournalStatus::Draft, $entry->status);

        $this->expectException(FinanceException::class);
        $this->expectExceptionMessage('may not approve it');
        app(JournalEngine::class)->approveAndPost($entry, checkerId: 7); // same person
    }

    public function test_a_different_checker_can_approve_and_post(): void
    {
        $entry = app(JournalEngine::class)->submitDraft(
            $this->balanced($this->account(AccountType::Asset), $this->account(AccountType::Revenue)),
            makerId: 7,
        );

        $posted = app(JournalEngine::class)->approveAndPost($entry, checkerId: 9);

        $this->assertSame(JournalStatus::Posted, $posted->status);
        $this->assertSame(7, (int) $posted->created_by);
        $this->assertSame(9, (int) $posted->approved_by);
    }

    // ═══ TRIAL BALANCE (read model) ══════════════════════════════════════════

    public function test_the_trial_balance_always_ties(): void
    {
        $cash = $this->account(AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        app(JournalEngine::class)->post($this->balanced($cash, $revenue, 500));
        app(JournalEngine::class)->post($this->balanced($cash, $revenue, 300));

        $tb = app(TrialBalanceService::class)->forPeriod((string) $this->company->id, $this->period->id);

        $this->assertTrue($tb['is_balanced']);
        $this->assertSame($tb['total_debit'], $tb['total_credit']);
        $this->assertSame(800.0, $tb['total_debit']);
    }

    public function test_no_balance_table_exists_the_trial_balance_is_derived(): void
    {
        // No stored/running balance — the trial balance is a read model over lines.
        foreach (['finance_account_balances', 'finance_balances', 'finance_period_balances'] as $table) {
            $this->assertFalse(
                \Illuminate\Support\Facades\Schema::hasTable($table),
                "F1 stores no balances; {$table} must not exist."
            );
        }
    }

    // ═══ ARCHITECTURE — ONE WRITER ═══════════════════════════════════════════

    /** The Journal Engine is the ONLY writer of the ledger tables. */
    public function test_only_the_journal_engine_writes_the_ledger(): void
    {
        $dir = base_path('Modules/Finance');
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));

        foreach ($it as $file) {
            if (! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }

            $path = $file->getPathname();
            if (str_ends_with($path, 'JournalEngine.php')) {
                continue; // the sanctioned sole writer
            }

            $source = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', (string) file_get_contents($path));

            // No other file may construct a journal entry or line directly.
            foreach (['JournalEntry::create(', 'JournalLine::create(', '->lines()->create('] as $write) {
                $this->assertStringNotContainsString(
                    $write,
                    (string) $source,
                    basename($path).' must not write the ledger — only the Journal Engine may.'
                );
            }
        }
    }

    /** The Posting Coordinator requests journals; it never writes them. */
    public function test_the_posting_coordinator_does_not_write_the_ledger(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Finance/Posting/Domain/Services/PostingCoordinator.php')
        );

        $this->assertStringContainsString('$this->engine->post(', $source);
        $this->assertStringNotContainsString('JournalEntry::create(', $source);
        $this->assertStringNotContainsString('JournalLine::create(', $source);
    }

    public function test_a_journal_line_is_append_only_at_the_model(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Finance/Ledger/Domain/Models/JournalLine.php')
        );
        $this->assertStringContainsString('static::updating(static fn () => false)', $source);
    }
}
