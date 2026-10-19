<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Events\Inbound;

/**
 * Integration contract event: fired by Loading OS when units are physically loaded onto a vehicle.
 * Preparation OS increments quantity_loaded and creates a PoolMovement record.
 *
 * Source: Loading OS (INTEGRATION-DESIGN.md §7.3)
 */
final class LoadingProductLoadedEvent
{
    public function __construct(
        public readonly string $poolEntryId,
        public readonly string $productId,
        public readonly string $warehouseId,
        public readonly float $quantityLoaded,
        public readonly string $vehicleId,
    ) {}
}
