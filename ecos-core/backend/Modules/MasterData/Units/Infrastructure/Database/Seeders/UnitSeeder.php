<?php

declare(strict_types=1);

namespace Modules\MasterData\Units\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\MasterData\Units\Domain\Models\Unit;

/**
 * Seeds the common units of measure (MD-001).
 */
final class UnitSeeder extends Seeder
{
    public function run(): void
    {
        $units = [
            ['code' => 'PCS', 'name' => 'Pieces', 'symbol' => 'pcs'],
            ['code' => 'KG', 'name' => 'Kilogram', 'symbol' => 'kg'],
            ['code' => 'BOX', 'name' => 'Box', 'symbol' => 'box'],
            ['code' => 'LTR', 'name' => 'Litre', 'symbol' => 'L'],
            ['code' => 'MTR', 'name' => 'Metre', 'symbol' => 'm'],
        ];

        foreach ($units as $unit) {
            Unit::updateOrCreate(
                ['code' => $unit['code']],
                [
                    'name' => $unit['name'],
                    'symbol' => $unit['symbol'],
                    'is_active' => true,
                ],
            );
        }
    }
}
