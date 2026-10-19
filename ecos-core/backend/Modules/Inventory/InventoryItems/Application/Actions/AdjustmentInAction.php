<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Modules\Inventory\DomainEvents\Contracts\DomainEventBus;
use Modules\Inventory\DomainEvents\Events\InventoryStockAdjusted;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Domain\Enums\LedgerMovementType;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InvalidInventoryMovementException;
use Modules\Inventory\InventoryItems\Domain\Exceptions\MissingAdjustmentValuationException;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Positive inventory adjustment — used when physical count exceeds system quantity.
 *
 * Increases on_hand_qty. Records AdjustmentIn movement type.
 *
 * Publishes InventoryStockAdjusted (type=in) via afterCommit, guaranteeing the
 * event fires only after the outermost transaction commits — even when called
 * from within a nested transaction (e.g. ApproveCountSessionAction).
 */
final class AdjustmentInAction extends BaseAction
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $inventory,
        private readonly DomainEventBus $eventBus,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof StockOperationDTO) {
            throw new InvalidArgumentException('AdjustmentInAction::execute expects a StockOperationDTO.');
        }

        if ($dto->quantity <= 0) {
            throw new InvalidInventoryMovementException('Quantity must be greater than zero');
        }

        // ── Mandatory manual valuation (Decision 2) ─────────────────────────
        // Checked BEFORE the transaction opens, so an unvalued adjustment never
        // touches stock at all. Every other movement can read its value from a
        // purchase or a consumed layer; an increase has neither, so the figure
        // has to come from the person recording it. Substituting an average
        // here would value new stock at what unrelated stock cost and debit the
        // difference to a real asset account, silently.
        $statedUnitCost = $dto->statedUnitCost();

        if ($statedUnitCost === null) {
            throw MissingAdjustmentValuationException::forProduct($dto->product_id);
        }

        $event = null;

        $result = DB::transaction(function () use ($dto, $statedUnitCost, &$event) {
            $item = $this->inventory->findOrCreate(
                $dto->warehouse_id,
                $dto->product_id,
                $dto->company_id,
            );

            $locked = $this->inventory->lockForUpdate($item->id);

            if ($locked === null) {
                throw new InvalidInventoryMovementException('InventoryItem disappeared during transaction');
            }

            $onHandBefore = (float) $locked->on_hand_qty;
            $reservedBefore = (float) $locked->reserved_qty;
            $onHandAfter = $onHandBefore + $dto->quantity;

            $locked->on_hand_qty = $onHandAfter;
            $this->inventory->save($locked);

            $this->inventory->recordEntry([
                'inventory_item_id' => $locked->id,
                'warehouse_id' => $dto->warehouse_id,
                'product_id' => $dto->product_id,
                'company_id' => $dto->company_id,
                'movement_type' => LedgerMovementType::AdjustmentIn->value,
                'quantity' => $dto->quantity,
                'on_hand_before' => $onHandBefore,
                'on_hand_after' => $onHandAfter,
                'reserved_before' => $reservedBefore,
                'reserved_after' => $reservedBefore,
                'reference_type' => $dto->reference_type,
                'reference_id' => $dto->reference_id,
                'notes' => $dto->notes,
            ]);

            $locked->refresh();

            $product = Product::query()->find($dto->product_id);

            $event = new InventoryStockAdjusted(
                inventoryItemId: $locked->id,
                warehouseId: $dto->warehouse_id,
                productId: $dto->product_id,
                companyId: $dto->company_id,
                adjustmentType: InventoryStockAdjusted::TYPE_IN,
                quantity: $dto->quantity,
                onHandBefore: $onHandBefore,
                onHandAfter: (float) $locked->on_hand_qty,
                inventoryClass: InventoryClass::fromProductType($product?->product_type, $dto->product_id),
                unitCost: $statedUnitCost,
                referenceType: $dto->reference_type,
                referenceId: $dto->reference_id,
            );

            return $locked;
        });

        // ── Guarantee publish fires only after the outermost transaction commits ─
        DB::connection()->afterCommit(function () use ($event): void {
            $this->eventBus->publish($event);
        });

        return OperationResult::success($result, 'Adjustment in applied successfully.');
    }
}
