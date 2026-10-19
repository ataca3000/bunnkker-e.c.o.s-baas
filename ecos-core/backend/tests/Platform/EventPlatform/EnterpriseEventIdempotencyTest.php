<?php

declare(strict_types=1);

namespace Tests\Platform\EventPlatform;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Modules\Platform\EventPlatform\Application\Jobs\HandleEnterpriseEventJob;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseDeadLetterQueueInterface;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventStoreInterface;
use Modules\Platform\EventPlatform\Domain\Enums\ProcessingStatus;
use Modules\Platform\EventPlatform\Domain\Models\EventProcessingLog;
use Modules\Platform\EventPlatform\Domain\ValueObjects\RetryPolicy;
use Tests\Platform\EventPlatform\Fixtures\TestOrderCreatedEvent;
use Tests\Platform\EventPlatform\Fixtures\TestOrderSubscriber;
use Tests\TestCase;

class EnterpriseEventIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_processing_log_is_created_on_handle(): void
    {
        $event = TestOrderCreatedEvent::make();
        $stored = $this->app->make(EnterpriseEventStoreInterface::class)->persist($event);

        $this->app->bind(TestOrderSubscriber::class, fn () => new TestOrderSubscriber);

        $job = new HandleEnterpriseEventJob(
            event: $event,
            subscriberClass: TestOrderSubscriber::class,
            retryPolicy: RetryPolicy::none(),
            storedEventId: $stored->id,
        );

        $job->handle($this->app->make(EnterpriseDeadLetterQueueInterface::class));

        $key = hash('sha256', $event->eventId().':'.TestOrderSubscriber::class);
        $this->assertDatabaseHas('enterprise_event_processing_log', [
            'idempotency_key' => $key,
            'status' => ProcessingStatus::Succeeded->value,
        ]);
    }

    public function test_duplicate_job_is_skipped(): void
    {
        $event = TestOrderCreatedEvent::make();
        $stored = $this->app->make(EnterpriseEventStoreInterface::class)->persist($event);
        $dlq = $this->app->make(EnterpriseDeadLetterQueueInterface::class);
        $key = hash('sha256', $event->eventId().':'.TestOrderSubscriber::class);

        // Seed an existing succeeded log entry
        EventProcessingLog::create([
            'id' => \Illuminate\Support\Str::uuid()->toString(),
            'event_id' => $event->eventId(),
            'subscriber_class' => TestOrderSubscriber::class,
            'idempotency_key' => $key,
            'status' => ProcessingStatus::Succeeded->value,
            'attempt_number' => 1,
        ]);

        TestOrderSubscriber::$callCount = 0;
        $this->app->bind(TestOrderSubscriber::class, fn () => new TestOrderSubscriber);

        $job = new HandleEnterpriseEventJob(
            event: $event,
            subscriberClass: TestOrderSubscriber::class,
            retryPolicy: RetryPolicy::none(),
            storedEventId: $stored->id,
        );
        $job->handle($dlq);

        // Subscriber must NOT have been called again
        $this->assertEquals(0, TestOrderSubscriber::$callCount);
    }
}
