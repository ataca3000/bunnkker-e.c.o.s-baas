<?php

declare(strict_types=1);

namespace Modules\Inventory\Products\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\MasterData\Categories\Domain\Models\Category;
use Modules\MasterData\Units\Domain\Models\Unit;

/**
 * Seeds sample finished goods and raw materials (PROD-001).
 */
final class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $category = Category::query()->where('code', 'ELEC')->first()
            ?? Category::query()->first();
        $unit = Unit::query()->where('code', 'PCS')->first()
            ?? Unit::query()->first();

        if ($category === null || $unit === null) {
            return;
        }

        $products = [
            ['sku' => 'FG-LAPTOP-XPS', 'name' => 'Laptop Dell XPS', 'type' => Product::TYPE_FINISHED_GOOD],
            ['sku' => 'FG-CHAIR-001', 'name' => 'Office Chair', 'type' => Product::TYPE_FINISHED_GOOD],
            ['sku' => 'RM-WOOD-001', 'name' => 'Wood Panel', 'type' => Product::TYPE_RAW_MATERIAL],
            ['sku' => 'RM-STEEL-001', 'name' => 'Steel Sheet', 'type' => Product::TYPE_RAW_MATERIAL],
        ];

        foreach ($products as $product) {
            Product::updateOrCreate(
                ['sku' => $product['sku']],
                [
                    'name' => $product['name'],
                    'category_id' => $category->id,
                    'unit_id' => $unit->id,
                    'product_type' => $product['type'],
                    'is_active' => true,
                ],
            );
        }
    }
}
