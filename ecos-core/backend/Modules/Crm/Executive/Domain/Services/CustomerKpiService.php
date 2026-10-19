<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Crm\Executive\Domain\Support\ExecutivePeriod;
use Modules\Crm\Executive\Domain\Support\Metric;

/**
 * Headline customer KPIs.
 *
 * ┌─ READ-ONLY · DERIVED ONLY ──────────────────────────────────────────────┐
 * │ The executive layer owns no data. It reads the CRM's own tables through     │
 * │ query builders — never a write-capable model — and derives every number on  │
 * │ the way out. Nothing here is stored, so nothing here can drift.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class CustomerKpiService
{
    /** @return array<string, mixed> */
    public function forPeriod(string $companyId, ExecutivePeriod $period): array
    {
        $previous = $period->previous();

        $byStatus = DB::table('customers')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->pluck('total', 'status');

        $total = (int) array_sum($byStatus->all());
        $newInPeriod = $this->countCreated($companyId, $period);
        $newInPrevious = $this->countCreated($companyId, $previous);

        return [
            'total_customers' => $total,
            'active_customers' => (int) ($byStatus['active'] ?? 0),
            'prospects' => (int) ($byStatus['prospect'] ?? 0),
            'inactive_customers' => (int) ($byStatus['inactive'] ?? 0),
            'archived_customers' => (int) ($byStatus['archived'] ?? 0),
            'new_customers' => Metric::compare($newInPeriod, $newInPrevious, 0),
            'by_status' => $byStatus->map(fn ($v) => (int) $v)->all(),
        ];
    }

    private function countCreated(string $companyId, ExecutivePeriod $period): int
    {
        return DB::table('customers')
            ->where('company_id', $companyId)
            ->whereNull('deleted_at')
            ->whereBetween('created_at', [$period->start, $period->end])
            ->count();
    }
}
