<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Events;

final class VehiclePlanned
{
    public string $eventType = 'loading.vehicle.planned';

    public string $version = '1.0';

    public function __construct(
        public readonly string $companyId,
        public readonly string $planId,
        public readonly string $planNumber,
        public readonly string $operationalDate,
        public readonly int $slotsCount,
        public readonly int $ordersCount,
        public readonly string $actorId,
        public readonly string $occurredAt,
    ) {}
}
