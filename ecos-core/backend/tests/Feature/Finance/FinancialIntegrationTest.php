<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Integration\Application\Bridge\EventPostingCatalog;
use Modules\Finance\Integration\Application\Bridge\EventPostingSubscriber;
use Modules\Finance\Integration\Domain\Enums\BusinessEventType;
use Modules\Finance\Integration\Domain\Enums\PostingResult;
use Modules\Finance\Integration\Domain\Models\AccountRole;
use Modules\Finance\Integration\Domain\Models\PostingAuditEntry;
use Modules\Finance\Integration\Domain\Models\PostingDeadLetter;
use Modules\Finance\Integration\Domain\Services\DeadLetterService;
use Modules\Finance\Integration\Domain\Services\FinancialEventProcessor;
use Modules\Finance\Integration\Domain\Services\PostingTraceService;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;
use Modules\Finance\Ledger\Domain\Enums\AccountType;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Services\ChartOfAccountsService;
use Modules\Finance\Posting\Domain\Models\PostedEventReceipt;
use Modules\Finance\Posting\Domain\Models\PostingRule;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Finance OS — EPIC F3. Enterprise Financial Integration.
 *
 * These tests protect the integration guarantees: every supported business event
 * produces the correct journal through the Posting Engine (never a direct GL
 * write), exactly once, with complete traceability; unmappable events dead-letter
 * and replay safely; and events with no financial impact are recorded as skipped.
 */
class FinancialIntegrationTest extends TestCase
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

    // ═══ CORE PIPELINE ═════════════════════════════════════════════════════════

    public function test_a_goods_receipt_posts_the_correct_balanced_journal(): void
    {
        $inventory = $this->mapRole('raw_materials', AccountType::Asset);
        $this->mapRole('grni', AccountType::Liability);

        $outcome = $this->process(BusinessEventType::GoodsReceipt, ['net' => 500.0], 'gr-1');

        $this->assertSame(PostingResult::Posted, $outcome->result);
        $this->assertNotNull($outcome->journalEntryId);

        // DR inventory 500 / CR grni 500 — traceable and balanced.
        $trace = app(PostingTraceService::class)->forEntity($this->companyId, 'inventory_item', 'gr-1');
        $journal = $trace['postings'][0]['journal'];
        $this->assertSame(500.0, $journal['total_debit']);
        $this->assertSame(500.0, $journal['total_credit']);
        $invLine = collect($journal['lines'])->firstWhere('account_code', $inventory->code);
        $this->assertSame(500.0, $invLine['debit']);
    }

    public function test_posting_is_exactly_once(): void
    {
        $this->mapRole('raw_materials', AccountType::Asset);
        $this->mapRole('grni', AccountType::Liability);

        $first = $this->process(BusinessEventType::GoodsReceipt, ['net' => 100.0], 'dup-1');
        $second = $this->process(BusinessEventType::GoodsReceipt, ['net' => 100.0], 'dup-1');

        $this->assertSame(PostingResult::Posted, $first->result);
        $this->assertSame(PostingResult::Duplicate, $second->result);
        $this->assertSame($first->journalEntryId, $second->journalEntryId);

        // One receipt, one journal — no double count.
        $this->assertSame(1, PostedEventReceipt::query()
            ->where('source_module', 'inventory')
            ->where('source_event_id', BusinessEventType::GoodsReceipt->value.':dup-1')
            ->count());
    }

    public function test_an_event_with_no_rule_is_skipped_not_posted(): void
    {
        // Orders confirmation has no financial impact before revenue policy.
        $outcome = $this->process(BusinessEventType::OrderConfirmation, ['amount' => 999.0], 'ord-1');

        $this->assertSame(PostingResult::Skipped, $outcome->result);
        $this->assertNull($outcome->journalEntryId);
        $audit = PostingAuditEntry::query()
            ->where('source_event_id', BusinessEventType::OrderConfirmation->value.':ord-1')
            ->firstOrFail();
        $this->assertSame(PostingResult::Skipped, $audit->result);
    }

    public function test_an_unmapped_role_dead_letters_then_replays_after_mapping(): void
    {
        // inventory mapped, grni deliberately NOT — the event cannot post.
        $this->mapRole('raw_materials', AccountType::Asset);

        $failed = $this->process(BusinessEventType::GoodsReceipt, ['net' => 250.0], 'dl-1');
        $this->assertSame(PostingResult::Failed, $failed->result);
        $this->assertNotNull($failed->deadLetterUuid);

        $letter = PostingDeadLetter::query()->where('uuid', $failed->deadLetterUuid)->firstOrFail();
        $this->assertTrue($letter->isPending());

        // Fix the cause, then replay — idempotent, so it posts cleanly.
        $this->mapRole('grni', AccountType::Liability);
        $outcome = app(DeadLetterService::class)->retry($letter, app(FinancialEventProcessor::class));

        $this->assertTrue($outcome->isSuccessful());
        $this->assertSame('resolved', $letter->refresh()->status);
    }

    public function test_preview_does_not_post(): void
    {
        $this->mapRole('raw_materials', AccountType::Asset);
        $this->mapRole('grni', AccountType::Liability);

        $auditBefore = PostingAuditEntry::count();
        $receiptsBefore = PostedEventReceipt::count();

        $preview = app(FinancialEventProcessor::class)->preview(
            $this->event(BusinessEventType::GoodsReceipt, ['net' => 400.0], 'pv-1'),
        );

        $this->assertSame('previewed', $preview['result']);
        $this->assertTrue($preview['balanced']);
        $this->assertSame(400.0, $preview['total_debit']);
        // Nothing was written.
        $this->assertSame($auditBefore, PostingAuditEntry::count());
        $this->assertSame($receiptsBefore, PostedEventReceipt::count());
    }

    public function test_a_batch_of_events_all_post_and_are_traceable(): void
    {
        $this->mapRole('wip', AccountType::Asset);
        $this->mapRole('raw_materials', AccountType::Asset);
        $this->mapRole('finished_goods', AccountType::Asset);

        $events = [
            $this->event(BusinessEventType::MaterialConsumption, ['cost' => 60.0], 'b-1', 'work_order'),
            $this->event(BusinessEventType::MaterialConsumption, ['cost' => 40.0], 'b-2', 'work_order'),
            $this->event(BusinessEventType::ProductionCompletion, ['cost' => 100.0], 'b-3', 'work_order'),
        ];

        $outcomes = app(FinancialEventProcessor::class)->processBatch($events);

        $this->assertCount(3, $outcomes);
        foreach ($outcomes as $o) {
            $this->assertSame(PostingResult::Posted, $o->result);
        }
    }

    // ═══ PER-AREA JOURNAL CORRECTNESS ══════════════════════════════════════════

    public function test_procurement_invoice_accrues_vat_and_supplier_liability(): void
    {
        $this->mapRole('grni', AccountType::Liability);
        $vat = $this->mapRole('vat_input', AccountType::Asset);
        $ap = $this->mapRole('ap_control', AccountType::Liability);

        // net 100 + tax 14 = gross 114 — must balance.
        $outcome = $this->process(BusinessEventType::PurchaseMaterials, ['net' => 100.0, 'tax' => 14.0, 'gross' => 114.0], 'bill-1', 'supplier_bill');

        $this->assertSame(PostingResult::Posted, $outcome->result);
        $journal = app(PostingTraceService::class)->forJournal($this->companyId, $this->journalUuid($outcome))['journal'];
        $this->assertSame(114.0, $journal['total_debit']);
        $apLine = collect($journal['lines'])->firstWhere('account_code', $ap->code);
        $this->assertSame(114.0, $apLine['credit']);
        $vatLine = collect($journal['lines'])->firstWhere('account_code', $vat->code);
        $this->assertSame(14.0, $vatLine['debit']);
    }

    public function test_pos_sale_splits_revenue_and_output_tax(): void
    {
        $this->mapRole('cash', AccountType::Asset);
        $revenue = $this->mapRole('sales_revenue', AccountType::Revenue);
        $vat = $this->mapRole('vat_output', AccountType::Liability);

        $outcome = $this->process(BusinessEventType::PosSale, ['net' => 200.0, 'tax' => 28.0, 'gross' => 228.0], 'sale-1', 'pos_sale');
        $journal = app(PostingTraceService::class)->forJournal($this->companyId, $this->journalUuid($outcome))['journal'];

        $this->assertSame(228.0, $journal['total_debit']);
        $this->assertSame(200.0, collect($journal['lines'])->firstWhere('account_code', $revenue->code)['credit']);
        $this->assertSame(28.0, collect($journal['lines'])->firstWhere('account_code', $vat->code)['credit']);
    }

    public function test_shipment_cost_posts_expense_and_carrier_payable(): void
    {
        $expense = $this->mapRole('shipping_expense', AccountType::Expense);
        $payable = $this->mapRole('carrier_payable', AccountType::Liability);

        $outcome = $this->process(BusinessEventType::ShipmentCost, ['cost' => 45.0], 'ship-1', 'shipment');
        $journal = app(PostingTraceService::class)->forJournal($this->companyId, $this->journalUuid($outcome))['journal'];

        $this->assertSame(45.0, collect($journal['lines'])->firstWhere('account_code', $expense->code)['debit']);
        $this->assertSame(45.0, collect($journal['lines'])->firstWhere('account_code', $payable->code)['credit']);
    }

    public function test_loyalty_earn_recognises_a_liability(): void
    {
        $expense = $this->mapRole('loyalty_expense', AccountType::Expense);
        $liability = $this->mapRole('loyalty_liability', AccountType::Liability);

        $outcome = $this->process(BusinessEventType::LoyaltyEarn, ['amount' => 12.0], 'loy-1', 'loyalty_txn');
        $journal = app(PostingTraceService::class)->forJournal($this->companyId, $this->journalUuid($outcome))['journal'];

        $this->assertSame(12.0, collect($journal['lines'])->firstWhere('account_code', $expense->code)['debit']);
        $this->assertSame(12.0, collect($journal['lines'])->firstWhere('account_code', $liability->code)['credit']);
    }

    public function test_an_unbalanced_event_is_refused_and_dead_lettered(): void
    {
        $this->mapRole('grni', AccountType::Liability);
        $this->mapRole('vat_input', AccountType::Asset);
        $this->mapRole('ap_control', AccountType::Liability);

        // gross 999 ≠ net 100 + tax 14 → the engine refuses; the event dead-letters.
        $outcome = $this->process(BusinessEventType::PurchaseMaterials, ['net' => 100.0, 'tax' => 14.0, 'gross' => 999.0], 'bad-1', 'supplier_bill');

        $this->assertSame(PostingResult::Failed, $outcome->result);
        $this->assertNotNull($outcome->deadLetterUuid);
    }

    // ═══ CONFIG-DRIVEN (no hardcoding) ═════════════════════════════════════════

    public function test_a_company_override_rule_wins_over_the_global_template(): void
    {
        $cashB = $this->mapRole('cash_b', AccountType::Asset);
        $this->mapRole('sales_revenue', AccountType::Revenue);

        // Override pos.sale for this company: single-leg-pair against cash_b.
        PostingRule::create([
            'company_id' => $this->companyId,
            'code' => BusinessEventType::PosSale->value,
            'event_type' => BusinessEventType::PosSale->value,
            'description' => 'company override',
            'legs' => [
                ['side' => 'debit', 'role' => 'cash_b', 'source' => 'gross'],
                ['side' => 'credit', 'role' => 'sales_revenue', 'source' => 'gross'],
            ],
            'is_active' => true,
        ]);

        $outcome = $this->process(BusinessEventType::PosSale, ['gross' => 50.0], 'ovr-1', 'pos_sale');
        $journal = app(PostingTraceService::class)->forJournal($this->companyId, $this->journalUuid($outcome))['journal'];

        // The override used cash_b — proof the company rule was chosen.
        $this->assertNotNull(collect($journal['lines'])->firstWhere('account_code', $cashB->code));
    }

    // ═══ BRIDGE (event → FinancialEvent) ═══════════════════════════════════════

    public function test_the_catalog_translates_a_pos_sale_event(): void
    {
        $financial = app(EventPostingCatalog::class)->translate('pos.sale.finalized', 'evt-1', [
            'companyId' => $this->companyId,
            'saleId' => 'S-100',
            'subtotal' => 100.0,
            'discountTotal' => 0.0,
            'grandTotal' => 114.0,
            'currency' => 'EGP',
        ]);

        $this->assertNotNull($financial);
        $this->assertSame(BusinessEventType::PosSale, $financial->eventType);
        $this->assertSame(114.0, $financial->amount('gross'));
        $this->assertSame(14.0, $financial->amount('tax'));
    }

    public function test_the_subscriber_posts_a_translated_bus_event(): void
    {
        $this->mapRole('cash', AccountType::Asset);
        $this->mapRole('sales_revenue', AccountType::Revenue);
        $this->mapRole('vat_output', AccountType::Liability);

        $companyId = $this->companyId;
        $event = new class($companyId) {
            public function __construct(private string $companyId) {}

            public function eventName(): string
            {
                return 'pos.sale.finalized';
            }

            public function eventId(): string
            {
                return 'BUS-1';
            }

            /** @return array<string, mixed> */
            public function toArray(): array
            {
                return [
                    'companyId' => $this->companyId,
                    'saleId' => 'S-200',
                    'subtotal' => 200.0,
                    'discountTotal' => 0.0,
                    'grandTotal' => 228.0,
                    'currency' => 'EGP',
                ];
            }
        };

        $result = app(EventPostingSubscriber::class)->consumeSync($event);
        $this->assertSame('posted', $result);
    }

    // ═══ ARCHITECTURE / SOURCE SCAN ════════════════════════════════════════════

    public function test_the_integration_layer_never_writes_the_ledger_directly(): void
    {
        $dir = base_path('Modules/Finance/Integration');
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));

        $forbidden = ['JournalEngine', 'JournalEntry::create', 'new JournalEntry', "finance_journal_entries')", "finance_journal_lines')", '->lines()->create('];

        foreach ($it as $file) {
            if (! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }
            $source = (string) file_get_contents($file->getPathname());
            foreach ($forbidden as $needle) {
                $this->assertStringNotContainsString(
                    $needle, $source,
                    basename($file->getPathname()).' must post only through the Posting Engine — never the ledger.'
                );
            }
        }
    }

    public function test_audit_entries_are_append_only(): void
    {
        $this->mapRole('raw_materials', AccountType::Asset);
        $this->mapRole('grni', AccountType::Liability);
        $this->process(BusinessEventType::GoodsReceipt, ['net' => 10.0], 'ap-1');

        $entry = PostingAuditEntry::query()->latest('id')->firstOrFail();
        $entry->result = 'failed';
        $this->assertFalse($entry->save());
        $this->assertFalse($entry->delete());
    }

    // ═══ HELPERS ═══════════════════════════════════════════════════════════════

    private function suffix(): string
    {
        return substr(md5(uniqid('', true)), 0, 8);
    }

    private function openPeriodForToday(): void
    {
        $start = Carbon::today()->subMonths(2)->startOfMonth();
        $year = app(FiscalCalendarService::class)->createYear(
            $this->companyId, 'FY-'.$this->suffix(), $start, $start->copy()->addMonths(11)->endOfMonth(),
        );
        foreach ($year->periods as $period) {
            if ($period->status->value !== 'open') {
                app(FiscalCalendarService::class)->openPeriod($period);
            }
        }
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
        AccountRole::create([
            'company_id' => $this->companyId,
            'role' => $role,
            'account_id' => $account->id,
        ]);

        return $account;
    }

    /** @param array<string, float> $amounts */
    private function event(BusinessEventType $type, array $amounts, string $entityId, string $entityType = 'inventory_item'): FinancialEvent
    {
        return new FinancialEvent(
            companyId: $this->companyId,
            eventType: $type,
            sourceModule: $type->module(),
            entityType: $entityType,
            entityId: $entityId,
            amounts: $amounts,
            occurredAt: Carbon::today(),
            idempotencyKey: $type->value.':'.$entityId,
            // Inventory rules choose their account from the class the publisher
            // states (TASK-FIN-004A). These fixtures are raw material.
            dimensions: ['inventory_class' => 'raw_material'],
        );
    }

    /** @param array<string, float> $amounts */
    private function process(BusinessEventType $type, array $amounts, string $entityId, string $entityType = 'inventory_item')
    {
        return app(FinancialEventProcessor::class)->process($this->event($type, $amounts, $entityId, $entityType));
    }

    private function journalUuid($outcome): string
    {
        return (string) \Illuminate\Support\Facades\DB::table('finance_journal_entries')
            ->where('id', $outcome->journalEntryId)
            ->value('uuid');
    }
}
