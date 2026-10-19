<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Infrastructure\Repositories;

use DateTimeImmutable;
use DateTimeInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\Contracts\DomainEvent as PosDomainEvent;
use Modules\Platform\EventPlatform\Application\Services\EnterpriseEventSerializer;
use Modules\Platform\EventPlatform\Domain\Contracts\EnterpriseEventStoreInterface;
use Modules\Platform\EventPlatform\Domain\Enums\EventStatus;
use Modules\Platform\EventPlatform\Domain\Models\StoredEvent;

final class EloquentEventStore implements EnterpriseEventStoreInterface
{
    public function __construct(
        private readonly EnterpriseEventSerializer $serializer,
    ) {}

    public function persist(DomainEvent|PosDomainEvent $event): StoredEvent
    {
        $data = $this->serializer->serialize($event);

        return StoredEvent::create([
            'id' => Str::uuid()->toString(),
            'event_id' => $data['event_id'],
            'event_name' => $data['event_name'],
            'version' => $data['version'],
            'occurred_at' => $data['occurred_at'],
            'correlation_id' => $data['correlation_id'],
            'causation_id' => $data['causation_id'] ?? null,
            'company_id' => $data['company_id'] ?? null,
            'warehouse_id' => $data['warehouse_id'] ?? null,
            'module' => $data['module'] ?? null,
            'aggregate_type' => $data['aggregate_type'] ?? null,
            'aggregate_id' => $data['aggregate_id'] ?? null,
            'payload' => $data['payload'] ?? [],
            'metadata' => $data['metadata'] ?? [],
            'retry_count' => $data['retry_count'] ?? 0,
            'is_replay' => $data['is_replay'] ?? false,
            'trace_id' => $data['trace_id'] ?? null,
            'status' => EventStatus::Pending->value,
            'event_class' => $event::class,
        ]);
    }

    public function findById(string $eventId): ?StoredEvent
    {
        return StoredEvent::where('event_id', $eventId)->first();
    }

    public function queryByCompany(string $companyId, array $filters = []): Collection
    {
        $query = StoredEvent::where('company_id', $companyId);

        if (! empty($filters['module'])) {
            $query->where('module', $filters['module']);
        }
        if (! empty($filters['event_name'])) {
            $query->where('event_name', $filters['event_name']);
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['from'])) {
            $query->where('occurred_at', '>=', $filters['from']);
        }
        if (! empty($filters['to'])) {
            $query->where('occurred_at', '<=', $filters['to']);
        }

        return $query->orderBy('occurred_at')->get();
    }

    public function queryByAggregate(string $aggregateType, string $aggregateId): Collection
    {
        return StoredEvent::where('aggregate_type', $aggregateType)
            ->where('aggregate_id', $aggregateId)
            ->orderBy('occurred_at')
            ->get();
    }

    public function queryByCorrelation(string $correlationId): Collection
    {
        return StoredEvent::where('correlation_id', $correlationId)
            ->orderBy('occurred_at')
            ->get();
    }

    public function queryByEventName(string $eventName, ?string $companyId = null): Collection
    {
        $query = StoredEvent::where('event_name', $eventName);
        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }

        return $query->orderBy('occurred_at')->get();
    }

    public function queryByTimeRange(DateTimeImmutable $from, DateTimeImmutable $to, array $filters = []): Collection
    {
        $query = StoredEvent::whereBetween('occurred_at', [
            $from->format(DateTimeInterface::ISO8601),
            $to->format(DateTimeInterface::ISO8601),
        ]);

        if (! empty($filters['company_id'])) {
            $query->where('company_id', $filters['company_id']);
        }
        if (! empty($filters['module'])) {
            $query->where('module', $filters['module']);
        }
        if (! empty($filters['event_name'])) {
            $query->where('event_name', $filters['event_name']);
        }

        return $query->orderBy('occurred_at')->get();
    }

    public function markPublished(string $eventId): void
    {
        StoredEvent::where('event_id', $eventId)
            ->update(['status' => EventStatus::Published->value]);
    }

    public function markDeadLettered(string $eventId): void
    {
        StoredEvent::where('event_id', $eventId)
            ->update(['status' => EventStatus::DeadLettered->value]);
    }

    public function markReplayed(string $eventId): void
    {
        StoredEvent::where('event_id', $eventId)
            ->update(['status' => EventStatus::Replayed->value]);
    }
}
