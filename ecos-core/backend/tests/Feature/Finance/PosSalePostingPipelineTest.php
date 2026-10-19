<?php

declare(strict_types=1);

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Finance\Fiscal\Domain\Services\FiscalCalendarService;
use Modules\Finance\Infrastructure\Database\Seeders\AccountRoleSeeder;
use Modules\Finance\Infrastructure\Database\Seeders\ChartOfAccountsSeeder;
use Modules\Finance\Integration\Application\Bridge\EventPostingCatalog;
use Modules\Finance\Integration\Application\Bridge\EventPostingSubscriber;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\POS\Application\Contracts\AccountingPortInterface;
use Modules\POS\Application\Infrastructure\Adapters\EnterpriseBusAccountingAdapter;
use Tests\TestCase;

/**
 * POS → enterprise bus → Finance (EPIC-EVENTBUS-001).
 *
 * POS published its sales through Laravel's dispatcher and routed accounting
 * through a port bound to a no-op, while Finance subscribed on the enterprise
 * bus. The sale carried everything Finance needed and was already mapped in the
 * catalog — the two sides were simply on different transports.
 */
class PosSalePostingPipelineTest extends TestCase
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

    /** @return array<string, mixed> The payload a finalized sale carries. */
    private function salePayload(): array
    {
        return [
            'event_id' => 'evt-'.uniqid('', true),
            'event_name' => 'pos.sale.finalized',
            'company_id' => (string) $this->company->id,
            'sale_id' => 'sale-1',
            'warehouse_id' => 'wh-1',
            'currency' => 'EGP',
            'subtotal' => 1000.0,
            'discount_total' => 0.0,
            'grand_total' => 1140.0,
            'occurred_at' => now()->toIso8601String(),
        ];
    }

    /** The architectural fix: the port delegates to the bus, it does not bypass it. */
    public function test_the_pos_accounting_port_is_bound_to_the_enterprise_bus(): void
    {
        $this->assertInstanceOf(
            EnterpriseBusAccountingAdapter::class,
            app(AccountingPortInterface::class),
            'POS must route accounting through the enterprise bus, not a private pipeline.',
        );
    }

    public function test_a_finalized_sale_translates_into_a_financial_event(): void
    {
        $financial = app(EventPostingCatalog::class)
            ->translate('pos.sale.finalized', 'evt-1', $this->salePayload());

        $this->assertNotNull($financial, 'A finalized sale must translate.');
        $this->assertSame((string) $this->company->id, $financial->companyId);
        $this->assertSame(1000.0, $financial->amount('net'));
        $this->assertSame(140.0, $financial->amount('tax'));
        $this->assertSame(1140.0, $financial->amount('gross'));
    }

    public function test_a_finalized_sale_posts_a_balanced_journal_through_the_bridge(): void
    {
        $consumed = app(EventPostingSubscriber::class)->consumeSync(
            new class($this->salePayload()) {
                /** @param array<string, mixed> $p */
                public function __construct(private readonly array $p) {}

                public function eventName(): string
                {
                    return 'pos.sale.finalized';
                }

                public function eventId(): string
                {
                    return (string) $this->p['event_id'];
                }

                /** @return array<string, mixed> */
                public function toArray(): array
                {
                    return $this->p;
                }
            },
        );

        $this->assertNotNull($consumed, 'The bridge must post a finalized sale.');

        $journalId = DB::table('finance_journal_entries')
            ->where('company_id', $this->company->id)
            ->orderByDesc('id')
            ->value('id');

        $lines = DB::table('finance_journal_lines as l')
            ->join('finance_accounts as a', 'a.id', '=', 'l.account_id')
            ->where('l.journal_entry_id', $journalId)
            ->get(['a.code', 'l.debit', 'l.credit']);

        $this->assertSame(
            round((float) $lines->sum('debit'), 4),
            round((float) $lines->sum('credit'), 4),
            'A POS sale must post a balanced journal.',
        );

        $codes = $lines->pluck('code')->all();
        $this->assertContains('1110', $codes);  // DR Cash on Hand
        $this->assertContains('4110', $codes);  // CR Product Sales
        $this->assertContains('2210', $codes);  // CR VAT Payable (Output)
    }

    public function test_a_sale_without_a_company_is_refused_not_guessed(): void
    {
        $payload = $this->salePayload();
        unset($payload['company_id']);

        $this->assertNull(
            app(EventPostingCatalog::class)->translate('pos.sale.finalized', 'evt-x', $payload),
            'Finance is multi-tenant: a sale with no company must never be posted to a guessed one.',
        );
    }
}
