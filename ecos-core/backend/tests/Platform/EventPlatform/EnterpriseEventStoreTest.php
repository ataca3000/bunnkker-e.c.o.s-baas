<?php

declare(strict_types=1);

namespace Tests\Platform\EventPlatform;

use DateTimeImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventStoreInterface;
use Tests\Platform\EventPlatform\Fixtures\TestOrderCreatedEvent;
use Tests\TestCase;

class EnterpriseEventStoreTest extends TestCase
{
    use RefreshDatabase;

    private EnterpriseEventStoreInterface $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->store = $this->app->make(EnterpriseEventStoreInterface::class);
    }

    public function test_persist_and_find_by_id(): void
    {
        $event = TestOrderCreatedEvent::make(companyId: 'company-1');
        $stored = $this->store->persist($event);

        $found = $this->store->findById($event->eventId());

        $this->assertNotNull($found);
        $this->assertEquals($event->eventId(), $found->event_id);
        $this->assertEquals($event->eventName(), $found->event_name);
    }

    public function test_query_by_company(): void
    {
        $this->store->persist(TestOrderCreatedEvent::make(companyId: 'co-A'));
        $this->store->persist(TestOrderCreatedEvent::make(companyId: 'co-B'));
        $this->store->persist(TestOrderCreatedEvent::make(companyId: 'co-A'));

        $results = $this->store->queryByCompany('co-A');
        $this->assertCount(2, $results);
    }

    public function test_query_by_aggregate(): void
    {
        $event1 = TestOrderCreatedEvent::make(aggregateId: 'order-1');
        $event2 = TestOrderCreatedEvent::make(aggregateId: 'order-2');
        $this->store->persist($event1);
        $this->store->persist($event2);

        $results = $this->store->queryByAggregate('Order', 'order-1');
        $this->assertCount(1, $results);
        $this->assertEquals('order-1', $results->first()->aggregate_id);
    }

    public function test_query_by_correlation(): void
    {
        $correlationId = 'corr-abc-123';
        $this->store->persist(TestOrderCreatedEvent::make(correlationId: $correlationId));
        $this->store->persist(TestOrderCreatedEvent::make(correlationId: $correlationId));
        $this->store->persist(TestOrderCreatedEvent::make(correlationId: 'other-corr'));

        $results = $this->store->queryByCorrelation($correlationId);
        $this->assertCount(2, $results);
    }

    public function test_mark_published_updates_status(): void
    {
        $event = TestOrderCreatedEvent::make();
        $stored = $this->store->persist($event);

        $this->store->markPublished($event->eventId());
        $stored->refresh();

        $this->assertEquals('published', $stored->status->value);
    }

    public function test_mark_dead_lettered(): void
    {
        $event = TestOrderCreatedEvent::make();
        $this->store->persist($event);
        $this->store->markDeadLettered($event->eventId());

        $found = $this->store->findById($event->eventId());
        $this->assertEquals('dead_lettered', $found->status->value);
    }

    public function test_query_by_time_range(): void
    {
        $event = TestOrderCreatedEvent::make();
        $this->store->persist($event);

        $from = new DateTimeImmutable('1 hour ago');
        $to = new DateTimeImmutable('1 hour from now');
        $results = $this->store->queryByTimeRange($from, $to);

        $this->assertTrue($results->isNotEmpty());
    }
}
