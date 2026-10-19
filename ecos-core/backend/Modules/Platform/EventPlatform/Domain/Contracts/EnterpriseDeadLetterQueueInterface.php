<?php

declare(strict_types=1);

namespace Modules\Platform\EventPlatform\Domain\Contracts;

use Illuminate\Support\Collection;
use Modules\Inventory\DomainEvents\Contracts\DomainEvent;
use Modules\Platform\EventPlatform\Domain\Models\DeadLetterEntry;
use Throwable;

interface EnterpriseDeadLetterQueueInterface
{
    public function enqueue(
        DomainEvent $event,
        string $subscriberClass,
        Throwable $failure,
        int $retryCount,
        string $storedEventId,
    ): DeadLetterEntry;

    public function findById(string $id): ?DeadLetterEntry;

    /** @return Collection<int, DeadLetterEntry> */
    public function pendingEntries(?string $companyId = null): Collection;

    /** @return Collection<int, DeadLetterEntry> */
    public function allEntries(array $filters = []): Collection;

    public function markReplaying(string $dlqEntryId): void;

    public function markReplayed(string $dlqEntryId): void;

    public function markDiscarded(string $dlqEntryId): void;

    public function count(?string $companyId = null): int;
}
