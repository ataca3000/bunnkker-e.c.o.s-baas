<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Events;

final class DriverAssigned
{
    public string $eventType = 'loading.driver.assigned';

    public string $version = '1.0';

    public function __construct(
        public readonly string $companyId,
        public readonly string $driverAssignmentId,
        public readonly string $vehicleAssignmentId,
        public readonly string $vehicleId,
        public readonly string $driverId,
        public readonly string $driverName,
        public readonly string $actorId,
        public readonly string $occurredAt,
    ) {}
}
