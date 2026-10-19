<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class OrderCompletedEvent
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $orderId,
        public readonly string $orderNumber,
        public readonly string $companyId,
        public readonly float $revenue,
        public readonly float $cogsAmount,
        public readonly float $marginAmount,
        public readonly ?float $marginPercent,
        public readonly string $completedAt,
        public readonly ?string $actorId,
    ) {}
}
