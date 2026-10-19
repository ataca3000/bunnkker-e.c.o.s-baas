<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Events\Inbound;

/**
 * Integration contract event: fired by Loading OS when it releases a pool reservation.
 * Preparation OS decrements quantity_reserved and creates a PoolMovement record.
 *
 * Source: Loading OS (INTEGRATION-DESIGN.md §7.3)
 */
final class LoadingPoolReservationReleasedEvent
{
    public function __construct(
        public readonly string $poolEntryId,
        public readonly string $productId,
        public readonly string $warehouseId,
        public readonly float $quantityReleased,
        public readonly string $loadingWaveId,
    ) {}
}
