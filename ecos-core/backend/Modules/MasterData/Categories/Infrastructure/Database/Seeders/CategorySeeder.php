<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\MasterData\Categories\Domain\Models\Category;

/**
 * Seeds a sample 3-level category hierarchy (MD-001).
 */
final class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $electronics = Category::updateOrCreate(
            ['code' => 'ELEC'],
            ['parent_id' => null, 'name' => 'Electronics', 'level' => 1, 'sort_order' => 1, 'is_active' => true, 'category_scope' => 'product'],
        );

        $phones = Category::updateOrCreate(
            ['code' => 'PHONES'],
            ['parent_id' => $electronics->id, 'name' => 'Phones', 'level' => 2, 'sort_order' => 1, 'is_active' => true, 'category_scope' => 'product'],
        );

        Category::updateOrCreate(
            ['code' => 'SMART'],
            ['parent_id' => $phones->id, 'name' => 'Smartphones', 'level' => 3, 'sort_order' => 1, 'is_active' => true, 'category_scope' => 'product'],
        );

        Category::updateOrCreate(
            ['code' => 'GROC'],
            ['parent_id' => null, 'name' => 'Groceries', 'level' => 1, 'sort_order' => 2, 'is_active' => true, 'category_scope' => 'product'],
        );

        // Sample material categories
        Category::updateOrCreate(
            ['code' => 'RAW-MAT'],
            ['parent_id' => null, 'name' => 'Raw Materials', 'level' => 1, 'sort_order' => 10, 'is_active' => true, 'category_scope' => 'material'],
        );

        Category::updateOrCreate(
            ['code' => 'PACK-MAT'],
            ['parent_id' => null, 'name' => 'Packaging Materials', 'level' => 1, 'sort_order' => 11, 'is_active' => true, 'category_scope' => 'material'],
        );
    }
}
