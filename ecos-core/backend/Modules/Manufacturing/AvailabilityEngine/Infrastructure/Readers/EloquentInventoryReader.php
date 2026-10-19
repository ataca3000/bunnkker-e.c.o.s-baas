<?php

declare(strict_types=1);

namespace Modules\Manufacturing\AvailabilityEngine\Infrastructure\Readers;

use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Manufacturing\AvailabilityEngine\Domain\Contracts\InventoryReadInterface;

/**
 * Adapts InventoryItemRepositoryInterface to the thin InventoryReadInterface
 * required by the Availability Engine.
 *
 * Returns 0.0 when no inventory record exists — the engine treats a missing
 * record the same as zero stock.
 */
final class EloquentInventoryReader implements InventoryReadInterface
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $repository,
    ) {}

    public function availableQty(string $warehouseId, string $productId, string $companyId): float
    {
        $item = $this->repository->findByWarehouseProductAndCompany($warehouseId, $productId, $companyId);

        return $item !== null ? $item->availableQty() : 0.0;
    }
}
