<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Finance\Allocation\Domain\Services\AllocationEngine;
use Modules\Finance\Banking\Domain\Services\BankingService;
use Modules\Finance\Banking\Domain\Services\BankReconciliationService;
use Modules\Finance\Cash\Domain\Services\CashService;
use Modules\Finance\Fiscal\Domain\Models\FiscalPeriod;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Ledger\Domain\Enums\AccountType;
use Modules\Finance\Ledger\Domain\Exceptions\FinanceException;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Services\ChartOfAccountsService;
use Modules\Finance\Payables\Domain\Enums\PaymentStatus;
use Modules\Finance\Payables\Domain\Enums\SupplierDocumentType;
use Modules\Finance\Payables\Domain\Services\AccountsPayableService;
use Modules\Finance\Payables\Domain\Services\ApAgingService;
use Modules\Finance\Payables\Domain\Services\SupplierLedgerService;
use Modules\Finance\Receivables\Domain\Enums\CustomerDocumentType;
use Modules\Finance\Receivables\Domain\Services\AccountsReceivableService;
use Modules\Finance\Receivables\Domain\Services\ArAgingService;
use Modules\Finance\Receivables\Domain\Services\CustomerLedgerService;
use Modules\Finance\Shared\Domain\Services\ControlAccountReconciliationService;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Finance OS — EPIC F2. Subledgers (AR / AP / Cash / Banking).
 *
 * These tests protect the subledger guarantees: every posting flows through the
 * Posting Engine (never a direct GL write), the party ledgers reconcile to the
 * GL control accounts, allocation is a derived relationship, and segregation of
 * duties holds where money leaves the business.
 */
class SubledgersTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private string $companyId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->companyId = (string) $this->company->id;
        $this->openPeriodForToday();
    }

    // ═══ ACCOUNTS RECEIVABLE ═══════════════════════════════════════════════════

    public function test_posting_an_invoice_moves_the_control_account_and_writes_the_customer_ledger(): void
    {
        $customer = (string) Str::uuid();
        $arControl = $this->controlAccount('ar', AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);

        $invoice = app(AccountsReceivableService::class)->createDocument(
            companyId: $this->companyId,
            customerId: $customer,
            number: 'INV-'.$this->suffix(),
            documentDate: Carbon::today(),
            lines: [['revenue_account_id' => (int) $revenue->id, 'net_amount' => 100.0]],
        );
        $posted = app(AccountsReceivableService::class)->postDocument($invoice);

        $this->assertTrue($posted->isPosted());
        $this->assertNotNull($posted->journal_entry_id);
        $this->assertSame(100.0, app(CustomerLedgerService::class)->balance($this->companyId, $customer));

        // The subledger ties to the GL control account.
        $recon = app(ControlAccountReconciliationService::class)->receivable($this->companyId);
        $this->assertTrue($recon['is_reconciled']);
        $this->assertSame(100.0, $recon['gl_balance']);
        $this->assertSame(100.0, $recon['subledger_balance']);
    }

    public function test_a_receipt_partially_settles_an_invoice_and_leaves_it_open(): void
    {
        $customer = (string) Str::uuid();
        $this->controlAccount('ar', AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $cash = $this->account(AccountType::Asset);

        $invoice = $this->postedInvoice($customer, $revenue, 100.0);

        $receipt = app(AccountsReceivableService::class)->createReceipt(
            companyId: $this->companyId, customerId: $customer, number: 'RC-'.$this->suffix(),
            receiptDate: Carbon::today(), amount: 40.0, depositAccountId: (int) $cash->id,
        );
        app(AccountsReceivableService::class)->postReceipt($receipt);
        app(AllocationEngine::class)->allocateReceipt($receipt, $invoice, 40.0);

        $this->assertSame(60.0, $invoice->fresh()->outstanding());
        $this->assertSame(0.0, $receipt->fresh()->unallocatedAmount());
        $this->assertSame(60.0, app(CustomerLedgerService::class)->balance($this->companyId, $customer));
    }

    public function test_one_receipt_allocates_across_multiple_invoices(): void
    {
        $customer = (string) Str::uuid();
        $this->controlAccount('ar', AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $cash = $this->account(AccountType::Asset);

        $a = $this->postedInvoice($customer, $revenue, 30.0);
        $b = $this->postedInvoice($customer, $revenue, 50.0);

        $receipt = app(AccountsReceivableService::class)->createReceipt(
            companyId: $this->companyId, customerId: $customer, number: 'RC-'.$this->suffix(),
            receiptDate: Carbon::today(), amount: 100.0, depositAccountId: (int) $cash->id,
        );
        app(AccountsReceivableService::class)->postReceipt($receipt);
        app(AllocationEngine::class)->autoAllocateReceipt($receipt);

        $this->assertSame(0.0, $a->fresh()->outstanding());
        $this->assertSame(0.0, $b->fresh()->outstanding());
        // The unallocated 20 sits on account (derived).
        $this->assertSame(20.0, $receipt->fresh()->unallocatedAmount());
    }

    public function test_allocating_more_than_the_invoice_outstanding_is_refused(): void
    {
        $customer = (string) Str::uuid();
        $this->controlAccount('ar', AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $cash = $this->account(AccountType::Asset);

        $invoice = $this->postedInvoice($customer, $revenue, 50.0);
        $receipt = app(AccountsReceivableService::class)->createReceipt(
            companyId: $this->companyId, customerId: $customer, number: 'RC-'.$this->suffix(),
            receiptDate: Carbon::today(), amount: 200.0, depositAccountId: (int) $cash->id,
        );
        app(AccountsReceivableService::class)->postReceipt($receipt);

        $this->expectException(FinanceException::class);
        app(AllocationEngine::class)->allocateReceipt($receipt, $invoice, 80.0);
    }

    public function test_a_receipt_cannot_be_allocated_to_another_customers_invoice(): void
    {
        $this->controlAccount('ar', AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $cash = $this->account(AccountType::Asset);

        $invoice = $this->postedInvoice((string) Str::uuid(), $revenue, 50.0);
        $receipt = app(AccountsReceivableService::class)->createReceipt(
            companyId: $this->companyId, customerId: (string) Str::uuid(), number: 'RC-'.$this->suffix(),
            receiptDate: Carbon::today(), amount: 50.0, depositAccountId: (int) $cash->id,
        );
        app(AccountsReceivableService::class)->postReceipt($receipt);

        $this->expectException(FinanceException::class);
        app(AllocationEngine::class)->allocateReceipt($receipt, $invoice, 50.0);
    }

    public function test_writing_off_an_invoice_clears_its_outstanding(): void
    {
        $customer = (string) Str::uuid();
        $this->controlAccount('ar', AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $badDebt = $this->account(AccountType::Expense);

        $invoice = $this->postedInvoice($customer, $revenue, 75.0);

        app(AccountsReceivableService::class)->writeOff(
            invoice: $invoice, badDebtAccountId: (int) $badDebt->id, allocations: app(AllocationEngine::class),
        );

        $this->assertSame(0.0, $invoice->fresh()->outstanding());
        $this->assertSame(0.0, app(CustomerLedgerService::class)->balance($this->companyId, $customer));
    }

    public function test_a_posted_invoice_is_immutable(): void
    {
        $customer = (string) Str::uuid();
        $this->controlAccount('ar', AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $invoice = $this->postedInvoice($customer, $revenue, 100.0);

        $invoice->total = 999.0;
        $this->assertFalse($invoice->save());
        $this->assertSame(100.0, (float) $invoice->fresh()->total);
    }

    public function test_ar_aging_buckets_an_overdue_invoice(): void
    {
        $customer = (string) Str::uuid();
        $this->controlAccount('ar', AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);

        $invoice = app(AccountsReceivableService::class)->createDocument(
            companyId: $this->companyId, customerId: $customer, number: 'INV-'.$this->suffix(),
            documentDate: Carbon::today()->subDays(45), lines: [['revenue_account_id' => (int) $revenue->id, 'net_amount' => 100.0]],
            dueDate: Carbon::today()->subDays(45),
        );
        app(AccountsReceivableService::class)->postDocument($invoice);

        $aging = app(ArAgingService::class)->report($this->companyId, Carbon::today(), $customer);
        $this->assertSame(100.0, $aging['totals']['31_60']);
        $this->assertSame(0.0, $aging['totals']['current']);
    }

    // ═══ ACCOUNTS PAYABLE ══════════════════════════════════════════════════════

    public function test_posting_a_bill_moves_the_ap_control_and_writes_the_supplier_ledger(): void
    {
        $supplier = (string) Str::uuid();
        $this->controlAccount('ap', AccountType::Liability);
        $expense = $this->account(AccountType::Expense);

        $bill = app(AccountsPayableService::class)->createDocument(
            companyId: $this->companyId, supplierId: $supplier, number: 'BILL-'.$this->suffix(),
            documentDate: Carbon::today(), lines: [['expense_account_id' => (int) $expense->id, 'net_amount' => 200.0]],
        );
        app(AccountsPayableService::class)->postDocument($bill);

        $this->assertSame(200.0, app(SupplierLedgerService::class)->balance($this->companyId, $supplier));

        $recon = app(ControlAccountReconciliationService::class)->payable($this->companyId);
        $this->assertTrue($recon['is_reconciled']);
        $this->assertSame(200.0, $recon['gl_balance']);
    }

    public function test_a_supplier_payment_requires_a_different_approver_before_it_posts(): void
    {
        $supplier = (string) Str::uuid();
        $this->controlAccount('ap', AccountType::Liability);
        $bank = $this->account(AccountType::Asset);

        $maker = 101;
        $payment = app(AccountsPayableService::class)->createPayment(
            companyId: $this->companyId, supplierId: $supplier, number: 'PAY-'.$this->suffix(),
            paymentDate: Carbon::today(), amount: 60.0, fundingAccountId: (int) $bank->id, createdBy: $maker,
        );

        // Cannot post while still a draft.
        try {
            app(AccountsPayableService::class)->postPayment($payment);
            $this->fail('A draft payment must not post.');
        } catch (FinanceException) {
            // expected
        }

        // The maker cannot approve their own payment.
        try {
            app(AccountsPayableService::class)->approvePayment($payment, $maker);
            $this->fail('The maker must not approve their own payment.');
        } catch (FinanceException) {
            // expected
        }

        // A different checker approves, then it posts.
        app(AccountsPayableService::class)->approvePayment($payment, 202);
        $posted = app(AccountsPayableService::class)->postPayment($payment->fresh());

        $this->assertSame(PaymentStatus::Posted, $posted->status);
        $this->assertNotNull($posted->journal_entry_id);
    }

    public function test_a_payment_allocates_to_a_bill_and_reduces_its_outstanding(): void
    {
        $supplier = (string) Str::uuid();
        $this->controlAccount('ap', AccountType::Liability);
        $expense = $this->account(AccountType::Expense);
        $bank = $this->account(AccountType::Asset);

        $bill = $this->postedBill($supplier, $expense, 200.0);
        $payment = app(AccountsPayableService::class)->createPayment(
            companyId: $this->companyId, supplierId: $supplier, number: 'PAY-'.$this->suffix(),
            paymentDate: Carbon::today(), amount: 120.0, fundingAccountId: (int) $bank->id, createdBy: 1,
        );
        app(AccountsPayableService::class)->approvePayment($payment, 2);
        app(AccountsPayableService::class)->postPayment($payment->fresh());
        app(AllocationEngine::class)->allocatePayment($payment->fresh(), $bill, 120.0);

        $this->assertSame(80.0, $bill->fresh()->outstanding());
        $this->assertSame(80.0, app(SupplierLedgerService::class)->balance($this->companyId, $supplier));
    }

    public function test_ap_credit_note_reduces_the_payable(): void
    {
        $supplier = (string) Str::uuid();
        $this->controlAccount('ap', AccountType::Liability);
        $expense = $this->account(AccountType::Expense);

        $this->postedBill($supplier, $expense, 200.0);
        $creditNote = app(AccountsPayableService::class)->createDocument(
            companyId: $this->companyId, supplierId: $supplier, number: 'SCN-'.$this->suffix(),
            documentDate: Carbon::today(), lines: [['expense_account_id' => (int) $expense->id, 'net_amount' => 50.0]],
            type: SupplierDocumentType::CreditNote,
        );
        app(AccountsPayableService::class)->postDocument($creditNote);

        $this->assertSame(150.0, app(SupplierLedgerService::class)->balance($this->companyId, $supplier));
        $this->assertTrue(app(ControlAccountReconciliationService::class)->payable($this->companyId)['is_reconciled']);
    }

    // ═══ CASH ══════════════════════════════════════════════════════════════════

    public function test_a_cash_receipt_posts_a_balanced_journal(): void
    {
        $cashGl = $this->account(AccountType::Asset);
        $income = $this->account(AccountType::Revenue);
        $account = app(CashService::class)->createAccount($this->companyId, 'TILL-'.$this->suffix(), 'Till', (int) $cashGl->id);

        $txn = app(CashService::class)->recordTransaction($account, 'receipt', 25.0, (int) $income->id);

        $this->assertNotNull($txn->journal_entry_id);
        $this->assertSame(25.0, (float) $txn->journalEntry->totalDebit());
        $this->assertSame(25.0, (float) $txn->journalEntry->totalCredit());
    }

    public function test_a_cash_transfer_moves_between_two_accounts_with_one_balanced_journal(): void
    {
        $glA = $this->account(AccountType::Asset);
        $glB = $this->account(AccountType::Asset);
        $from = app(CashService::class)->createAccount($this->companyId, 'A-'.$this->suffix(), 'A', (int) $glA->id);
        $to = app(CashService::class)->createAccount($this->companyId, 'B-'.$this->suffix(), 'B', (int) $glB->id);

        $result = app(CashService::class)->transfer($from, $to, 40.0);

        $this->assertSame($result['out']->journal_entry_id, $result['in']->journal_entry_id);
        $this->assertSame(40.0, (float) $result['out']->journalEntry->totalDebit());
    }

    public function test_only_one_cash_session_may_be_open_at_a_time(): void
    {
        $gl = $this->account(AccountType::Asset);
        $account = app(CashService::class)->createAccount($this->companyId, 'S-'.$this->suffix(), 'S', (int) $gl->id);

        app(CashService::class)->openSession($account, 100.0);
        $this->expectException(FinanceException::class);
        app(CashService::class)->openSession($account, 0.0);
    }

    // ═══ BANKING ═══════════════════════════════════════════════════════════════

    public function test_a_reconciliation_completes_only_when_the_difference_is_explained(): void
    {
        $gl = $this->account(AccountType::Asset);
        $account = app(BankingService::class)->createAccount($this->companyId, 'Main', (int) $gl->id);

        // Book balance is 0 (no postings). A statement showing +100 that we do not
        // match leaves an outstanding item of 100 — so 0 + 100 == 100 balances.
        $statement = app(BankingService::class)->importStatement(
            account: $account, statementDate: Carbon::today(), openingBalance: 0.0, closingBalance: 100.0,
            lines: [['value_date' => Carbon::today()->toDateString(), 'amount' => 100.0, 'description' => 'Deposit']],
        );

        $recon = app(BankReconciliationService::class)->start($statement);
        $completed = app(BankReconciliationService::class)->complete($recon);
        $this->assertTrue($completed->isCompleted());
    }

    public function test_a_reconciliation_with_an_unexplained_residual_is_blocked(): void
    {
        $gl = $this->account(AccountType::Asset);
        $account = app(BankingService::class)->createAccount($this->companyId, 'Main', (int) $gl->id);

        // Book 0, statement 100, but NO lines to explain it → residual 100.
        $statement = app(BankingService::class)->importStatement(
            account: $account, statementDate: Carbon::today(), openingBalance: 0.0, closingBalance: 100.0, lines: [
                ['value_date' => Carbon::today()->toDateString(), 'amount' => 0.0, 'description' => 'noise'],
            ],
        );
        $recon = app(BankReconciliationService::class)->start($statement);

        $this->expectException(FinanceException::class);
        app(BankReconciliationService::class)->complete($recon);
    }

    public function test_a_rule_auto_matches_a_statement_line(): void
    {
        $gl = $this->account(AccountType::Asset);
        $income = $this->account(AccountType::Revenue);
        $account = app(BankingService::class)->createAccount($this->companyId, 'Main', (int) $gl->id);

        app(BankingService::class)->createRule(
            companyId: $this->companyId, name: 'Salary', matchValue: 'SALARY',
            targetAccountId: (int) $income->id,
        );

        $statement = app(BankingService::class)->importStatement(
            account: $account, statementDate: Carbon::today(), openingBalance: 0.0, closingBalance: 0.0, lines: [
                ['value_date' => Carbon::today()->toDateString(), 'amount' => 500.0, 'description' => 'ACME SALARY MAR'],
                ['value_date' => Carbon::today()->toDateString(), 'amount' => 10.0, 'description' => 'unrelated'],
            ],
        );
        $recon = app(BankReconciliationService::class)->start($statement);

        $matched = app(BankReconciliationService::class)->autoMatch($recon);
        $this->assertSame(1, $matched);
        $this->assertSame(1, app(BankReconciliationService::class)->outstandingItems($recon)['count']);
    }

    // ═══ SOURCE SCAN — subledgers never write the GL ══════════════════════════

    public function test_no_subledger_service_writes_the_general_ledger_directly(): void
    {
        $base = base_path('Modules/Finance');
        $services = [
            '/Receivables/Domain/Services/AccountsReceivableService.php',
            '/Payables/Domain/Services/AccountsPayableService.php',
            '/Allocation/Domain/Services/AllocationEngine.php',
            '/Cash/Domain/Services/CashService.php',
            '/Banking/Domain/Services/BankingService.php',
            '/Banking/Domain/Services/BankReconciliationService.php',
        ];

        // The GL is the Journal Engine's alone. A subledger must post ONLY through
        // the Posting Coordinator — never the engine, never the journal tables.
        $forbidden = [
            'JournalEngine',
            'JournalEntry::create',
            'new JournalEntry',
            "finance_journal_entries')",
            "finance_journal_lines')",
        ];

        foreach ($services as $relative) {
            $source = file_get_contents($base.$relative);
            foreach ($forbidden as $needle) {
                $this->assertStringNotContainsString(
                    $needle,
                    $source,
                    "Subledger {$relative} must not touch the GL directly ({$needle}).",
                );
            }
        }
    }

    public function test_customer_and_supplier_ledger_entries_are_append_only(): void
    {
        $customer = (string) Str::uuid();
        $this->controlAccount('ar', AccountType::Asset);
        $revenue = $this->account(AccountType::Revenue);
        $this->postedInvoice($customer, $revenue, 100.0);

        $entry = \Modules\Finance\Receivables\Domain\Models\CustomerLedgerEntry::query()
            ->where('company_id', $this->companyId)->where('customer_id', $customer)->firstOrFail();

        $entry->amount = 999.0;
        $this->assertFalse($entry->save());
        $this->assertFalse($entry->delete());
    }

    // ═══ HELPERS ═══════════════════════════════════════════════════════════════

    private function suffix(): string
    {
        return substr(md5(uniqid('', true)), 0, 8);
    }

    private function openPeriodForToday(): FiscalPeriod
    {
        $start = Carbon::today()->subMonths(3)->startOfMonth();
        $year = app(FiscalCalendarService::class)->createYear(
            $this->companyId, 'FY-'.$this->suffix(), $start, $start->copy()->addMonths(11)->endOfMonth(),
        );

        // Open every period in the year so back-dated documents post.
        foreach ($year->periods as $period) {
            if ($period->status->value !== 'open') {
                app(FiscalCalendarService::class)->openPeriod($period);
            }
        }

        return $year->periods()->where('period_number', 1)->firstOrFail();
    }

    private function account(AccountType $type, bool $postable = true): Account
    {
        return app(ChartOfAccountsService::class)->create([
            'company_id' => $this->companyId,
            'code' => strtoupper($type->value[0]).'-'.$this->suffix(),
            'name' => ucfirst($type->value).' account',
            'account_type' => $type,
            'is_postable' => $postable,
        ]);
    }

    private function controlAccount(string $subledger, AccountType $type): Account
    {
        return app(ChartOfAccountsService::class)->create([
            'company_id' => $this->companyId,
            'code' => strtoupper($subledger).'-CTRL-'.$this->suffix(),
            'name' => strtoupper($subledger).' control',
            'account_type' => $type,
            'is_postable' => true,
            'is_control' => true,
            'control_subledger' => $subledger,
        ]);
    }

    private function postedInvoice(string $customer, Account $revenue, float $amount)
    {
        $invoice = app(AccountsReceivableService::class)->createDocument(
            companyId: $this->companyId, customerId: $customer, number: 'INV-'.$this->suffix(),
            documentDate: Carbon::today(), lines: [['revenue_account_id' => (int) $revenue->id, 'net_amount' => $amount]],
            type: CustomerDocumentType::Invoice, dueDate: Carbon::today(),
        );

        return app(AccountsReceivableService::class)->postDocument($invoice);
    }

    private function postedBill(string $supplier, Account $expense, float $amount)
    {
        $bill = app(AccountsPayableService::class)->createDocument(
            companyId: $this->companyId, supplierId: $supplier, number: 'BILL-'.$this->suffix(),
            documentDate: Carbon::today(), lines: [['expense_account_id' => (int) $expense->id, 'net_amount' => $amount]],
            type: SupplierDocumentType::Bill, dueDate: Carbon::today(),
        );

        return app(AccountsPayableService::class)->postDocument($bill);
    }
}
