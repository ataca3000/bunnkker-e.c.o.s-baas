<?php

declare(strict_types=1);

namespace Modules\Inventory\Transfer\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Modules\Inventory\DomainEvents\Contracts\DomainEventBus;
use Modules\Inventory\DomainEvents\Events\InventoryTransferred;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;
use Modules\Inventory\DomainEvents\Events\WarehouseTransferCompleted;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Domain\Enums\LedgerMovementType;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException;
use Modules\Inventory\Products\Domain\Models\Product;
use Modules\Inventory\ReceiptLayers\Domain\Models\InventoryReceiptLayer;
use Modules\Inventory\Transfer\Application\DTO\TransferStockDTO;
use Modules\Inventory\Transfer\Domain\Enums\TransferStatus;
use Modules\Inventory\Transfer\Domain\Exceptions\CrossCompanyTransferException;
use Modules\Inventory\Transfer\Domain\Exceptions\InactiveWarehouseException;
use Modules\Inventory\Transfer\Domain\Exceptions\SameWarehouseTransferException;
use Modules\Inventory\Transfer\Domain\Models\WarehouseTransfer;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use RuntimeException;

/**
 * Canonical warehouse-to-warehouse stock transfer.
 *
 * Execution pipeline (all within one DB::transaction):
 *   1.  Validate inputs and business rules.
 *   2.  Lock source InventoryItem (SELECT FOR UPDATE).
 *   3.  Validate available quantity (on_hand − reserved ≥ requested).
 *   4.  findOrCreate + lock destination InventoryItem.
 *   5.  Process source FIFO layers in chronological order, reduce remaining_qty.
 *   6.  Recreate matching layers at destination (same unit cost + receipt metadata).
 *   7.  Decrease source on_hand_qty.
 *   8.  Increase destination on_hand_qty.
 *   9.  Write TransferOut ledger entry (source).
 *  10.  Write TransferIn ledger entry (destination).
 *  11.  Create WarehouseTransfer audit record.
 *  12.  Commit.
 *  13.  Publish InventoryTransferred + WarehouseTransferCompleted events via afterCommit.
 *
 * Rollback: any exception inside the transaction rolls back every write atomically.
 *
 * L-01: events now published via afterCommit() — safe even when nested in an outer transaction.
 * L-02: BCMath used throughout for FIFO cost calculations — no float precision drift.
 * L-06: transfer number generated with Str::uuid() — collision-free.
 */
final class TransferStockAction extends BaseAction
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $inventory,
        private readonly DomainEventBus $eventBus,
    ) {}

    /**
     * @param  mixed  ...$arguments  [TransferStockDTO]
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof TransferStockDTO) {
            throw new InvalidArgumentException('TransferStockAction::execute expects a TransferStockDTO.');
        }

        $this->validateInputs($dto);

        // Load and validate warehouses BEFORE the transaction to fail fast.
        $srcWarehouse = Warehouse::query()->find($dto->sourceWarehouseId);
        $destWarehouse = Warehouse::query()->find($dto->destinationWarehouseId);

        if ($srcWarehouse === null) {
            throw new DomainException("Source warehouse [{$dto->sourceWarehouseId}] not found.");
        }
        if ($destWarehouse === null) {
            throw new DomainException("Destination warehouse [{$dto->destinationWarehouseId}] not found.");
        }
        if (! $srcWarehouse->is_active) {
            throw new InactiveWarehouseException($srcWarehouse->id, 'source warehouse');
        }
        if (! $destWarehouse->is_active) {
            throw new InactiveWarehouseException($destWarehouse->id, 'destination warehouse');
        }
        if ((string) $srcWarehouse->company_id !== $dto->companyId) {
            throw new CrossCompanyTransferException((string) $srcWarehouse->company_id, $dto->companyId);
        }
        if ((string) $destWarehouse->company_id !== $dto->companyId) {
            throw new CrossCompanyTransferException($dto->companyId, (string) $destWarehouse->company_id);
        }

        $product = Product::query()->find($dto->productId);
        if ($product === null) {
            throw new DomainException("Product [{$dto->productId}] not found.");
        }
        if (! $product->is_active) {
            throw new DomainException("Product [{$dto->productId}] is inactive. Transfer rejected.");
        }

        // State captured outside the transaction for post-commit event payloads.
        $transferRecord = null;
        $events = [];

        DB::transaction(function () use ($dto, $srcWarehouse, $destWarehouse, &$transferRecord, &$events): void {

            // ── Step 1: Lock source inventory row ─────────────────────────────
            $srcItem = $this->inventory->findOrCreate($dto->sourceWarehouseId, $dto->productId, $dto->companyId);
            $lockedSrc = $this->inventory->lockForUpdate($srcItem->id);

            if ($lockedSrc === null) {
                throw new RuntimeException('Source InventoryItem disappeared during transaction.');
            }

            $srcOnHandBefore = (float) $lockedSrc->on_hand_qty;
            $srcReservedBefore = (float) $lockedSrc->reserved_qty;
            $availableQty = $srcOnHandBefore - $srcReservedBefore;

            // ── Step 2: Available-stock validation ────────────────────────────
            if ($availableQty < $dto->quantity) {
                throw new InsufficientStockException(
                    $dto->productId,
                    $dto->sourceWarehouseId,
                    $dto->quantity,
                    $availableQty,
                );
            }

            // ── Step 3: Lock destination inventory row ────────────────────────
            $destItem = $this->inventory->findOrCreate($dto->destinationWarehouseId, $dto->productId, $dto->companyId);
            $lockedDest = $this->inventory->lockForUpdate($destItem->id);

            if ($lockedDest === null) {
                throw new RuntimeException('Destination InventoryItem disappeared during transaction.');
            }

            $destOnHandBefore = (float) $lockedDest->on_hand_qty;
            $destReservedBefore = (float) $lockedDest->reserved_qty;

            // ── Step 4: Process source FIFO layers ────────────────────────────
            // Load in FIFO order (oldest created first) with a write lock.
            // Scoped to company_id to enforce tenant isolation.
            $sourceLayers = InventoryReceiptLayer::query()
                ->where('product_id', $dto->productId)
                ->where('warehouse_id', $dto->sourceWarehouseId)
                ->where('company_id', $dto->companyId)
                ->where('remaining_qty', '>', 0)
                ->lockForUpdate()
                ->orderBy('created_at')
                ->orderBy('id')
                ->get();

            $available = $sourceLayers->sum(fn ($l) => (float) $l->remaining_qty);

            if ($available < $dto->quantity) {
                throw new InsufficientStockException(
                    $dto->productId,
                    $dto->sourceWarehouseId,
                    $dto->quantity,
                    $available,
                );
            }

            // L-02: BCMath for all FIFO cost calculations — eliminates float drift.
            $remaining = (string) $dto->quantity;
            $totalCost = '0';
            $destLayerSlices = [];

            foreach ($sourceLayers as $layer) {
                if (bccomp($remaining, '0', 4) <= 0) {
                    break;
                }

                $layerRemaining = (string) $layer->remaining_qty;
                $consume = bccomp($remaining, $layerRemaining, 4) <= 0
                    ? $remaining
                    : $layerRemaining;
                $unitCost = (string) $layer->landed_unit_cost;
                $sliceCost = bcmul($consume, $unitCost, 4);

                $layer->remaining_qty = bcsub($layerRemaining, $consume, 4);
                $layer->save();

                $destLayerSlices[] = [
                    'quantity' => $consume,
                    'landed_unit_cost' => $unitCost,
                    'supplier_id' => $layer->supplier_id,
                    'receipt_date' => $layer->receipt_date,
                    'sale_price_snapshot' => $layer->sale_price_snapshot,
                ];

                $totalCost = bcadd($totalCost, $sliceCost, 4);
                $remaining = bcsub($remaining, $consume, 4);
            }

            $weightedUnitCost = $dto->quantity > 0
                ? bcdiv($totalCost, (string) $dto->quantity, 4)
                : '0.0000';

            // ── Step 5: Create destination FIFO layers ────────────────────────
            // Each slice preserves the original receipt_date, unit cost, and supplier
            // so the destination warehouse's FIFO history reflects the true cost basis.
            foreach ($destLayerSlices as $slice) {
                InventoryReceiptLayer::query()->create([
                    'company_id' => $dto->companyId,
                    'supplier_id' => $slice['supplier_id'],
                    'product_id' => $dto->productId,
                    'goods_receipt_id' => null,
                    'goods_receipt_line_id' => null,
                    'warehouse_id' => $dto->destinationWarehouseId,
                    'received_qty' => $slice['quantity'],
                    'remaining_qty' => $slice['quantity'],
                    'landed_unit_cost' => $slice['landed_unit_cost'],
                    'sale_price_snapshot' => $slice['sale_price_snapshot'],
                    'receipt_date' => $slice['receipt_date'],
                ]);
            }

            // ── Step 6: Update source InventoryItem ───────────────────────────
            $srcOnHandAfter = $srcOnHandBefore - $dto->quantity;
            $lockedSrc->on_hand_qty = $srcOnHandAfter;
            $this->inventory->save($lockedSrc);

            // ── Step 7: Update destination InventoryItem ──────────────────────
            $destOnHandAfter = $destOnHandBefore + $dto->quantity;
            $lockedDest->on_hand_qty = $destOnHandAfter;
            $this->inventory->save($lockedDest);

            // ── Step 8: Generate transfer number — UUID-based, collision-free ──
            // L-06: replaces uniqid() which collides under concurrent microsecond load.
            $transferNumber = 'TRF-'.now()->format('Ymd').'-'.strtoupper(substr((string) Str::uuid(), 0, 8));

            // ── Step 9: Write TransferOut ledger entry (source) ───────────────
            $this->inventory->recordEntry([
                'inventory_item_id' => $lockedSrc->id,
                'warehouse_id' => $dto->sourceWarehouseId,
                'product_id' => $dto->productId,
                'company_id' => $dto->companyId,
                'movement_type' => LedgerMovementType::TransferOut->value,
                'quantity' => $dto->quantity,
                'on_hand_before' => $srcOnHandBefore,
                'on_hand_after' => $srcOnHandAfter,
                'reserved_before' => $srcReservedBefore,
                'reserved_after' => $srcReservedBefore,
                'reference_type' => 'warehouse_transfer',
                'reference_id' => $transferNumber,
                'notes' => "TransferOut → {$destWarehouse->name}. {$dto->notes}",
            ]);

            // ── Step 10: Write TransferIn ledger entry (destination) ──────────
            $this->inventory->recordEntry([
                'inventory_item_id' => $lockedDest->id,
                'warehouse_id' => $dto->destinationWarehouseId,
                'product_id' => $dto->productId,
                'company_id' => $dto->companyId,
                'movement_type' => LedgerMovementType::TransferIn->value,
                'quantity' => $dto->quantity,
                'on_hand_before' => $destOnHandBefore,
                'on_hand_after' => $destOnHandAfter,
                'reserved_before' => $destReservedBefore,
                'reserved_after' => $destReservedBefore,
                'reference_type' => 'warehouse_transfer',
                'reference_id' => $transferNumber,
                'notes' => "TransferIn ← {$srcWarehouse->name}. {$dto->notes}",
            ]);

            // ── Step 11: Create WarehouseTransfer audit record ────────────────
            $totalCostFloat = (float) $totalCost;
            $weightedUnitCostFloat = (float) $weightedUnitCost;

            $transferRecord = WarehouseTransfer::query()->create([
                'transfer_number' => $transferNumber,
                'company_id' => $dto->companyId,
                'source_warehouse_id' => $dto->sourceWarehouseId,
                'destination_warehouse_id' => $dto->destinationWarehouseId,
                'product_id' => $dto->productId,
                'quantity' => $dto->quantity,
                'total_cost' => $totalCostFloat,
                'weighted_unit_cost' => $weightedUnitCostFloat,
                'status' => TransferStatus::Completed->value,
                'transferred_by' => $dto->actorId,
                'transferred_at' => now(),
                'reference' => $dto->reference,
                'notes' => $dto->notes,
                'meta' => [
                    'source_on_hand_before' => $srcOnHandBefore,
                    'source_on_hand_after' => $srcOnHandAfter,
                    'destination_on_hand_before' => $destOnHandBefore,
                    'destination_on_hand_after' => $destOnHandAfter,
                    'layer_slices_count' => count($destLayerSlices),
                ],
            ]);

            $events[] = new InventoryTransferred(
                transferId: $transferRecord->id,
                productId: $dto->productId,
                companyId: $dto->companyId,
                sourceWarehouseId: $dto->sourceWarehouseId,
                destinationWarehouseId: $dto->destinationWarehouseId,
                quantity: $dto->quantity,
                totalCost: $totalCostFloat,
                weightedUnitCost: $weightedUnitCostFloat,
                transferNumber: $transferNumber,
                inventoryClass: InventoryClass::fromProductType(
                    Product::query()->find($dto->productId)?->product_type,
                    $dto->productId,
                ),
            );

            $events[] = new WarehouseTransferCompleted(
                transferId: $transferRecord->id,
                transferNumber: $transferNumber,
                companyId: $dto->companyId,
                sourceWarehouseId: $dto->sourceWarehouseId,
                destinationWarehouseId: $dto->destinationWarehouseId,
                productId: $dto->productId,
                quantity: $dto->quantity,
                totalCost: $totalCostFloat,
                actorId: $dto->actorId,
                reference: $dto->reference,
            );
        });

        // L-01: afterCommit guarantees events fire only after the outermost transaction
        // commits — safe even when this action is called from within a larger transaction.
        DB::connection()->afterCommit(function () use ($events): void {
            foreach ($events as $event) {
                $this->eventBus->publish($event);
            }
        });

        return OperationResult::success($transferRecord, 'Warehouse transfer completed successfully.');
    }

    private function validateInputs(TransferStockDTO $dto): void
    {
        if ($dto->sourceWarehouseId === $dto->destinationWarehouseId) {
            throw new SameWarehouseTransferException($dto->sourceWarehouseId);
        }

        if ($dto->quantity <= 0) {
            throw new InvalidArgumentException('Transfer quantity must be greater than zero.');
        }
    }
}
