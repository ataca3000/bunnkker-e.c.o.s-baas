<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Infrastructure\Database\Seeders\AccountRoleSeeder;
use Modules\Finance\Infrastructure\Database\Seeders\ChartOfAccountsSeeder;
use Modules\Finance\Integration\Domain\Enums\BusinessEventType;
use Modules\Finance\Integration\Domain\Services\FinancialEventProcessor;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;
use Modules\Organization\Companies\Domain\Models\Company;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The inventory posting pipeline, end to end (TASK-FIN-004A).
 *
 * Event → rule → account role → journal → ledger → audit → receipt, for every
 * inventory scenario. Nine rules used to name a generic 'inventory' role that
 * resolves to nothing; they now defer to the class the event states.
 */
class InventoryPostingPipelineTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $cid = (string) $this->company->id;

        (new ChartOfAccountsSeeder)->seedCompany($cid);
        (new AccountRoleSeeder)->seedCompany($cid);

        $start = Carbon::today()->startOfMonth();
        app(FiscalCalendarService::class)->createYear(
            $cid, 'FY-'.substr($cid, 0, 8), $start, $start->copy()->addMonths(11)->endOfMonth(),
        );

        config(['finance.integration.posting_mode' => 'sync']);
    }

    private function event(string $code, string $class = 'raw_material', ?string $key = null): FinancialEvent
    {
        return new FinancialEvent(
            companyId: (string) $this->company->id,
            eventType: BusinessEventType::from($code),
            sourceModule: explode('.', $code)[0],
            entityType: 'inventory_item',
            entityId: 'item-1',
            amounts: ['net' => 1000.0, 'tax' => 140.0, 'gross' => 1140.0],
            occurredAt: now(),
            idempotencyKey: $key ?? ($code.'-'.uniqid('', true)),
            dimensions: ['inventory_class' => $class],
        );
    }

    /** @return array<string, array{string}> */
    public static function inventoryScenarios(): array
    {
        return [
            'goods receipt' => ['inventory.goods_receipt'],
            'supplier return' => ['inventory.supplier_return'],
            'warehouse transfer' => ['inventory.warehouse_transfer'],
            'adjustment increase' => ['inventory.adjustment_increase'],
            'adjustment decrease' => ['inventory.adjustment_decrease'],
            'count gain' => ['inventory.count_gain'],
            'count loss' => ['inventory.count_loss'],
            'write off' => ['inventory.write_off'],
            'purchase return' => ['procurement.purchase_return'],
        ];
    }

    #[DataProvider('inventoryScenarios')]
    public function test_the_scenario_posts_a_balanced_journal_to_the_ledger(string $code): void
    {
        $outcome = app(FinancialEventProcessor::class)->process($this->event($code));

        $journalId = $outcome->journalEntryId ?? null;
        $this->assertNotNull($journalId, "{$code} did not produce a journal.");

        $lines = DB::table('finance_journal_lines')->where('journal_entry_id', $journalId)->get();
        $this->assertGreaterThanOrEqual(2, $lines->count(), "{$code} must post at least two ledger lines.");

        $this->assertSame(
            round((float) $lines->sum('debit'), 4),
            round((float) $lines->sum('credit'), 4),
            "{$code} produced an unbalanced journal.",
        );
    }

    #[DataProvider('inventoryScenarios')]
    public function test_the_scenario_resolves_every_account_role(string $code): void
    {
        $outcome = app(FinancialEventProcessor::class)->process($this->event($code));

        $accountIds = DB::table('finance_journal_lines')
            ->where('journal_entry_id', $outcome->journalEntryId)
            ->pluck('account_id');

        $this->assertNotEmpty($accountIds);

        // Every line must land on a postable account of this company — the
        // property that a generic role could never satisfy.
        $bad = DB::table('finance_accounts')
            ->whereIn('id', $accountIds)
            ->where(fn ($q) => $q->where('is_postable', false)
                ->orWhere('is_active', false)
                ->orWhere('company_id', '!=', $this->company->id))
            ->count();

        $this->assertSame(0, $bad, "{$code} posted to a non-postable, inactive or foreign account.");
    }

    /** The class chooses the account — that is the whole point of the change. */
    public function test_each_inventory_class_posts_to_its_own_account(): void
    {
        $seen = [];

        foreach (['raw_material' => '1420', 'packaging_material' => '1440', 'finished_good' => '1410'] as $class => $code) {
            $outcome = app(FinancialEventProcessor::class)
                ->process($this->event('inventory.goods_receipt', $class));

            $codes = DB::table('finance_journal_lines as l')
                ->join('finance_accounts as a', 'a.id', '=', 'l.account_id')
                ->where('l.journal_entry_id', $outcome->journalEntryId)
                ->pluck('a.code')->all();

            $this->assertContains($code, $codes, "Class {$class} must post to account {$code}.");
            $seen[] = $code;
        }

        $this->assertCount(3, array_unique($seen), 'The three classes must not collapse onto one account.');
    }

    public function test_an_event_without_a_class_is_refused_not_defaulted(): void
    {
        $event = new FinancialEvent(
            companyId: (string) $this->company->id,
            eventType: BusinessEventType::from('inventory.goods_receipt'),
            sourceModule: 'inventory',
            entityType: 'inventory_item',
            entityId: 'item-x',
            amounts: ['net' => 100.0],
            occurredAt: now(),
            idempotencyKey: 'no-class-'.uniqid('', true),
            dimensions: [], // no inventory_class
        );

        $before = DB::table('finance_posting_dead_letters')->count();

        $outcome = app(FinancialEventProcessor::class)->process($event);

        // The refusal is parked, not thrown: the operational transaction is never
        // punished for an accounting gap. What matters is that nothing posted.
        $this->assertNull($outcome->journalEntryId, 'A classless event must not produce a journal.');
        $this->assertSame($before + 1, DB::table('finance_posting_dead_letters')->count());
    }

    public function test_an_unrecognised_class_is_refused_not_defaulted(): void
    {
        $before = DB::table('finance_posting_dead_letters')->count();

        // work_in_progress is a manufacturing state, never a class of stock, so
        // it must not quietly resolve to an inventory account.
        $outcome = app(FinancialEventProcessor::class)->process(
            $this->event('inventory.goods_receipt', 'work_in_progress'),
        );

        $this->assertNull($outcome->journalEntryId, 'An unrecognised class must not produce a journal.');
        $this->assertSame($before + 1, DB::table('finance_posting_dead_letters')->count());
    }

    public function test_audit_and_receipt_are_written_and_redelivery_posts_once(): void
    {
        $key = 'pipeline-idem-'.uniqid('', true);

        $first = app(FinancialEventProcessor::class)->process($this->event('inventory.goods_receipt', 'raw_material', $key));
        $second = app(FinancialEventProcessor::class)->process($this->event('inventory.goods_receipt', 'raw_material', $key));

        $this->assertSame($first->journalEntryId, $second->journalEntryId, 'Redelivery must return the original journal.');

        $this->assertSame(1, DB::table('finance_journal_entries')->where('source_event_id', $key)->count());
        $this->assertSame(1, DB::table('finance_posted_event_receipts')->where('source_event_id', $key)->count());

        // Both attempts are audited: the audit records what was attempted, the
        // receipt records what was posted.
        $this->assertSame(2, DB::table('finance_posting_audit')->where('company_id', $this->company->id)->count());
    }

    /**
     * A real transfer event, through the real catalog, to a real journal.
     *
     * The transfer was published all along and had a rule, a role and a complete
     * payload — it was simply never bridged onto the bus Finance listens to, and
     * had no catalog entry. This is the end-to-end proof that both gaps closed.
     */
    public function test_a_real_transfer_event_translates_and_posts(): void
    {
        $event = new \Modules\Inventory\DomainEvents\Events\InventoryTransferred(
            transferId: 'tr-1',
            productId: 'prod-1',
            companyId: (string) $this->company->id,
            sourceWarehouseId: 'wh-src',
            destinationWarehouseId: 'wh-dst',
            quantity: 4.0,
            totalCost: 400.0,
            weightedUnitCost: 100.0,
            transferNumber: 'TR-0001',
            inventoryClass: \Modules\Inventory\Products\Domain\Enums\InventoryClass::PackagingMaterial,
        );

        $financial = app(\Modules\Finance\Integration\Application\Bridge\EventPostingCatalog::class)
            ->translate($event->eventName(), $event->eventId(), $event->toArray());

        $this->assertNotNull($financial, 'A transfer must now translate into a financial event.');
        $this->assertSame(400.0, $financial->amount('net'));
        $this->assertSame('packaging_material', $financial->inventoryClass());

        $outcome = app(FinancialEventProcessor::class)->process($financial);

        $codes = DB::table('finance_journal_lines as l')
            ->join('finance_accounts as a', 'a.id', '=', 'l.account_id')
            ->where('l.journal_entry_id', $outcome->journalEntryId)
            ->pluck('a.code')->all();

        // Packaging leaves 1440 and lands in 1450 Goods In Transit.
        $this->assertContains('1440', $codes);
        $this->assertContains('1450', $codes);
    }

    public function test_no_inventory_posting_dead_letters(): void
    {
        $before = DB::table('finance_posting_dead_letters')->count();

        foreach (array_column(self::inventoryScenarios(), 0) as $code) {
            app(FinancialEventProcessor::class)->process($this->event($code));
        }

        $this->assertSame($before, DB::table('finance_posting_dead_letters')->count());
    }
}
