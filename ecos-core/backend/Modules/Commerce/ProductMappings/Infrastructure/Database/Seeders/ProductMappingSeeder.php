<?php

declare(strict_types=1);

namespace Modules\Commerce\ProductMappings\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\ProductMappings\Domain\Enums\SyncStatus;
use Modules\Commerce\ProductMappings\Domain\Models\ProductMapping;
use Modules\Inventory\Products\Domain\Models\Product;

final class ProductMappingSeeder extends Seeder
{
    public function run(): void
    {
        $laptop = Product::query()->where('sku', 'FG-LAPTOP-XPS')->first();
        $chair = Product::query()->where('sku', 'FG-CHAIR-001')->first();
        $mainStore = Channel::query()->where('name', 'ECOS Main Store')->first();
        $wholesale = Channel::query()->where('name', 'ECOS Wholesale')->first();

        if ($laptop === null || $chair === null || $mainStore === null || $wholesale === null) {
            return;
        }

        $mappings = [
            [
                'product_id' => $laptop->id,
                'channel_id' => $mainStore->id,
                'external_product_id' => '543',
                'external_sku' => 'DELL-XPS-WOO',
                'sync_status' => SyncStatus::Pending->value,
            ],
            [
                'product_id' => $chair->id,
                'channel_id' => $wholesale->id,
                'external_product_id' => '889',
                'external_sku' => 'CHAIR-WHL-001',
                'sync_status' => SyncStatus::Pending->value,
            ],
        ];

        foreach ($mappings as $data) {
            ProductMapping::updateOrCreate(
                [
                    'product_id' => $data['product_id'],
                    'channel_id' => $data['channel_id'],
                ],
                [
                    'external_product_id' => $data['external_product_id'],
                    'external_sku' => $data['external_sku'],
                    'sync_status' => $data['sync_status'],
                ],
            );
        }
    }
}
