<?php

declare(strict_types=1);

namespace Modules\Inventory\ReceiptLayers\Infrastructure\Repositories;

use Illuminate\Database\Eloquent\Collection;
use Modules\Inventory\ReceiptLayers\Domain\Contracts\InventoryLayerConsumptionRepositoryInterface;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryLayerConsumption;

final class EloquentInventoryLayerConsumptionRepository implements InventoryLayerConsumptionRepositoryInterface
{
    public function create(array $attributes): InventoryLayerConsumption
    {
        return InventoryLayerConsumption::query()->create($attributes);
    }

    public function getByOrder(string $orderId): Collection
    {
        return InventoryLayerConsumption::query()
            ->where('order_id', $orderId)
            ->orderBy('created_at')
            ->get();
    }

    public function getByProduct(string $productId): Collection
    {
        return InventoryLayerConsumption::query()
            ->where('product_id', $productId)
            ->orderBy('created_at')
            ->get();
    }

    public function getByLayer(string $layerId): Collection
    {
        return InventoryLayerConsumption::query()
            ->where('inventory_receipt_layer_id', $layerId)
            ->orderBy('created_at')
            ->get();
    }
}
