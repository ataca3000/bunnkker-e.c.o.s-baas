<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Modules\Inventory\DomainEvents\Contracts\DomainEventBus;
use Modules\Inventory\DomainEvents\Events\InventoryStockReceived;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Domain\Enums\LedgerMovementType;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InvalidInventoryMovementException;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Records stock arriving at a warehouse (e.g. from a supplier goods receipt).
 *
 * Increases on_hand_qty. Does not touch reserved_qty.
 *
 * Publishes InventoryStockReceived AFTER the transaction commits successfully.
 * If the transaction rolls back, no event is published.
 */
final class ReceiveStockAction extends BaseAction
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $inventory,
        private readonly DomainEventBus $eventBus,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof StockOperationDTO) {
            throw new InvalidArgumentException('ReceiveStockAction::execute expects a StockOperationDTO.');
        }

        if ($dto->quantity <= 0) {
            throw new InvalidInventoryMovementException('Quantity must be greater than zero');
        }

        // Capture pre-transaction state for the event payload.
        $onHandBefore = null;

        $result = DB::transaction(function () use ($dto, &$onHandBefore) {
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
                'movement_type' => LedgerMovementType::PurchaseReceipt->value,
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

            return $locked;
        });

        // ── F-INV-H5: Guarantee post-outermost-commit dispatch ──────────────
        // DB::connection()->afterCommit() defers the callback until the outermost
        // transaction commits. When ReceiveStockAction runs standalone its own
        // DB::transaction() is the outermost, so the callback fires immediately
        // after commit (level 0 → no pending transaction → immediate execution).
        // When called as a nested savepoint inside PostGoodsReceiptAction, the
        // callback is held in the TransactionsManager until the outer transaction
        // commits — rollback of the outer transaction silently discards the callback,
        // guaranteeing zero events on rollback and exactly one event on success.
        // ── Financial payload (EPIC-FIN-INTEGRATION-003) ────────────────────
        // Resolved from Inventory's own Product aggregate so the event reaches
        // Finance already carrying what posting needs. Products live inside this
        // module, so this crosses no bounded context — and it is precisely what
        // lets Finance never call back into Inventory.
        //
        // An unclassifiable product throws rather than posting to a guessed
        // account. The stock movement itself has already committed above; what
        // is refused is the claim to know how to account for it.
        $product = Product::query()->find($dto->product_id);

        $event = new InventoryStockReceived(
            inventoryItemId: $result->id,
            warehouseId: $dto->warehouse_id,
            productId: $dto->product_id,
            companyId: $dto->company_id,
            quantityReceived: $dto->quantity,
            onHandBefore: $onHandBefore ?? 0.0,
            onHandAfter: (float) $result->on_hand_qty,
            inventoryClass: InventoryClass::fromProductType($product?->product_type, $dto->product_id),
            // Prefer the price actually paid, which goods-receipt posting passes
            // through. A running average would value arriving stock at what
            // older stock cost, which is a different number and the wrong one.
            unitCost: $dto->unit_cost ?? (float) ($product?->current_fifo_cost ?? 0.0),
            referenceType: $dto->reference_type,
            referenceId: $dto->reference_id,
        );

        DB::connection()->afterCommit(function () use ($event): void {
            $this->eventBus->publish($event);
        });

        return OperationResult::success($result, 'Stock received successfully.');
    }
}
