<?php

declare(strict_types=1);

namespace Tests\Platform\EventPlatform;

use DateTimeImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventReplayService;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseDeadLetterQueueInterface;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventStoreInterface;
use RuntimeException;
use Tests\Platform\EventPlatform\Fixtures\TestOrderCreatedEvent;
use Tests\TestCase;

class EnterpriseEventReplayTest extends TestCase
{
    use RefreshDatabase;

    private EnterpriseEventReplayService $replayService;

    private EnterpriseEventStoreInterface $store;

    private EnterpriseDeadLetterQueueInterface $dlq;

    protected function setUp(): void
    {
        parent::setUp();
        $this->replayService = $this->app->make(EnterpriseEventReplayService::class);
        $this->store = $this->app->make(EnterpriseEventStoreInterface::class);
        $this->dlq = $this->app->make(EnterpriseDeadLetterQueueInterface::class);
    }

    public function test_replay_single_marks_event_as_replayed(): void
    {
        $event = TestOrderCreatedEvent::make();
        $stored = $this->store->persist($event);

        $this->replayService->replaySingle($stored->id);

        $found = $this->store->findById($event->eventId());
        $this->assertEquals('replayed', $found->status->value);
    }

    public function test_replay_single_throws_for_unknown_id(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->replayService->replaySingle('non-existent-id');
    }

    public function test_replay_by_aggregate_replays_all_matching_events(): void
    {
        $event1 = TestOrderCreatedEvent::make(aggregateId: 'order-replay-1');
        $event2 = TestOrderCreatedEvent::make(aggregateId: 'order-replay-1');
        $event3 = TestOrderCreatedEvent::make(aggregateId: 'order-other');
        $stored1 = $this->store->persist($event1);
        $stored2 = $this->store->persist($event2);
        $this->store->persist($event3);

        $count = $this->replayService->replayByAggregate('Order', 'order-replay-1');
        $this->assertEquals(2, $count);
    }

    public function test_replay_dlq_entry_marks_entry_as_replayed(): void
    {
        $event = TestOrderCreatedEvent::make();
        $stored = $this->store->persist($event);
        $failure = new RuntimeException('test failure');
        $entry = $this->dlq->enqueue($event, 'TestSub', $failure, 3, $stored->id);

        $this->replayService->replayDlqEntry($entry->id);

        $entry->refresh();
        $this->assertEquals('replayed', $entry->dlq_status);
        $this->assertNotNull($entry->replayed_at);
    }

    public function test_replay_by_time_range_returns_count(): void
    {
        $event = TestOrderCreatedEvent::make();
        $this->store->persist($event);

        $count = $this->replayService->replayByTimeRange(
            new DateTimeImmutable('2 hours ago'),
            new DateTimeImmutable('2 hours from now'),
        );

        $this->assertGreaterThanOrEqual(1, $count);
    }
}
