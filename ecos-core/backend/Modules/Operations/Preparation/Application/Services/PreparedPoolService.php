<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Services;

use Illuminate\Support\Collection;
use Modules\Operations\Preparation\Domain\Models\PreparedPoolMovement;
use Modules\Operations\Preparation\Domain\Models\PreparedProductsPool;

/**
 * Prepared Products Pool service.
 *
 * Centralises query and movement logic for the Prepared Products Pool.
 * CONTRACT: no business rule decisions, no events. Pure data access.
 */
final class PreparedPoolService
{
    /**
     * Get pool entries for a company + warehouse, with optional filters.
     *
     * @return Collection<int, PreparedProductsPool>
     */
    public function getEntries(
        string $companyId,
        ?string $warehouseId = null,
        ?string $qualityStatus = null,
        bool $availableOnly = false,
    ): Collection {
        return PreparedProductsPool::where('company_id', $companyId)
            ->when($warehouseId, fn ($q, $v) => $q->where('warehouse_id', $v))
            ->when($qualityStatus, fn ($q, $v) => $q->where('quality_status', $v))
            ->when($availableOnly, fn ($q) => $q->where('quantity_available', '>', 0))
            ->orderByDesc('prepared_at')
            ->get();
    }

    /**
     * Get movement history for a pool entry.
     *
     * @return Collection<int, PreparedPoolMovement>
     */
    public function getMovements(string $poolEntryId, int $limit = 50): Collection
    {
        return PreparedPoolMovement::where('pool_entry_id', $poolEntryId)
            ->orderByDesc('recorded_at')
            ->limit($limit)
            ->get();
    }

    /**
     * Summarise pool totals for a company + warehouse.
     *
     * @return array{products_count:int, units_available:float, units_reserved:float, units_loaded:float}
     */
    public function getSummary(string $companyId, ?string $warehouseId = null): array
    {
        $q = PreparedProductsPool::where('company_id', $companyId)
            ->when($warehouseId, fn ($q, $v) => $q->where('warehouse_id', $v));

        return [
            'products_count' => (int) $q->count(),
            'units_available' => (float) $q->sum('quantity_available'),
            'units_reserved' => (float) $q->sum('quantity_reserved'),
            'units_loaded' => (float) $q->sum('quantity_loaded'),
        ];
    }
}
