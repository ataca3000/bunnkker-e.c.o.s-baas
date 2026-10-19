<?php

declare(strict_types=1);

namespace Modules\Commerce\StockSync\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Commerce\StockSync\Domain\Enums\StockSyncStatus;
use Modules\Commerce\StockSync\Domain\Models\StockSyncLog;
use Modules\Inventory\Products\Domain\Models\Product;

final class StockSyncLogSeeder extends Seeder
{
    public function run(): void
    {
        $laptop = Product::query()->where('sku', 'FG-LAPTOP-XPS')->first();
        $chair = Product::query()->where('sku', 'FG-CHAIR-001')->first();
        $mainStore = Channel::query()->where('name', 'ECOS Main Store')->first();
        $wholesale = Channel::query()->where('name', 'ECOS Wholesale')->first();

        if ($laptop === null || $mainStore === null) {
            return;
        }

        $laptopMapping = ProductMapping::query()
            ->where('product_id', $laptop->id)
            ->where('channel_id', $mainStore->id)
            ->first();

        $chairMapping = $chair !== null && $wholesale !== null
            ? ProductMapping::query()
                ->where('product_id', $chair->id)
                ->where('channel_id', $wholesale->id)
                ->first()
            : null;

        $logs = [];

        if ($laptopMapping !== null) {
            $logs[] = [
                'channel_id' => $mainStore->id,
                'product_id' => $laptop->id,
                'product_mapping_id' => $laptopMapping->id,
                'stock_quantity' => 50.0,
                'sync_status' => StockSyncStatus::Success->value,
                'response_message' => 'Stock updated successfully.',
                'synced_at' => now()->subHours(2),
            ];

            $logs[] = [
                'channel_id' => $mainStore->id,
                'product_id' => $laptop->id,
                'product_mapping_id' => $laptopMapping->id,
                'stock_quantity' => 48.0,
                'sync_status' => StockSyncStatus::Success->value,
                'response_message' => 'Stock updated successfully.',
                'synced_at' => now()->subDay(),
            ];
        }

        if ($chairMapping !== null) {
            $logs[] = [
                'channel_id' => $wholesale->id,
                'product_id' => $chair->id,
                'product_mapping_id' => $chairMapping->id,
                'stock_quantity' => 120.0,
                'sync_status' => StockSyncStatus::Error->value,
                'response_message' => 'Failed to update stock on WooCommerce.',
                'synced_at' => now()->subHours(5),
            ];
        }

        foreach ($logs as $log) {
            StockSyncLog::create($log);
        }
    }
}
