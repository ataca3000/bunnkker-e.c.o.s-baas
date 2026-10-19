<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Seeds sample warehouses for the ECOS Holding company (MD-001).
 */
final class WarehouseSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::query()->where('code', 'ECOS')->first();

        if ($company === null) {
            return;
        }

        Warehouse::updateOrCreate(
            ['company_id' => $company->id, 'code' => 'WH-MAIN'],
            [
                'name' => 'Main Warehouse',
                'city' => 'Cairo',
                'country' => 'Egypt',
                'is_active' => true,
            ],
        );
    }
}
