<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Events\Inbound;

/**
 * Integration contract event: fired by Loading OS when it reserves units from the Prepared Products Pool.
 * Preparation OS increments quantity_reserved and creates a PoolMovement record.
 *
 * Source: Loading OS (INTEGRATION-DESIGN.md §7.3)
 */
final class LoadingPoolReservedEvent
{
    public function __construct(
        public readonly string $poolEntryId,
        public readonly string $productId,
        public readonly string $warehouseId,
        public readonly float $quantityReserved,
        public readonly string $loadingWaveId,
    ) {}
}
