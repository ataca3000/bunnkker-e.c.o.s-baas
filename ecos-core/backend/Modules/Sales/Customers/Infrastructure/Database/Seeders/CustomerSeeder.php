<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;
use Modules\Sales\Customers\Domain\Models\Customer;
use Modules\Sales\Customers\Domain\Models\CustomerBrand;

final class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::query()->where('is_active', true)->first();

        if ($company === null) {
            $this->command?->warn('CustomerSeeder: no active company found — skipping.');
            return;
        }

        $brand = Brand::query()
            ->where('company_id', $company->id)
            ->where('is_active', true)
            ->first();

        if ($brand === null) {
            $this->command?->warn('CustomerSeeder: no active brand for company — skipping.');
            return;
        }

        $customers = [
            ['code' => 'CUS-001', 'name' => 'Cairo Retail', 'city' => 'Cairo'],
            ['code' => 'CUS-002', 'name' => 'Nile Distribution', 'city' => 'Giza'],
            ['code' => 'CUS-003', 'name' => 'Alex Trading', 'city' => 'Alexandria'],
        ];

        foreach ($customers as $row) {
            $customerModel = Customer::updateOrCreate(
                ['code' => $row['code']],
                [
                    'company_id' => $company->id,
                    'name'       => $row['name'],
                    'country'    => 'Egypt',
                    'city'       => $row['city'],
                    'is_active'  => true,
                ],
            );

            CustomerBrand::updateOrCreate(
                [
                    'customer_id' => $customerModel->id,
                    'brand_id'    => $brand->id,
                ],
                [
                    'is_primary' => true,
                    'status'     => 'active',
                ],
            );
        }
    }
}
