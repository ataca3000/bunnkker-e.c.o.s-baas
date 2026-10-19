<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\Contracts;

use DateTimeImmutable;
use Illuminate\Support\Collection;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\POS\Shared\Domain\Contracts\DomainEvent as PosDomainEvent;
use Modules\Platform\EventPlatform\Domain\Models\StoredEvent;

interface EnterpriseEventStoreInterface
{
    /** Persist the event and return the StoredEvent record. */
    public function persist(DomainEvent|PosDomainEvent $event): StoredEvent;

    public function findById(string $eventId): ?StoredEvent;

    /** @return Collection<int, StoredEvent> */
    public function queryByCompany(string $companyId, array $filters = []): Collection;

    /** @return Collection<int, StoredEvent> */
    public function queryByAggregate(string $aggregateType, string $aggregateId): Collection;

    /** @return Collection<int, StoredEvent> */
    public function queryByCorrelation(string $correlationId): Collection;

    /** @return Collection<int, StoredEvent> */
    public function queryByEventName(string $eventName, ?string $companyId = null): Collection;

    /** @return Collection<int, StoredEvent> */
    public function queryByTimeRange(DateTimeImmutable $from, DateTimeImmutable $to, array $filters = []): Collection;

    public function markPublished(string $eventId): void;

    public function markDeadLettered(string $eventId): void;

    public function markReplayed(string $eventId): void;
}
