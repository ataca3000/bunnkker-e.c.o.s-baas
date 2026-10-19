<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Events;

final class VehicleReleased
{
    public string $eventType = 'loading.vehicle.released';

    public string $version = '1.0';

    public function __construct(
        public readonly string $companyId,
        public readonly string $assignmentId,
        public readonly string $sessionId,
        public readonly string $vehicleId,
        public readonly string $driverId,
        public readonly string $actorId,
        public readonly string $occurredAt,
    ) {}
}
