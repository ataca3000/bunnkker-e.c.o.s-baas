<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Domain\Services;

use Modules\CostManagement\Domain\Enums\CostStrategy;
use Modules\CostManagement\Domain\Services\EnterpriseCostEngine;
use Modules\Inventory\InventoryItems\Domain\DTO\InventorySummary;
use Modules\Inventory\InventoryItems\Domain\Models\InventoryItem;

/**
 * InventorySummaryService — the single source of truth for inventory quantities.
 *
 * EPIC-DATA-CONSOLIDATION-001, Phase B. Replaces the ~10 ad-hoc availability/value
 * calculations scattered across repositories, controllers, dashboards, demand and
 * manufacturing services.
 *
 * OFFICIAL ENTERPRISE RULE — availability is computed CLAMP-PER-WAREHOUSE, THEN SUM:
 *
 *     available = Σ over warehouses of max(on_hand − reserved, 0)
 *
 * (NOT GREATEST(Σon_hand − Σreserved, 0) — the "sum-then-clamp" shape that several
 * legacy sites use and that disagrees whenever one warehouse is over-reserved.)
 *
 * Inventory value is delegated to EnterpriseCostEngine using the canonical FIFO basis.
 * No screen may calculate availability or value itself.
 */
final class InventorySummaryService
{
    public function __construct(
        private readonly EnterpriseCostEngine $costEngine,
    ) {}

    /**
     * Produce the canonical inventory summary for one product.
     * When $companyId is null, aggregates across all companies (superuser/global view).
     */
    public function summarize(string $productId, ?string $companyId = null): InventorySummary
    {
        $query = InventoryItem::query()
            ->where('product_id', $productId)
            ->with('warehouse');

        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }

        $items = $query->get();

        $onHand = 0.0;
        $reserved = 0.0;
        $available = 0.0;
        $warehouses = [];

        foreach ($items as $item) {
            $itemOnHand = (float) $item->on_hand_qty;
            $itemReserved = (float) $item->reserved_qty;
            $itemAvailable = $item->availableQty(); // max(on_hand − reserved, 0) — clamp per warehouse

            $onHand += $itemOnHand;
            $reserved += $itemReserved;
            $available += $itemAvailable; // then sum

            $warehouses[] = [
                'warehouse_id' => $item->warehouse_id,
                'warehouse_name' => $item->warehouse?->name,
                'warehouse_code' => $item->warehouse?->code,
                'on_hand_qty' => $itemOnHand,
                'reserved_qty' => $itemReserved,
                'available_qty' => $itemAvailable,
            ];
        }

        $value = $this->costEngine->inventoryValue($productId, $companyId, CostStrategy::canonical());

        return new InventorySummary(
            productId: $productId,
            onHand: round($onHand, 4),
            reserved: round($reserved, 4),
            available: round($available, 4),
            inventoryValue: $value,
            warehouses: $warehouses,
        );
    }
}
