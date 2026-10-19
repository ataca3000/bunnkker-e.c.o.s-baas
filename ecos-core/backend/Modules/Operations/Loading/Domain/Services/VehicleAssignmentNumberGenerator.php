<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Services;

use Illuminate\Support\Facades\DB;

final class VehicleAssignmentNumberGenerator
{
    public function next(string $companyId): string
    {
        $prefix = 'VASN-'.now()->format('Ym').'-';
        $prefixLen = strlen($prefix);

        $max = DB::table('vehicle_assignments')
            ->where('company_id', $companyId)
            ->where('assignment_number', 'like', $prefix.'%')
            ->max(DB::raw('CAST(SUBSTR(assignment_number, '.($prefixLen + 1).') AS UNSIGNED)'));

        $next = ($max ?? 0) + 1;

        return $prefix.str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }
}
