<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services;

use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Organization\Branches\Domain\Models\Branch;

/**
 * TASK-BRANCH-ASSIGNMENT-ENGINE-001 — Branch Warehouse Resolver.
 *
 * Resolves the warehouse that a branch uses for order fulfillment.
 *
 * Resolution order (first match wins):
 *   1. Branch.default_warehouse_id — explicitly configured default
 *   2. First active warehouse belonging to the branch's company (last-resort fallback
 *      that keeps orders moving when default_warehouse_id is not yet configured)
 *
 * Returns null when the branch has no reachable warehouse (company has no warehouses).
 */
final class BranchWarehouseResolver
{
    public function resolve(Branch $branch): ?string
    {
        if ($branch->default_warehouse_id !== null) {
            $exists = Warehouse::where('id', $branch->default_warehouse_id)
                ->where('is_active', true)
                ->exists();

            if ($exists) {
                return $branch->default_warehouse_id;
            }
        }

        // Fallback: first active warehouse in the same company.
        return Warehouse::where('company_id', $branch->company_id)
            ->where('is_active', true)
            ->value('id');
    }
}
