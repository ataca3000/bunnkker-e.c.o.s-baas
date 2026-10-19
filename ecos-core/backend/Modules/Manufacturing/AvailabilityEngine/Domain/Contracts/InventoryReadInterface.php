<?php

declare(strict_types=1);

namespace Modules\Manufacturing\AvailabilityEngine\Domain\Contracts;

/**
 * Read-only inventory access for the Availability Engine.
 *
 * Returns only what the engine needs: available quantity at a location.
 * Zero side effects. Zero writes.
 *
 * Current implementation: EloquentInventoryReader (delegates to InventoryItemRepositoryInterface).
 * Future: cached reader, CQRS projection, read replica.
 */
interface InventoryReadInterface
{
    /**
     * Returns available quantity (on_hand − reserved) for the given product at the
     * given warehouse, scoped to the company. Returns 0.0 if no inventory record exists.
     *
     * F-INV-H2: companyId is mandatory — cross-company reads are architecturally impossible.
     */
    public function availableQty(string $warehouseId, string $productId, string $companyId): float;
}
