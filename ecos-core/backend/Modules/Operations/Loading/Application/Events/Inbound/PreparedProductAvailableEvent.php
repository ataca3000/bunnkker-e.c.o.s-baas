<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Application\Events\Inbound;

final class PreparedProductAvailableEvent
{
    public function __construct(
        public readonly string $companyId,
        public readonly string $poolEntryId,
        public readonly string $productId,
        public readonly string $warehouseId,
        public readonly float $quantityAvailable,
        public readonly string $occurredAt,
    ) {}
}
