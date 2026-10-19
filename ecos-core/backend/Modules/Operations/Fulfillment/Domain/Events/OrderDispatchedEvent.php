<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class OrderDispatchedEvent
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $orderId,
        public readonly string $orderNumber,
        public readonly string $companyId,
        public readonly string $vehicleAssignmentId,
        public readonly string $vehicleId,
        public readonly ?string $driverId,
        public readonly float $cogsAmount,
        public readonly string $dispatchedAt,
        public readonly ?string $actorId,
    ) {}
}
