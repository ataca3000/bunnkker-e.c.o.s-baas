<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Events;

final class VehiclePlanRecalculated
{
    public string $eventType = 'loading.vehicle_plan.recalculated';

    public string $version = '1.0';

    public function __construct(
        public readonly string $companyId,
        public readonly string $oldPlanId,
        public readonly string $newPlanId,
        public readonly int $newVersion,
        public readonly string $replanTrigger,
        public readonly string $actorId,
        public readonly string $occurredAt,
    ) {}
}
