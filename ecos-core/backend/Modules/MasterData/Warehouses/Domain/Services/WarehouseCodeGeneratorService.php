<?php

declare(strict_types=1);

namespace Modules\MasterData\Warehouses\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;

final class WarehouseCodeGeneratorService
{
    public function next(string $companyId): string
    {
        return DB::transaction(function () use ($companyId): string {
            $count = Warehouse::withTrashed()
                ->where('company_id', $companyId)
                ->lockForUpdate()
                ->count();

            return sprintf('WH-%06d', $count + 1);
        });
    }
}
