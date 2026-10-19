<?php

declare(strict_types=1);

namespace Modules\Inventory\ReceiptLayers\Domain\Contracts;

use Illuminate\Database\Eloquent\Collection;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryLayerConsumption;

interface InventoryLayerConsumptionRepositoryInterface
{
    /** @param array<string, mixed> $attributes */
    public function create(array $attributes): InventoryLayerConsumption;

    /** @return Collection<int, InventoryLayerConsumption> */
    public function getByOrder(string $orderId): Collection;

    /** @return Collection<int, InventoryLayerConsumption> */
    public function getByProduct(string $productId): Collection;

    /** @return Collection<int, InventoryLayerConsumption> */
    public function getByLayer(string $layerId): Collection;
}
