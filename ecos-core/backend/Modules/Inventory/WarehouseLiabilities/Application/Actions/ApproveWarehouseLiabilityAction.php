<?php

declare(strict_types=1);

namespace Modules\Inventory\WarehouseLiabilities\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Inventory\InventoryItems\Application\Actions\AdjustmentOutAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\ReceiptLayers\Application\Services\InventoryLayerConsumptionService;
use Modules\Inventory\WarehouseLiabilities\Domain\Enums\WarehouseLiabilityStatus;
use Modules\Inventory\WarehouseLiabilities\Domain\Models\WarehouseLiability;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Approves a warehouse liability (inventory shortage).
 *
 * On approval:
 *  1. AdjustmentOut for the shortage quantity.
 *  2. FIFO layer consumption — also captures the immutable cost snapshot.
 *  3. Updates liability status to Approved with frozen cost values.
 *
 * Cost snapshot columns are immutable once set and survive all future cost recalculations.
 */
final class ApproveWarehouseLiabilityAction
{
    public function __construct(
        private readonly AdjustmentOutAction $adjustmentOut,
        private readonly InventoryLayerConsumptionService $layerConsumption,
        private readonly InventoryItemRepositoryInterface $inventory,
    ) {}

    public function execute(
        WarehouseLiability $liability,
        string $approvedBy,
        ?string $notes = null,
    ): WarehouseLiability {
        if ($liability->status->isTerminal()) {
            throw new UnprocessableEntityHttpException(
                "Warehouse liability [{$liability->id}] has already been {$liability->status->value}.",
            );
        }

        return DB::transaction(function () use ($liability, $approvedBy, $notes): WarehouseLiability {
            $companyId = $liability->company_id;
            $warehouseId = $liability->warehouse_id;
            $productId = $liability->product_id;
            $quantity = (float) $liability->quantity;

            $dto = new StockOperationDTO(
                warehouse_id: $warehouseId,
                product_id: $productId,
                company_id: $companyId,
                quantity: $quantity,
                reference_type: 'warehouse_liability',
                reference_id: $liability->id,
                notes: "Inventory shortage deduction — liability {$liability->id}",
                // M-03: confirmed shortages must be written off regardless of active
                // reservations — physical stock does not exist; the guard must not block.
                bypassReserveGuard: true,
            );

            $this->adjustmentOut->execute($dto);

            // FIFO consumption — returns weighted unit cost for snapshot
            $snapshotUnitCost = (float) $liability->unit_cost;
            $snapshotTotalValue = (float) $liability->total_cost;

            $inventoryItem = $this->inventory->findByWarehouseAndProduct($warehouseId, $productId);
            if ($inventoryItem !== null) {
                $result = $this->layerConsumption->consume(
                    inventoryItemId: $inventoryItem->id,
                    productId: $productId,
                    warehouseId: $warehouseId,
                    companyId: $companyId,
                    quantity: $quantity,
                );
                // Overwrite with actual FIFO weighted cost from consumption
                $snapshotUnitCost = $result->weightedCost;
                $snapshotTotalValue = round($result->weightedCost * $quantity, 2);
            }

            $liability->update([
                'status' => WarehouseLiabilityStatus::Approved,
                'approved_by' => $approvedBy,
                'approved_at' => now(),
                'notes' => $notes ?? $liability->notes,
                // Immutable cost snapshot
                'cost_snapshot_unit_cost' => $snapshotUnitCost,
                'cost_snapshot_total_value' => $snapshotTotalValue,
                'cost_method' => 'FIFO',
                'currency' => 'EGP',
            ]);

            return $liability->refresh();
        });
    }

    public function reject(WarehouseLiability $liability, string $rejectedBy, ?string $reason = null): WarehouseLiability
    {
        if ($liability->status->isTerminal()) {
            throw new UnprocessableEntityHttpException(
                "Warehouse liability [{$liability->id}] has already been {$liability->status->value}.",
            );
        }

        $liability->update([
            'status' => WarehouseLiabilityStatus::Rejected,
            'approved_by' => $rejectedBy,
            'approved_at' => now(),
            'notes' => $reason ?? $liability->notes,
        ]);

        return $liability->refresh();
    }
}
