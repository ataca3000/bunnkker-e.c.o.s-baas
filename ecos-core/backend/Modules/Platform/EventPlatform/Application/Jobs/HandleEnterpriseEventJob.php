<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Application\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseDeadLetterQueueInterface;
use Modules\Platform\EventPlatform\Domain\Enums\ProcessingStatus;
use Modules\Platform\EventPlatform\Domain\Models\EventProcessingLog;
use Modules\Platform\EventPlatform\Domain\Models\StoredEvent;
use Modules\Platform\EventPlatform\Domain\ValueObjects\RetryPolicy;
use Throwable;

class HandleEnterpriseEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries;

    public array $backoff;

    public int $timeout = 30;

    private string $storedEventId;

    public function __construct(
        private readonly DomainEvent $event,
        private readonly string $subscriberClass,
        private readonly RetryPolicy $retryPolicy,
        string $storedEventId,
        string $queue = 'default',
    ) {
        $this->storedEventId = $storedEventId;
        $this->tries = $retryPolicy->getMaxAttempts();
        $this->backoff = $retryPolicy->getDelays();
        $this->onQueue($queue);
    }

    public function handle(EnterpriseDeadLetterQueueInterface $dlq): void
    {
        // SHA-256 produces a 64-char hex string — fits the idempotency_key column without truncation.
        $idempotencyKey = hash('sha256', $this->event->eventId().':'.$this->subscriberClass);

        // ── Idempotency check ──────────────────────────────────────────────────
        $existing = EventProcessingLog::where('idempotency_key', $idempotencyKey)
            ->where('status', ProcessingStatus::Succeeded->value)
            ->first();

        if ($existing !== null) {
            // Already successfully processed — skip silently
            return;
        }

        // On retries a Failed row already exists — reuse it rather than inserting a duplicate key.
        $log = EventProcessingLog::where('idempotency_key', $idempotencyKey)->first();

        if ($log !== null) {
            $log->update([
                'status' => ProcessingStatus::Processing->value,
                'attempt_number' => $this->attempts(),
                'error_message' => null,
                'processed_at' => null,
            ]);
        } else {
            $log = EventProcessingLog::create([
                'id' => Str::uuid()->toString(),
                'event_id' => $this->event->eventId(),
                'subscriber_class' => $this->subscriberClass,
                'idempotency_key' => $idempotencyKey,
                'status' => ProcessingStatus::Processing->value,
                'attempt_number' => $this->attempts(),
            ]);
        }

        try {
            $subscriber = app($this->subscriberClass);
            $subscriber->handle($this->event);

            $log->update([
                'status' => ProcessingStatus::Succeeded->value,
                'processed_at' => now()->toIso8601String(),
            ]);

            // Mark the stored event as succeeded on first successful subscriber run
            StoredEvent::where('event_id', $this->event->eventId())
                ->update(['status' => 'succeeded']);

        } catch (Throwable $e) {
            $log->update([
                'status' => ProcessingStatus::Failed->value,
                'error_message' => $e->getMessage(),
                'processed_at' => now()->toIso8601String(),
            ]);

            // Let Laravel's retry mechanism handle it — failed() is called after all retries
            throw $e;
        }
    }

    /** Called by Laravel after all retry attempts are exhausted. */
    public function failed(Throwable $e): void
    {
        /** @var EnterpriseDeadLetterQueueInterface $dlq */
        $dlq = app(EnterpriseDeadLetterQueueInterface::class);

        $dlq->enqueue(
            event: $this->event,
            subscriberClass: $this->subscriberClass,
            failure: $e,
            retryCount: $this->retryPolicy->getMaxAttempts(),
            storedEventId: $this->storedEventId,
        );

        StoredEvent::where('event_id', $this->event->eventId())
            ->update(['status' => 'dead_lettered']);
    }
}
