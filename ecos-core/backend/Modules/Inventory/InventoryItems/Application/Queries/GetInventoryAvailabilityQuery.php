<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Application\Queries;

use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;

/**
 * Returns current availability for a specific warehouse-product pair.
 * Returns null when no inventory record exists (available = 0).
 */
final class GetInventoryAvailabilityQuery
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $inventory,
    ) {}

    public function execute(string $warehouseId, string $productId): ?InventoryItem
    {
        return $this->inventory->findByWarehouseAndProduct($warehouseId, $productId);
    }
}
