<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Observers;

use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Commerce\Synchronization\Application\Jobs\PriceSyncJob;
use Modules\Commerce\Synchronization\Application\Jobs\ProductSyncJob;
use Modules\Inventory\Products\Domain\Models\Product;

final class ProductObserver
{
    private const PRODUCT_SYNC_FIELDS = ['name', 'sku', 'description', 'short_description'];

    private const PRICE_SYNC_FIELDS = ['regular_price', 'sale_price'];

    public function updated(Product $product): void
    {
        $productFieldChanged = $product->wasChanged(self::PRODUCT_SYNC_FIELDS);
        $priceFieldChanged = $product->wasChanged(self::PRICE_SYNC_FIELDS);

        // Skip sync entirely when no sync-relevant field changed (e.g. stock_status update).
        if (! $productFieldChanged && ! $priceFieldChanged) {
            return;
        }

        $mappings = ProductMapping::query()
            ->with('channel.credential')
            ->where('product_id', $product->id)
            ->get();

        foreach ($mappings as $mapping) {
            /** @var ProductMapping $mapping */
            $channel = $mapping->channel;

            if ($channel === null || ! $channel->is_active) {
                continue;
            }

            if ($channel->sync_products && $productFieldChanged) {
                ProductSyncJob::dispatch($channel, $product);
            }

            if ($channel->sync_prices && $priceFieldChanged) {
                PriceSyncJob::dispatch($channel, $product);
            }
        }
    }
}
