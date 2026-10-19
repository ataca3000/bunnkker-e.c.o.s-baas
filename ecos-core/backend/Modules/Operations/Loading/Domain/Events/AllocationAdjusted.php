<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Events;

final class AllocationAdjusted
{
    public string $eventType = 'loading.allocation.adjusted';

    public string $version = '1.0';

    public function __construct(
        public readonly string $companyId,
        public readonly string $allocationRecordId,
        public readonly string $vehicleId,
        public readonly string $orderId,
        public readonly float $quantityBefore,
        public readonly float $quantityAfter,
        public readonly string $actorType,
        public readonly string $actorId,
        public readonly string $reason,
        public readonly string $occurredAt,
    ) {}
}
