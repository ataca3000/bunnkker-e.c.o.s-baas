<?php

declare(strict_types=1);

namespace Tests\Feature\Crm;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Modules\Crm\Loyalty\Domain\Events\LoyaltyPointsEarned;
use Modules\Crm\Loyalty\Domain\Events\LoyaltyPointsRedeemed;
use Modules\Crm\Customers\Domain\Enums\CustomerType;
use Modules\Crm\Customers\Domain\Services\CustomerService;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyAccount;
use Modules\Crm\Loyalty\Domain\Services\LoyaltyProgramService;
use Modules\Crm\Loyalty\Domain\Services\PointsService;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * CRM loyalty enterprise events (EPIC-CRM-EVENTS-001).
 *
 * CRM published nothing, so Finance's crm.loyalty_earn and crm.loyalty_redeem
 * rules had no operational trigger. These tests pin the properties a consumer
 * depends on: exactly one event per ledger movement, the right event for the
 * direction, a payload carrying only CRM's own facts, and an envelope the
 * enterprise bus already understands.
 */
class LoyaltyEventsTest extends TestCase
{
    use DatabaseTransactions;

    private Company $company;

    private LoyaltyAccount $account;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $companyId = (string) $this->company->id;

        // Built through the real services, so the fixture obeys the same
        // constraints production does (customer_id is NOT NULL on an account).
        $customer = app(CustomerService::class)->create(
            $companyId,
            CustomerType::Individual,
            ['first_name' => 'Loyal', 'last_name' => 'Buyer'],
        );

        $program = app(LoyaltyProgramService::class)->create(
            $companyId,
            ['name' => 'Rewards', 'points_per_currency' => 1, 'redeem_rate' => 0.1],
        );

        $this->account = app(LoyaltyProgramService::class)
            ->enroll($companyId, $program, (string) $customer->id);
    }

    private function points(): PointsService
    {
        return app(PointsService::class);
    }

    public function test_earning_points_publishes_exactly_one_earned_event(): void
    {
        Event::fake([LoyaltyPointsEarned::class, LoyaltyPointsRedeemed::class]);

        $this->points()->earn($this->account, 120, 'promotion', 'promo-1');

        Event::assertDispatchedTimes(LoyaltyPointsEarned::class, 1);
        Event::assertNotDispatched(LoyaltyPointsRedeemed::class);
    }

    public function test_redeeming_points_publishes_exactly_one_redeemed_event(): void
    {
        $this->points()->earn($this->account, 200);

        Event::fake([LoyaltyPointsEarned::class, LoyaltyPointsRedeemed::class]);

        $this->points()->redeem($this->account, 50);

        Event::assertDispatchedTimes(LoyaltyPointsRedeemed::class, 1);
        Event::assertNotDispatched(LoyaltyPointsEarned::class);
    }

    /** The ledger signs redemptions negative; the event must report magnitude. */
    public function test_a_redemption_reports_a_positive_magnitude(): void
    {
        $this->points()->earn($this->account, 200);

        Event::fake([LoyaltyPointsRedeemed::class]);
        $this->points()->redeem($this->account, 75);

        Event::assertDispatched(LoyaltyPointsRedeemed::class, function (LoyaltyPointsRedeemed $e): bool {
            return $e->points === 75;
        });
    }

    /** A negative adjustment is a redemption; a positive one is an earn. */
    public function test_an_adjustment_publishes_the_event_matching_its_direction(): void
    {
        Event::fake([LoyaltyPointsEarned::class, LoyaltyPointsRedeemed::class]);

        $this->points()->adjust($this->account, 40, 'correction');
        $this->points()->adjust($this->account, -15, 'correction');

        Event::assertDispatchedTimes(LoyaltyPointsEarned::class, 1);
        Event::assertDispatchedTimes(LoyaltyPointsRedeemed::class, 1);
    }

    public function test_the_payload_carries_only_facts_crm_owns(): void
    {
        Event::fake([LoyaltyPointsEarned::class]);

        $txn = $this->points()->earn($this->account, 90, 'order', 'ref-9');

        Event::assertDispatched(LoyaltyPointsEarned::class, function (LoyaltyPointsEarned $e) use ($txn): bool {
            $p = $e->toArray();

            return $p['company_id'] === (string) $this->company->id
                && $p['account_id'] === (string) $this->account->id
                && $p['loyalty_transaction_id'] === (string) $txn->id
                && $p['points'] === 90
                && $p['source_type'] === 'order'
                && $p['source_reference'] === 'ref-9';
        });
    }

    /** The envelope the enterprise bus and event store already understand. */
    public function test_the_event_satisfies_the_platform_contract(): void
    {
        $event = new LoyaltyPointsEarned(
            companyId: (string) $this->company->id,
            accountId: (string) $this->account->id,
            customerId: null,
            loyaltyTransactionId: 'txn-1',
            points: 10,
        );

        $this->assertInstanceOf(DomainEvent::class, $event);
        $this->assertSame('crm.loyalty.points_earned', $event->eventName());
        $this->assertSame(1, $event->eventVersion());

        foreach (['event_id', 'event_name', 'version', 'correlation_id', 'occurred_at'] as $key) {
            $this->assertArrayHasKey($key, $event->toArray(), "Envelope is missing '{$key}'.");
        }
    }

    /** Identity must be stable, or a redelivered event cannot be deduped. */
    public function test_the_event_id_is_stable_and_unique(): void
    {
        $a = new LoyaltyPointsEarned((string) $this->company->id, 'acc', null, 'txn-1', 5);
        $b = new LoyaltyPointsEarned((string) $this->company->id, 'acc', null, 'txn-1', 5);

        $this->assertSame($a->eventId(), $a->eventId(), 'eventId must not change between reads.');
        $this->assertNotSame($a->eventId(), $b->eventId(), 'Two events must not share an id.');
    }

    /** Queue-safety: the payload must survive a serialize/deserialize round trip. */
    public function test_the_payload_is_serializable(): void
    {
        $event = new LoyaltyPointsEarned((string) $this->company->id, 'acc', null, 'txn-1', 25, 12.5);

        $decoded = json_decode((string) json_encode($event->toArray()), true);

        $this->assertSame(25, $decoded['points']);
        $this->assertSame(12.5, $decoded['amount']);
        $this->assertSame('crm.loyalty.points_earned', $decoded['event_name']);
    }

    /** A failed movement must publish nothing — no consumer may see phantom points. */
    public function test_a_rejected_redemption_publishes_nothing(): void
    {
        Event::fake([LoyaltyPointsEarned::class, LoyaltyPointsRedeemed::class]);

        try {
            $this->points()->redeem($this->account, 10_000);
        } catch (\Throwable) {
            // expected — the account has no balance
        }

        Event::assertNotDispatched(LoyaltyPointsRedeemed::class);
    }
}
