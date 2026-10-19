<?php

declare(strict_types=1);

namespace Modules\Inventory\WasteInvestigations\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Inventory\InventoryItems\Application\Actions\AdjustmentOutAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\ReceiptLayers\Application\DTO\ConsumptionResult;
use Modules\Inventory\ReceiptLayers\Application\Services\InventoryLayerConsumptionService;
use Modules\Inventory\WarehouseLiabilities\Domain\Models\WarehouseLiability;
use Modules\Inventory\WasteInvestigations\Domain\Enums\WasteInvestigationOutcome;
use Modules\Inventory\WasteInvestigations\Domain\Enums\WasteInvestigationStatus;
use Modules\Inventory\WasteInvestigations\Domain\Models\WasteInvestigation;
use Modules\Inventory\WasteInvestigations\Domain\Models\WasteInvestigationEvent;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Resolves a waste investigation.
 *
 * Outcomes:
 *  operational_waste          → AdjustmentOut + FIFO consume + FIFO cost snapshot.
 *  warehouse_responsibility   → AdjustmentOut + FIFO consume + cost snapshot + WarehouseLiability.
 *  supplier_responsibility    → No deduction. Cost snapshot from creation-time unit_cost. Create supplier claim note.
 *  preparation_responsibility → No deduction. Cost snapshot from creation-time unit_cost. Tagged for Prep OS.
 *
 * Cost snapshot values are immutable after resolution.
 */
final class ResolveWasteInvestigationAction
{
    public function __construct(
        private readonly AdjustmentOutAction $adjustmentOut,
        private readonly InventoryLayerConsumptionService $layerConsumption,
        private readonly InventoryItemRepositoryInterface $inventory,
    ) {}

    public function execute(
        WasteInvestigation $investigation,
        WasteInvestigationOutcome $outcome,
        string $resolvedBy,
        ?string $investigatorNotes = null,
    ): WasteInvestigation {
        if ($investigation->status->isResolved()) {
            throw new UnprocessableEntityHttpException('This waste investigation has already been resolved.');
        }

        $investigation->loadMissing('countSession');

        return DB::transaction(function () use ($investigation, $outcome, $resolvedBy, $investigatorNotes): WasteInvestigation {
            $companyId = $investigation->company_id;
            $warehouseId = $investigation->warehouse_id;
            $productId = $investigation->product_id;
            $quantity = (float) $investigation->quantity;
            $month = $investigation->month ?? now()->format('Y-m');

            // ── Inventory deduction (operational_waste + warehouse_responsibility) ──────
            $consumptionResult = null;
            if ($outcome->requiresInventoryDeduction()) {
                $dto = new StockOperationDTO(
                    warehouse_id: $warehouseId,
                    product_id: $productId,
                    company_id: $companyId,
                    quantity: $quantity,
                    reference_type: 'waste_investigation',
                    reference_id: $investigation->id,
                    notes: "Waste deduction: {$outcome->label()} — investigation {$investigation->id}",
                    // M-03: confirmed waste/damage must be written off regardless of
                    // active reservations — physical stock is gone; the guard must not block.
                    bypassReserveGuard: true,
                );

                $this->adjustmentOut->execute($dto);

                $inventoryItem = $this->inventory->findByWarehouseAndProduct($warehouseId, $productId);
                if ($inventoryItem !== null) {
                    $consumptionResult = $this->layerConsumption->consume(
                        inventoryItemId: $inventoryItem->id,
                        productId: $productId,
                        warehouseId: $warehouseId,
                        companyId: $companyId,
                        quantity: $quantity,
                    );
                }
            }

            // ── Cost snapshot ─────────────────────────────────────────────────────────
            // For deducted outcomes: use FIFO weighted cost from consumption result.
            // For non-deducted outcomes: freeze creation-time unit_cost from count session.
            [$snapshotUnitCost, $snapshotTotalValue] = $this->buildCostSnapshot(
                $investigation,
                $quantity,
                $consumptionResult,
            );

            // ── Warehouse liability (warehouse_responsibility only) ────────────────────
            if ($outcome->createsWarehouseLiability()) {
                WarehouseLiability::query()->create([
                    'company_id' => $companyId,
                    'warehouse_id' => $warehouseId,
                    'product_id' => $productId,
                    'count_session_id' => $investigation->count_session_id,
                    'count_line_id' => $investigation->count_line_id,
                    'waste_investigation_id' => $investigation->id,
                    'liability_type' => 'waste_transferred',
                    'quantity' => $quantity,
                    'unit_cost' => $snapshotUnitCost,
                    'total_cost' => $snapshotTotalValue,
                    'cost_snapshot_unit_cost' => $snapshotUnitCost,
                    'cost_snapshot_total_value' => $snapshotTotalValue,
                    'cost_method' => 'FIFO',
                    'currency' => 'EGP',
                    'status' => 'approved',
                    'approved_by' => $resolvedBy,
                    'approved_at' => now(),
                    'notes' => "Converted from waste investigation — {$outcome->label()}",
                    'month' => $month,
                ]);

                WasteInvestigationEvent::log(
                    investigationId: $investigation->id,
                    eventType: 'liability_created',
                    performedBy: $resolvedBy,
                    description: 'Warehouse liability auto-created and approved.',
                );
            }

            // ── Resolve investigation + freeze cost snapshot ──────────────────────────
            $investigation->update([
                'status' => WasteInvestigationStatus::Resolved,
                'outcome' => $outcome,
                'investigator_notes' => $investigatorNotes,
                'resolved_by' => $resolvedBy,
                'resolved_at' => now(),
                'cost_snapshot_unit_cost' => $snapshotUnitCost,
                'cost_snapshot_total_value' => $snapshotTotalValue,
                'cost_method' => 'FIFO',
                'currency' => 'EGP',
                'cost_snapshot_at' => now(),
            ]);

            WasteInvestigationEvent::log(
                investigationId: $investigation->id,
                eventType: 'resolved',
                performedBy: $resolvedBy,
                description: "Resolved as {$outcome->label()}. Cost snapshot: {$snapshotTotalValue} EGP (unit: {$snapshotUnitCost} EGP).",
                changes: ['outcome' => ['from' => null, 'to' => $outcome->value]],
            );

            return $investigation->refresh();
        });
    }

    /** @return array{float, float} [unit_cost, total_value] */
    private function buildCostSnapshot(
        WasteInvestigation $investigation,
        float $quantity,
        ?ConsumptionResult $consumptionResult,
    ): array {
        if ($consumptionResult !== null) {
            $unitCost = $consumptionResult->weightedCost;
            $totalValue = round($consumptionResult->weightedCost * $quantity, 2);
        } else {
            $unitCost = (float) ($investigation->unit_cost ?? 0);
            $totalValue = (float) ($investigation->total_cost ?? round($unitCost * $quantity, 2));
        }

        return [$unitCost, $totalValue];
    }
}
