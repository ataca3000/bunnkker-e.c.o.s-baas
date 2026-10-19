<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Events;

final class VehicleLoaded
{
    public string $eventType = 'loading.vehicle.loaded';

    public string $version = '1.0';

    public function __construct(
        public readonly string $companyId,
        public readonly string $assignmentId,
        public readonly string $sessionId,
        public readonly string $vehicleId,
        public readonly float $totalUnitsLoaded,
        public readonly int $loadedProductsCount,
        public readonly string $actorId,
        public readonly string $occurredAt,
    ) {}
}
