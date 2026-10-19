<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Operations\Preparation\Domain\Enums\WarehouseAssignmentSource;

final class WarehouseAssigned
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $orderId,
        public readonly string $warehouseId,
        public readonly ?string $previousWarehouseId,
        public readonly WarehouseAssignmentSource $source,
        public readonly ?string $policyId,
        public readonly string $occurredAt,
    ) {}
}
