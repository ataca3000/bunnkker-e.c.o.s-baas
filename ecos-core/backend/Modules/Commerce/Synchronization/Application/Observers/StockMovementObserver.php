<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Observers;

use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Commerce\Synchronization\Application\Jobs\InventorySyncJob;
use Modules\Inventory\StockLedger\Domain\Models\StockMovement;
use Modules\Purchasing\GoodsReceipts\Domain\Models\StockBalance;

final class StockMovementObserver
{
    public function created(StockMovement $movement): void
    {
        $mappings = ProductMapping::query()
            ->with('channel.credential')
            ->where('product_id', $movement->product_id)
            ->get();

        if ($mappings->isEmpty()) {
            return;
        }

        $product = $movement->product;

        if ($product === null) {
            return;
        }

        // Use total stock across ALL warehouses so WooCommerce sees the correct aggregate.
        // BUG-FIX: balance_after is single-warehouse only; multi-warehouse setups would
        // otherwise push an incorrect (too low) quantity to WooCommerce.
        $totalStock = (float) StockBalance::query()
            ->where('product_id', $movement->product_id)
            ->sum('quantity');

        foreach ($mappings as $mapping) {
            /** @var ProductMapping $mapping */
            $channel = $mapping->channel;

            if ($channel === null || ! $channel->is_active || ! $channel->sync_stock) {
                continue;
            }

            InventorySyncJob::dispatch($channel, $product, $totalStock);
        }
    }
}
