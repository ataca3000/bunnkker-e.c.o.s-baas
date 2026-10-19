<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Application\Services;

use DateTimeImmutable;
use Illuminate\Support\Collection;
use InvalidArgumentException;
use Modules\Platform\EventPlatform\Domain\Abstracts\EnterpriseEvent;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseDeadLetterQueueInterface;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventStoreInterface;
use Modules\Platform\EventPlatform\Domain\Models\StoredEvent;
use RuntimeException;
use Throwable;

final class EnterpriseEventReplayService
{
    public function __construct(
        private readonly EnterpriseEventStoreInterface $store,
        private readonly EnterpriseEventDispatcher $dispatcher,
        private readonly EnterpriseDeadLetterQueueInterface $dlq,
        private readonly EnterpriseEventSerializer $serializer,
    ) {}

    /** Replay a single event by stored_event ID. */
    public function replaySingle(string $storedEventId): void
    {
        $storedEvent = $this->store->findById($storedEventId);

        if (! $storedEvent) {
            throw new InvalidArgumentException("StoredEvent not found: {$storedEventId}");
        }

        $this->replayStoredEvent($storedEvent);
    }

    /** Replay all events for a given aggregate. */
    public function replayByAggregate(string $aggregateType, string $aggregateId): int
    {
        $events = $this->store->queryByAggregate($aggregateType, $aggregateId);

        return $this->replayCollection($events);
    }

    /** Replay all events within a time window, with optional filters. */
    public function replayByTimeRange(
        DateTimeImmutable $from,
        DateTimeImmutable $to,
        array $filters = [],
    ): int {
        $events = $this->store->queryByTimeRange($from, $to, $filters);

        return $this->replayCollection($events);
    }

    /** Replay all events by module. */
    public function replayByModule(string $module, ?string $companyId = null): int
    {
        $events = $this->store->queryByCompany($companyId ?? '', ['module' => $module]);

        return $this->replayCollection($events);
    }

    /** Replay a dead letter entry. */
    public function replayDlqEntry(string $dlqEntryId): void
    {
        $dlqEntry = $this->dlq->findById($dlqEntryId);

        if (! $dlqEntry) {
            throw new InvalidArgumentException("DLQ entry not found: {$dlqEntryId}");
        }

        $storedEvent = $this->store->findById($dlqEntry->stored_event_id);
        if (! $storedEvent) {
            throw new InvalidArgumentException("StoredEvent not found for DLQ entry: {$dlqEntryId}");
        }

        $this->dlq->markReplaying($dlqEntryId);

        try {
            $this->replayStoredEvent($storedEvent);
            $this->dlq->markReplayed($dlqEntryId);
        } catch (Throwable $e) {
            throw $e;
        }
    }

    private function replayStoredEvent(StoredEvent $storedEvent): void
    {
        $eventClass = $storedEvent->event_class;

        // Only EnterpriseEvent subclasses support fromArray reconstruction
        if ($eventClass && is_subclass_of($eventClass, EnterpriseEvent::class)) {
            $raw = $this->serializer->deserialize($storedEvent->toArray());
            $event = $eventClass::fromArray($raw);
            $replayEvent = $event->asReplay();

            $this->store->markReplayed($storedEvent->event_id);
            $this->dispatcher->dispatch($replayEvent, $storedEvent);
        } else {
            // Legacy events cannot be fully reconstructed — re-dispatch the stored envelope
            // Implementations may override this hook to handle legacy replay differently.
            throw new RuntimeException(
                "Cannot replay legacy event '{$storedEvent->event_name}': class '{$eventClass}' does not extend EnterpriseEvent.",
            );
        }
    }

    private function replayCollection(Collection $events): int
    {
        $count = 0;
        foreach ($events as $storedEvent) {
            try {
                $this->replayStoredEvent($storedEvent);
                $count++;
            } catch (Throwable) {
                // Non-fatal — skip unrestorable events, log and continue
                \Illuminate\Support\Facades\Log::warning(
                    "EnterpriseEventReplayService: skipped event {$storedEvent->event_id}",
                    ['event_name' => $storedEvent->event_name],
                );
            }
        }

        return $count;
    }
}
