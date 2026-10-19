<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Admin\Configuration\Domain\Models\MasterGovernorate;
use Modules\Admin\Configuration\Domain\Models\MasterZone;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Branches\Domain\Models\Branch;
use Modules\Organization\Branches\Domain\Models\BranchCoverageArea;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Seeds sample branches for the ECOS Holding company (ORG-002).
 * Also seeds branch coverage areas and assigns default warehouses.
 */
final class BranchSeeder extends Seeder
{
    public function run(): void
    {
        $company = Company::query()->where('code', 'ECOS')->first();

        if ($company === null) {
            return;
        }

        $cairoWarehouse    = Warehouse::query()->where('company_id', $company->id)->first();
        $alexandriaWarehouse = Warehouse::query()
            ->where('company_id', $company->id)
            ->skip(1)
            ->first() ?? $cairoWarehouse;

        $cairoGov = MasterGovernorate::query()
            ->where('name', 'Cairo')
            ->orWhere('name_ar', 'القاهرة')
            ->first();

        $gizaGov = MasterGovernorate::query()
            ->where('name', 'Giza')
            ->orWhere('name_ar', 'الجيزة')
            ->first();

        $alexandriaGov = MasterGovernorate::query()
            ->where('name', 'Alexandria')
            ->orWhere('name_ar', 'الإسكندرية')
            ->first();

        $nasrCityZone = $cairoGov
            ? MasterZone::query()
                ->where('master_governorate_id', $cairoGov->id)
                ->where(function ($q): void {
                    $q->where('name', 'like', '%Nasr%')->orWhere('name', 'like', '%نصر%');
                })
                ->first()
            : null;

        $heliopolisZone = $cairoGov
            ? MasterZone::query()
                ->where('master_governorate_id', $cairoGov->id)
                ->where(function ($q): void {
                    $q->where('name', 'like', '%Heliopolis%')->orWhere('name', 'like', '%مصر الجديدة%');
                })
                ->first()
            : null;

        $cairoBranch = Branch::updateOrCreate(
            ['company_id' => $company->id, 'code' => 'CAI-HQ'],
            [
                'name'                 => 'Cairo HQ',
                'manager_name'         => 'Omar Hassan',
                'city'                 => 'Cairo',
                'country'              => 'Egypt',
                'is_head_office'       => true,
                'is_active'            => true,
                'latitude'             => 30.0444,
                'longitude'            => 31.2357,
                'default_warehouse_id' => $cairoWarehouse?->id,
            ],
        );

        $alexandriaBranch = Branch::updateOrCreate(
            ['company_id' => $company->id, 'code' => 'ALX'],
            [
                'name'                 => 'Alexandria',
                'manager_name'         => 'Mona Adel',
                'city'                 => 'Alexandria',
                'country'              => 'Egypt',
                'is_head_office'       => false,
                'is_active'            => true,
                'latitude'             => 31.2001,
                'longitude'            => 29.9187,
                'default_warehouse_id' => $alexandriaWarehouse?->id,
            ],
        );

        // Cairo HQ — whole Cairo governorate at priority 10
        if ($cairoGov !== null) {
            BranchCoverageArea::updateOrCreate(
                [
                    'branch_id'             => $cairoBranch->id,
                    'master_governorate_id' => $cairoGov->id,
                    'master_zone_id'        => null,
                ],
                ['priority' => 10, 'is_active' => true],
            );
        }

        // Cairo HQ — Nasr City zone at higher priority (more specific)
        if ($cairoGov !== null && $nasrCityZone !== null) {
            BranchCoverageArea::updateOrCreate(
                [
                    'branch_id'             => $cairoBranch->id,
                    'master_governorate_id' => $cairoGov->id,
                    'master_zone_id'        => $nasrCityZone->id,
                ],
                ['priority' => 5, 'is_active' => true],
            );
        }

        // Cairo HQ — Heliopolis zone
        if ($cairoGov !== null && $heliopolisZone !== null) {
            BranchCoverageArea::updateOrCreate(
                [
                    'branch_id'             => $cairoBranch->id,
                    'master_governorate_id' => $cairoGov->id,
                    'master_zone_id'        => $heliopolisZone->id,
                ],
                ['priority' => 5, 'is_active' => true],
            );
        }

        // Cairo HQ — Giza (whole governorate)
        if ($gizaGov !== null) {
            BranchCoverageArea::updateOrCreate(
                [
                    'branch_id'             => $cairoBranch->id,
                    'master_governorate_id' => $gizaGov->id,
                    'master_zone_id'        => null,
                ],
                ['priority' => 20, 'is_active' => true],
            );
        }

        // Alexandria branch — whole Alexandria governorate
        if ($alexandriaGov !== null) {
            BranchCoverageArea::updateOrCreate(
                [
                    'branch_id'             => $alexandriaBranch->id,
                    'master_governorate_id' => $alexandriaGov->id,
                    'master_zone_id'        => null,
                ],
                ['priority' => 10, 'is_active' => true],
            );
        }
    }
}
