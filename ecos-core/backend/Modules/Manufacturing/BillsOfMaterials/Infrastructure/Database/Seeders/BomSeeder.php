<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Manufacturing\BillsOfMaterials\Domain\Models\BillOfMaterial;

final class BomSeeder extends Seeder
{
    public function run(): void
    {
        $finishedGood = Product::where('product_type', 'finished_good')->first();
        $rawMaterials = Product::where('product_type', 'raw_material')->limit(3)->get();

        if ($finishedGood === null || $rawMaterials->isEmpty()) {
            $this->command->warn('BomSeeder: No finished goods or raw materials found. Skipping.');

            return;
        }

        $bom = BillOfMaterial::create([
            'bom_number' => 'BOM-00001',
            'product_id' => $finishedGood->id,
            'version' => '1.0',
            'bom_version_number' => 1,
            'is_active' => true,
            'notes' => 'Initial bill of materials — seeded automatically.',
        ]);

        foreach ($rawMaterials as $index => $material) {
            $bom->lines()->create([
                'raw_material_id' => $material->id,
                'quantity' => round(($index + 1) * 1.5, 4),
            ]);
        }
    }
}
