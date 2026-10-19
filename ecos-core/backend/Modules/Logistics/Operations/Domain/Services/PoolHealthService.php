<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Modules\Logistics\Operations\Domain\Enums\PoolStatus;
use Modules\Logistics\Operations\Domain\Models\ResourcePool;

/**
 * Is a pool in a fit state to be planned with?
 *
 * Health here is about SUPPLY, not safety. "Below strength" means the pool
 * cannot field what it promised; whether any individual vehicle is roadworthy is
 * Fleet's verdict and is quoted, never re-judged.
 *
 * Every figure is derived at read time. Nothing is stored, so a health reading
 * can never be stale relative to the facts it summarises.
 */
class PoolHealthService
{
    public function __construct(
        private readonly UnifiedResourcePoolService $unified,
    ) {}

    /** @return array<string, mixed> */
    public function forPool(ResourcePool $pool): array
    {
        $counts = $this->unified->forPool($pool)['counts'];

        $issues = [];

        if (! $pool->status->isUsable()) {
            $issues[] = "The pool is {$pool->status->label()} and cannot be drawn on.";
        }

        if ($counts['members'] === 0) {
            $issues[] = 'The pool has no members, so it can field nothing.';
        }

        if ($pool->min_assignable > 0 && $counts['available'] < $pool->min_assignable) {
            $issues[] = "Only {$counts['available']} of the required {$pool->min_assignable} members are available.";
        }

        // A mixed pool is limited by whichever side runs out first — a depot
        // with eight vans and two drivers fields two trips, not eight.
        if ($pool->pool_type->accepts(\Modules\Logistics\Operations\Domain\Enums\PoolMemberType::Vehicle)
            && $pool->pool_type->accepts(\Modules\Logistics\Operations\Domain\Enums\PoolMemberType::Driver)) {
            $vehicles = $counts['available_vehicles'];
            $drivers = $counts['available_drivers'];

            if ($vehicles > 0 && $drivers === 0) {
                $issues[] = 'There are vehicles available but no drivers, so nothing can go out.';
            } elseif ($drivers > 0 && $vehicles === 0) {
                $issues[] = 'There are drivers available but no vehicles, so nothing can go out.';
            }
        }

        if ($counts['orphaned'] > 0) {
            $issues[] = "{$counts['orphaned']} member(s) no longer exist as resources and should be removed.";
        }

        if ($counts['suspended'] > 0) {
            $issues[] = "{$counts['suspended']} member(s) are held out of the pool.";
        }

        return [
            'pool_id' => $pool->uuid,
            'pool_name' => $pool->name,
            'status' => $pool->status->value,
            'counts' => $counts,
            'min_assignable' => $pool->min_assignable,
            // Ordered, human-readable reasons — the LOG-005 retryBlockers()
            // contract. "Unhealthy" with no reason teaches nobody anything.
            'issues' => $issues,
            'is_healthy' => $issues === [],
            'fieldable_units' => min($counts['available_vehicles'], $counts['available_drivers']),
        ];
    }

    /**
     * Health across every pool, worst first.
     *
     * @return array<string, mixed>
     */
    public function overview(?string $companyId = null): array
    {
        $pools = ResourcePool::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('status', '!=', PoolStatus::Archived->value)
            ->get();

        $rows = $pools->map(fn (ResourcePool $pool) => $this->forPool($pool))->all();

        usort($rows, static fn (array $a, array $b) => count($b['issues']) <=> count($a['issues']));

        $unhealthy = array_filter($rows, static fn (array $r) => ! $r['is_healthy']);

        return [
            'pools' => array_values($rows),
            'pool_count' => count($rows),
            'unhealthy_count' => count($unhealthy),
            'total_available_vehicles' => array_sum(array_column(
                array_column($rows, 'counts'), 'available_vehicles'
            )),
            'total_available_drivers' => array_sum(array_column(
                array_column($rows, 'counts'), 'available_drivers'
            )),
        ];
    }
}
