<?php

declare(strict_types=1);

namespace Modules\Finance\Integration\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Finance\Integration\Domain\Models\PostingDeadLetter;
use Modules\Finance\Integration\Domain\ValueObjects\FinancialEvent;
use Modules\Finance\Integration\Domain\ValueObjects\PostingOutcome;

/**
 * The dead-letter queue for financial events that could not post.
 *
 * A failed event is never lost and never silently retried into a duplicate: it
 * is captured here with its full payload, then replayed once the cause is fixed.
 * Replay goes back through the processor, whose idempotency key guarantees the
 * retry cannot double-post.
 */
final class DeadLetterService
{
    /** Capture (or bump the attempt count of) a failed event. */
    public function record(FinancialEvent $event, string $error): PostingDeadLetter
    {
        $existing = PostingDeadLetter::query()
            ->where('source_module', $event->sourceModule)
            ->where('source_event_id', $event->idempotencyKey)
            ->where('status', 'pending')
            ->first();

        if ($existing !== null) {
            $existing->update([
                'attempts' => $existing->attempts + 1,
                'error' => $error,
                'last_attempt_at' => Carbon::now(),
            ]);

            return $existing->refresh();
        }

        return PostingDeadLetter::create([
            'company_id' => $event->companyId,
            'source_module' => $event->sourceModule,
            'event_code' => $event->eventCode(),
            'source_entity_type' => $event->entityType,
            'source_entity_id' => $event->entityId,
            'source_event_id' => $event->idempotencyKey,
            'payload' => $event->toArray(),
            'error' => $error,
            'attempts' => 1,
            'status' => 'pending',
            'last_attempt_at' => Carbon::now(),
        ]);
    }

    /**
     * Replay a dead letter through the processor. On success it is marked
     * resolved; on failure its attempt count is bumped and it stays pending.
     */
    public function retry(PostingDeadLetter $letter, FinancialEventProcessor $processor, ?int $actorId = null): PostingOutcome
    {
        $event = FinancialEvent::fromArray($letter->payload);
        $outcome = $processor->process($event);

        if ($outcome->isSuccessful() || $outcome->result->value === 'skipped') {
            $letter->update([
                'status' => 'resolved',
                'resolved_at' => Carbon::now(),
                'resolved_by' => $actorId,
                'last_attempt_at' => Carbon::now(),
            ]);
        } else {
            $letter->update([
                'attempts' => $letter->attempts + 1,
                'error' => $outcome->error,
                'last_attempt_at' => Carbon::now(),
            ]);
        }

        return $outcome;
    }

    public function discard(PostingDeadLetter $letter, ?int $actorId = null): PostingDeadLetter
    {
        $letter->update([
            'status' => 'discarded',
            'resolved_at' => Carbon::now(),
            'resolved_by' => $actorId,
        ]);

        return $letter->refresh();
    }
}
