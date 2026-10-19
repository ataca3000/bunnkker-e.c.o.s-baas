<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;

final class BusinessAccountSeeder extends Seeder
{
    public function run(): void
    {
        Brand::query()->each(function (Brand $brand): void {
            if (BusinessAccount::query()->where('brand_id', $brand->id)->exists()) {
                return;
            }

            $seq = BusinessAccount::query()
                ->withTrashed()
                ->where('company_id', $brand->company_id)
                ->count() + 1;

            BusinessAccount::query()->create([
                'company_id' => $brand->company_id,
                'brand_id' => $brand->id,
                'code' => 'BA-'.str_pad((string) $seq, 6, '0', STR_PAD_LEFT),
                'name' => $brand->name.' — WooCommerce',
                'provider' => 'WooCommerce',
                'status' => 'active',
            ]);
        });
    }
}
