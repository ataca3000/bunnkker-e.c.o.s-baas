<?php

declare(strict_types=1);

namespace Tests\Feature\Crm;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Modules\Crm\Customers\Domain\Enums\CustomerStatus;
use Modules\Crm\Customers\Domain\Enums\CustomerType;
use Modules\Crm\Customers\Domain\Events\CustomerArchived;
use Modules\Crm\Customers\Domain\Events\CustomerCreated;
use Modules\Crm\Customers\Domain\Events\CustomerMerged;
use Modules\Crm\Customers\Domain\Events\CustomerRestored;
use Modules\Crm\Customers\Domain\Events\CustomerUpdated;
use Modules\Crm\Customers\Domain\Services\CustomerMergeService;
use Modules\Crm\Customers\Domain\Services\CustomerService;
use Modules\Crm\Sales\Domain\Enums\LeadStatus;
use Modules\Crm\Sales\Domain\Events\LeadConverted;
use Modules\Crm\Sales\Domain\Events\LeadCreated;
use Modules\Crm\Sales\Domain\Events\LeadLost;
use Modules\Crm\Sales\Domain\Events\LeadQualified;
use Modules\Crm\Sales\Domain\Events\OpportunityCreated;
use Modules\Crm\Sales\Domain\Events\OpportunityLost;
use Modules\Crm\Sales\Domain\Events\OpportunityUpdated;
use Modules\Crm\Sales\Domain\Events\OpportunityWon;
use Modules\Crm\Sales\Domain\Events\QuoteApproved;
use Modules\Crm\Sales\Domain\Events\QuoteCreated;
use Modules\Crm\Sales\Domain\Events\QuoteRejected;
use Modules\Crm\Sales\Domain\Services\LeadService;
use Modules\Crm\Sales\Domain\Services\OpportunityService;
use Modules\Crm\Sales\Domain\Services\QuoteService;
use Modules\Crm\Shared\Domain\Events\CrmDomainEvent;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * Customer and sales enterprise events (EPIC-CRM-EVENTS-001B).
 *
 * The properties a subscriber depends on: one event per workflow, the right
 * event for the direction a status moved, and a payload of CRM's own facts.
 */
class CustomerAndSalesEventsTest extends TestCase
{
    use DatabaseTransactions;

    private string $companyId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->companyId = (string) Company::factory()->create()->id;
    }

    private function customer(string $first = 'Ada'): object
    {
        return app(CustomerService::class)->create(
            $this->companyId,
            CustomerType::Individual,
            ['first_name' => $first, 'last_name' => 'Lovelace'],
        );
    }

    // ═══ CUSTOMERS ═════════════════════════════════════════════════════════

    public function test_creating_a_customer_publishes_one_event(): void
    {
        Event::fake([CustomerCreated::class]);

        $c = $this->customer();

        Event::assertDispatchedTimes(CustomerCreated::class, 1);
        Event::assertDispatched(CustomerCreated::class, fn (CustomerCreated $e): bool => $e->customerId === (string) $c->id
            && $e->companyId === $this->companyId
            && $e->customerType === CustomerType::Individual->value);
    }

    public function test_updating_a_customer_names_the_changed_fields(): void
    {
        $c = $this->customer();
        Event::fake([CustomerUpdated::class]);

        app(CustomerService::class)->update($c, ['city' => 'Cairo']);

        Event::assertDispatched(CustomerUpdated::class, fn (CustomerUpdated $e): bool => in_array('city', $e->changedFields, true));
    }

    /** A no-op update must stay quiet rather than announcing a change that did not happen. */
    public function test_an_update_that_changes_nothing_publishes_nothing(): void
    {
        $c = $this->customer();
        Event::fake([CustomerUpdated::class]);

        app(CustomerService::class)->update($c->fresh(), []);

        Event::assertNotDispatched(CustomerUpdated::class);
    }

    public function test_archiving_and_restoring_publish_their_own_events(): void
    {
        $c = $this->customer();
        Event::fake([CustomerArchived::class, CustomerRestored::class]);

        $archived = app(CustomerService::class)->setStatus($c, CustomerStatus::Archived);
        Event::assertDispatchedTimes(CustomerArchived::class, 1);

        app(CustomerService::class)->setStatus($archived, CustomerStatus::Active);
        Event::assertDispatchedTimes(CustomerRestored::class, 1);
    }

    /** A status move that is neither archive nor restore is internal detail. */
    public function test_an_unrelated_status_move_publishes_nothing(): void
    {
        $c = $this->customer();
        Event::fake([CustomerArchived::class, CustomerRestored::class]);

        app(CustomerService::class)->setStatus($c, CustomerStatus::Inactive);

        Event::assertNotDispatched(CustomerArchived::class);
        Event::assertNotDispatched(CustomerRestored::class);
    }

    public function test_merging_publishes_both_ids(): void
    {
        $winner = $this->customer('Winner');
        $loser = $this->customer('Loser');

        Event::fake([CustomerMerged::class]);
        app(CustomerMergeService::class)->merge($winner, $loser);

        Event::assertDispatched(CustomerMerged::class, fn (CustomerMerged $e): bool => $e->winnerCustomerId === (string) $winner->id
            && $e->loserCustomerId === (string) $loser->id);
    }

    // ═══ LEADS ═════════════════════════════════════════════════════════════

    public function test_lead_lifecycle_publishes_the_matching_events(): void
    {
        Event::fake([LeadCreated::class, LeadQualified::class, LeadLost::class]);

        $lead = app(LeadService::class)->create($this->companyId, ['name' => 'Prospect']);
        Event::assertDispatchedTimes(LeadCreated::class, 1);

        app(LeadService::class)->setStatus($lead, LeadStatus::Qualified);
        Event::assertDispatchedTimes(LeadQualified::class, 1);

        app(LeadService::class)->setStatus($lead->fresh(), LeadStatus::Unqualified);
        Event::assertDispatchedTimes(LeadLost::class, 1);
    }

    public function test_converting_a_lead_publishes_the_customer_it_created(): void
    {
        $lead = app(LeadService::class)->create($this->companyId, ['name' => 'Convertible']);

        Event::fake([LeadConverted::class]);
        $result = app(LeadService::class)->convert($lead, ['name' => 'deal']);

        Event::assertDispatched(LeadConverted::class, fn (LeadConverted $e): bool => $e->leadId === (string) $lead->id
            && $e->customerId === (string) $result['customer_id']);
    }

    // ═══ OPPORTUNITIES ═════════════════════════════════════════════════════

    public function test_winning_an_opportunity_publishes_won_only_once(): void
    {
        $opp = app(OpportunityService::class)->create($this->companyId, ['name' => 'Deal', 'amount' => 500]);

        Event::fake([OpportunityWon::class, OpportunityUpdated::class]);
        app(OpportunityService::class)->win($opp);

        Event::assertDispatchedTimes(OpportunityWon::class, 1);
        Event::assertNotDispatched(OpportunityUpdated::class);
    }

    public function test_losing_an_opportunity_carries_the_reason(): void
    {
        $opp = app(OpportunityService::class)->create($this->companyId, ['name' => 'Deal']);

        Event::fake([OpportunityLost::class]);
        app(OpportunityService::class)->lose($opp, 'Price');

        Event::assertDispatched(OpportunityLost::class, fn (OpportunityLost $e): bool => $e->reason === 'Price');
    }

    public function test_creating_an_opportunity_publishes_its_value(): void
    {
        Event::fake([OpportunityCreated::class]);

        app(OpportunityService::class)->create($this->companyId, ['name' => 'Deal', 'amount' => 750]);

        Event::assertDispatched(OpportunityCreated::class, fn (OpportunityCreated $e): bool => $e->amount === 750.0);
    }

    // ═══ QUOTES ════════════════════════════════════════════════════════════

    public function test_quote_lifecycle_publishes_created_approved_and_rejected(): void
    {
        Event::fake([QuoteCreated::class, QuoteApproved::class, QuoteRejected::class]);

        $quote = app(QuoteService::class)->create($this->companyId, [], [
            ['description' => 'Item', 'quantity' => 1, 'unit_price' => 100],
        ]);
        Event::assertDispatchedTimes(QuoteCreated::class, 1);

        app(QuoteService::class)->accept($quote);
        Event::assertDispatchedTimes(QuoteApproved::class, 1);

        $other = app(QuoteService::class)->create($this->companyId, [], [
            ['description' => 'Item', 'quantity' => 1, 'unit_price' => 50],
        ]);
        app(QuoteService::class)->reject($other);
        Event::assertDispatchedTimes(QuoteRejected::class, 1);
    }

    // ═══ CONTRACT ══════════════════════════════════════════════════════════

    public function test_every_event_carries_the_platform_envelope(): void
    {
        $events = [
            new CustomerCreated($this->companyId, 'c1', 'individual'),
            new LeadCreated($this->companyId, 'l1'),
            new OpportunityWon($this->companyId, 'o1'),
            new QuoteApproved($this->companyId, 'q1'),
        ];

        foreach ($events as $event) {
            $this->assertInstanceOf(CrmDomainEvent::class, $event);

            $payload = $event->toArray();
            foreach (['event_id', 'event_name', 'version', 'correlation_id', 'occurred_at', 'company_id'] as $key) {
                $this->assertArrayHasKey($key, $payload, $event::class." is missing '{$key}'.");
            }

            // Queue safety: the payload must survive a JSON round trip intact.
            $this->assertSame($payload, json_decode((string) json_encode($payload), true));
        }
    }
}
