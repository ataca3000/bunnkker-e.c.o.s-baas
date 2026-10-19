<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Events;

final class AllocationCompleted
{
    public string $eventType = 'loading.allocation.completed';

    public string $version = '1.0';

    public function __construct(
        public readonly string $companyId,
        public readonly string $sessionId,
        public readonly int $vehicleCount,
        public readonly int $ordersAllocated,
        public readonly int $partialAllocations,
        public readonly string $actorId,
        public readonly string $occurredAt,
    ) {}
}
