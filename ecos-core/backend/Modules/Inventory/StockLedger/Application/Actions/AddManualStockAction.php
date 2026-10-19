<?php

declare(strict_types=1);

namespace Modules\Inventory\StockLedger\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Modules\CostManagement\Domain\Enums\CostUpdateSource;
use Modules\CostManagement\Domain\Services\MaterialCostService;
use Modules\Inventory\InventoryItems\Application\Actions\AdjustmentInAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Domain\Exceptions\MissingAdjustmentValuationException;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;

/**
 * Manual stock addition — the single authoritative write path for operator-initiated
 * inventory increases.
 *
 * Every call atomically:
 *   1. Increases InventoryItem.on_hand_qty and records a StockLedgerEntry (AdjustmentIn)
 *   2. Creates an InventoryReceiptLayer so the quantity enters the FIFO queue
 *   3. Updates the material cost cascade when a unit cost is supplied
 *
 * The legacy stock_movements table is no longer written by this action.
 */
final class AddManualStockAction extends BaseAction
{
    public function __construct(
        private readonly AdjustmentInAction $adjustmentIn,
        private readonly InventoryItemRepositoryInterface $inventory,
        private readonly MaterialCostService $materialCostService,
    ) {}

    /**
     * @param  mixed  ...$arguments  [Product, Warehouse, float $quantity, array $meta]
     * @param  array{
     *   unit_cost?: float|null,
     *   notes?: string|null,
     *   updated_by?: string|null,
     * } $meta
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var Product $product */
        $product = $arguments[0];
        /** @var Warehouse $warehouse */
        $warehouse = $arguments[1];
        $quantity = (float) ($arguments[2] ?? 0);
        $meta = (array) ($arguments[3] ?? []);

        if ($quantity <= 0) {
            throw new InvalidArgumentException('Quantity must be greater than zero.');
        }

        $companyId = (string) $warehouse->company_id;
        $unitCost = isset($meta['unit_cost']) && is_numeric($meta['unit_cost'])
            ? (float) $meta['unit_cost'] : null;
        $totalValue = isset($meta['total_value']) && is_numeric($meta['total_value'])
            ? (float) $meta['total_value'] : null;

        // ── Mandatory manual valuation (Decision 2) ─────────────────────────
        // This used to fall back to the product's average / FIFO / last-purchase
        // cost. That made every manual add succeed, which is exactly the problem:
        // stock added by hand has no purchase behind it, so those figures value
        // it at what OTHER stock cost and debit the difference to a real asset
        // account with nothing to back it. The caller now states the value or the
        // add is refused. AdjustmentInAction enforces the same rule, so no path
        // can slip past it.
        $dto = new StockOperationDTO(
            warehouse_id: $warehouse->id,
            product_id: $product->id,
            company_id: $companyId,
            quantity: $quantity,
            reference_type: 'manual_adjustment',
            reference_id: null,
            notes: $meta['notes'] ?? null,
            unit_cost: $unitCost,
            total_value: $totalValue,
        );

        $statedUnitCost = $dto->statedUnitCost();

        if ($statedUnitCost === null) {
            throw MissingAdjustmentValuationException::forProduct((string) $product->id);
        }

        $layerCost = $statedUnitCost;

        DB::transaction(function () use ($product, $warehouse, $dto, $quantity, $layerCost, $companyId, $unitCost, $meta): void {
            // Step 1: update InventoryItem + write StockLedgerEntry + fire domain event
            // (runs inside a savepoint because we are already inside a transaction)
            $this->adjustmentIn->execute($dto);

            // Step 2: add the quantity to the FIFO queue
            InventoryReceiptLayer::query()->create([
                'company_id' => $companyId,
                'supplier_id' => $product->last_supplier_id,
                'product_id' => $product->id,
                'goods_receipt_id' => null,
                'goods_receipt_line_id' => null,
                'warehouse_id' => $warehouse->id,
                'received_qty' => $quantity,
                'remaining_qty' => $quantity,
                'landed_unit_cost' => $layerCost,
                'sale_price_snapshot' => $product->sale_price,
                'receipt_date' => now()->toDateString(),
            ]);

            // Step 3: cost cascade — only when cost is explicitly supplied by the operator
            if ($unitCost !== null && $unitCost >= 0) {
                $this->materialCostService->update(
                    $product,
                    $unitCost,
                    CostUpdateSource::Manual,
                    ['updated_by' => $meta['updated_by'] ?? null],
                );
            }
        });

        $item = $this->inventory->findByWarehouseAndProduct($warehouse->id, $product->id);

        return OperationResult::success($item, 'Manual stock adjustment applied successfully.');
    }
}
