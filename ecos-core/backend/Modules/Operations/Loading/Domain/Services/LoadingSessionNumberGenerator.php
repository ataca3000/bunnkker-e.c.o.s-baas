<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Services;

use Illuminate\Support\Facades\DB;

final class LoadingSessionNumberGenerator
{
    public function next(string $companyId): string
    {
        $prefix = 'LOAD-'.now()->format('Ym').'-';
        $prefixLen = strlen($prefix);

        $max = DB::table('loading_sessions')
            ->where('company_id', $companyId)
            ->where('session_number', 'like', $prefix.'%')
            ->max(DB::raw('CAST(SUBSTR(session_number, '.($prefixLen + 1).') AS UNSIGNED)'));

        $next = ($max ?? 0) + 1;

        return $prefix.str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }
}
