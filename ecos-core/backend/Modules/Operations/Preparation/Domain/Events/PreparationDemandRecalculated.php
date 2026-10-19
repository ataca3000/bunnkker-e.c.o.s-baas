<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class PreparationDemandRecalculated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $sessionId,
        public readonly string $warehouseId,
        public readonly int $ordersCount,
        public readonly int $productsCount,
        public readonly string $occurredAt,
    ) {}
}
