<?php

declare(strict_types=1);

namespace Tests\Platform\EventPlatform;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseDeadLetterQueueInterface;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventStoreInterface;
use RuntimeException;
use Tests\Platform\EventPlatform\Fixtures\TestOrderCreatedEvent;
use Tests\TestCase;

class EnterpriseDeadLetterQueueTest extends TestCase
{
    use RefreshDatabase;

    private EnterpriseDeadLetterQueueInterface $dlq;

    private EnterpriseEventStoreInterface $store;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dlq = $this->app->make(EnterpriseDeadLetterQueueInterface::class);
        $this->store = $this->app->make(EnterpriseEventStoreInterface::class);
    }

    public function test_enqueue_creates_dlq_entry(): void
    {
        $event = TestOrderCreatedEvent::make();
        $stored = $this->store->persist($event);
        $failure = new RuntimeException('Processing failed');

        $entry = $this->dlq->enqueue($event, 'TestSubscriber', $failure, 3, $stored->id);

        $this->assertNotNull($entry->id);
        $this->assertEquals($event->eventId(), $entry->event_id);
        $this->assertEquals('Processing failed', $entry->failure_reason);
        $this->assertEquals(3, $entry->retry_count);
        $this->assertEquals('pending', $entry->dlq_status);
    }

    public function test_pending_entries_returns_only_pending(): void
    {
        $event1 = TestOrderCreatedEvent::make(companyId: 'co-1');
        $event2 = TestOrderCreatedEvent::make(companyId: 'co-1');
        $stored1 = $this->store->persist($event1);
        $stored2 = $this->store->persist($event2);
        $failure = new RuntimeException('err');

        $entry1 = $this->dlq->enqueue($event1, 'Sub1', $failure, 1, $stored1->id);
        $entry2 = $this->dlq->enqueue($event2, 'Sub2', $failure, 1, $stored2->id);

        $this->dlq->markDiscarded($entry2->id);

        $pending = $this->dlq->pendingEntries('co-1');
        $this->assertCount(1, $pending);
        $this->assertEquals($entry1->id, $pending->first()->id);
    }

    public function test_mark_replayed_updates_status_and_timestamp(): void
    {
        $event = TestOrderCreatedEvent::make();
        $stored = $this->store->persist($event);
        $entry = $this->dlq->enqueue($event, 'Sub', new RuntimeException('e'), 1, $stored->id);

        $this->dlq->markReplayed($entry->id);
        $entry->refresh();

        $this->assertEquals('replayed', $entry->dlq_status);
        $this->assertNotNull($entry->replayed_at);
    }

    public function test_count_returns_pending_only(): void
    {
        $event1 = TestOrderCreatedEvent::make(companyId: 'co-99');
        $stored1 = $this->store->persist($event1);
        $failure = new RuntimeException('x');

        $entry = $this->dlq->enqueue($event1, 'Sub', $failure, 1, $stored1->id);
        $this->assertEquals(1, $this->dlq->count('co-99'));

        $this->dlq->markReplayed($entry->id);
        $this->assertEquals(0, $this->dlq->count('co-99'));
    }
}
