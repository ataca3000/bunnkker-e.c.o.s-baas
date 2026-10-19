<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierReturns\Application\Actions;

use Illuminate\Support\Facades\DB;
use Modules\Inventory\InventoryItems\Application\Actions\AdjustmentOutAction;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Purchasing\SupplierReturns\Domain\Models\SupplierReturn;

/**
 * Reverses inventory when a Supplier Return is approved.
 *
 * For each return line, decrements on_hand_qty in the relevant warehouse
 * using AdjustmentOutAction (same mechanism as any negative adjustment).
 *
 * Wraps ALL lines in a single DB transaction — if any line fails the
 * entire reversal is rolled back and the exception propagates to the caller.
 *
 * After all lines succeed, stamps the return with:
 *   - inventory_restocked = true
 *   - inventory_restocked_at = now()
 *
 * IMPORTANT: Call this AFTER status has been set to Approved.
 * The caller should load 'lines.product' and 'warehouse' on the return
 * before passing it to execute().
 *
 * Usage:
 *   $return->load('lines.product', 'warehouse');
 *   $this->reverseInventory->execute($return);
 */
final class ReverseSupplierReturnInventoryAction
{
    public function __construct(
        private readonly AdjustmentOutAction $adjustmentOut,
    ) {}

    public function execute(SupplierReturn $return): void
    {
        // Ensure the warehouse relationship (and its company_id) is loaded
        $return->loadMissing(['lines.product', 'warehouse']);

        $warehouseId = (string) $return->warehouse_id;
        $companyId = (string) ($return->warehouse?->company_id ?? '');

        DB::transaction(function () use ($return, $warehouseId, $companyId): void {
            foreach ($return->lines as $line) {
                $productId = (string) $line->product_id;
                $quantity = (float) $line->return_quantity;

                if ($quantity <= 0 || $productId === '') {
                    continue;
                }

                $dto = new StockOperationDTO(
                    warehouse_id: $warehouseId,
                    product_id: $productId,
                    company_id: $companyId,
                    quantity: $quantity,
                    reference_type: 'supplier_return',
                    reference_id: (string) $return->id,
                    notes: "Inventory reversal for supplier return {$return->return_number}",
                );

                $this->adjustmentOut->execute($dto);
            }

            // Stamp the return as inventory-restocked
            $return->inventory_restocked = true;
            $return->inventory_restocked_at = now();
            $return->save();
        });
    }
}
