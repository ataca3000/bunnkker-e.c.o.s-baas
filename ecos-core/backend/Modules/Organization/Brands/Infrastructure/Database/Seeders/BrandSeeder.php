<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\Companies\Domain\Models\Company;

final class BrandSeeder extends Seeder
{
    public function run(): void
    {
        Company::query()->each(function (Company $company): void {
            if (Brand::query()->where('company_id', $company->id)->exists()) {
                return;
            }

            Brand::query()->create([
                'company_id' => $company->id,
                'code' => 'BRD-000001',
                'name' => $company->name,
                'slug' => Str::slug($company->name),
                'is_active' => true,
            ]);
        });
    }
}
