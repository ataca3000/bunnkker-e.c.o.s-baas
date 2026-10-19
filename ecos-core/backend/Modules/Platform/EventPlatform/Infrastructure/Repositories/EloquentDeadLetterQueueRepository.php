<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Infrastructure\Repositories;

use DateTimeInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseDeadLetterQueueInterface;
use Modules\Platform\EventPlatform\Domain\Models\DeadLetterEntry;
use Throwable;

/**
 * Concrete DLQ repository — delegates to DeadLetterEntry model.
 * Registered as the EnterpriseDeadLetterQueueInterface implementation.
 */
final class EloquentDeadLetterQueueRepository implements EnterpriseDeadLetterQueueInterface
{
    public function enqueue(
        DomainEvent $event,
        string $subscriberClass,
        Throwable $failure,
        int $retryCount,
        string $storedEventId,
    ): DeadLetterEntry {
        $data = $event->toArray();
        $companyId = $data['company_id'] ?? null;

        return DeadLetterEntry::create([
            'id' => Str::uuid()->toString(),
            'stored_event_id' => $storedEventId,
            'event_id' => $event->eventId(),
            'event_name' => $event->eventName(),
            'subscriber_class' => $subscriberClass,
            'failure_reason' => $failure->getMessage(),
            'stack_trace' => $failure->getTraceAsString(),
            'event_payload' => $data['payload'] ?? $data,
            'event_metadata' => $data['metadata'] ?? [],
            'occurred_at' => $event->occurredAt()->format(DateTimeInterface::ISO8601),
            'retry_count' => $retryCount,
            'dlq_status' => 'pending',
            'company_id' => $companyId,
        ]);
    }

    public function findById(string $id): ?DeadLetterEntry
    {
        return DeadLetterEntry::find($id);
    }

    public function pendingEntries(?string $companyId = null): Collection
    {
        $query = DeadLetterEntry::where('dlq_status', 'pending');
        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }

        return $query->orderBy('created_at')->get();
    }

    public function allEntries(array $filters = []): Collection
    {
        $query = DeadLetterEntry::query();

        if (! empty($filters['company_id'])) {
            $query->where('company_id', $filters['company_id']);
        }
        if (! empty($filters['event_name'])) {
            $query->where('event_name', $filters['event_name']);
        }
        if (! empty($filters['dlq_status'])) {
            $query->where('dlq_status', $filters['dlq_status']);
        }
        if (! empty($filters['from'])) {
            $query->where('created_at', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->where('created_at', '<=', $filters['to']);
        }

        return $query->orderByDesc('created_at')->get();
    }

    public function markReplaying(string $dlqEntryId): void
    {
        DeadLetterEntry::where('id', $dlqEntryId)->update(['dlq_status' => 'replaying']);
    }

    public function markReplayed(string $dlqEntryId): void
    {
        DeadLetterEntry::where('id', $dlqEntryId)->update([
            'dlq_status' => 'replayed',
            'replayed_at' => now()->toIso8601String(),
        ]);
    }

    public function markDiscarded(string $dlqEntryId): void
    {
        DeadLetterEntry::where('id', $dlqEntryId)->update(['dlq_status' => 'discarded']);
    }

    public function count(?string $companyId = null): int
    {
        $query = DeadLetterEntry::where('dlq_status', 'pending');
        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }

        return $query->count();
    }
}
