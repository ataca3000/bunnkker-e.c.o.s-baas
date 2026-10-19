<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Generates globally sequential company codes in the format COM-000001.
 * Uses a pessimistic lock inside a transaction to prevent duplicates.
 */
final class CompanyCodeGeneratorService
{
    public function next(): string
    {
        return DB::transaction(function (): string {
            $count = Company::withTrashed()->lockForUpdate()->count();

            return sprintf('COM-%06d', $count + 1);
        });
    }
}
