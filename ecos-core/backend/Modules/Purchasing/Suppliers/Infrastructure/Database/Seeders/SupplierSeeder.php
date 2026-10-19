<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Purchasing\Suppliers\Domain\Models\Supplier;

/**
 * Seeds sample suppliers (PUR-001).
 */
final class SupplierSeeder extends Seeder
{
    public function run(): void
    {
        $suppliers = [
            ['code' => 'SUP-001', 'name' => 'Delta Trading', 'city' => 'Cairo'],
            ['code' => 'SUP-002', 'name' => 'Global Imports', 'city' => 'Alexandria'],
            ['code' => 'SUP-003', 'name' => 'Cairo Industrial Supply', 'city' => 'Cairo'],
        ];

        foreach ($suppliers as $supplier) {
            Supplier::updateOrCreate(
                ['code' => $supplier['code']],
                [
                    'name' => $supplier['name'],
                    'country' => 'Egypt',
                    'city' => $supplier['city'],
                    'is_active' => true,
                ],
            );
        }
    }
}
