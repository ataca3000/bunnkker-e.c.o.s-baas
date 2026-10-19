<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryItems\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Modules\Inventory\DomainEvents\Contracts\DomainEventBus;
use Modules\Inventory\DomainEvents\Events\InventoryStockReleased;
use Modules\Inventory\InventoryItems\Application\DTO\StockOperationDTO;
use Modules\Inventory\InventoryItems\Domain\Contracts\InventoryItemRepositoryInterface;
use Modules\Inventory\InventoryItems\Domain\Enums\LedgerMovementType;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InvalidInventoryMovementException;
use Modules\Inventory\InventoryItems\Domain\Exceptions\NegativeInventoryException;

/**
 * Releases a prior reservation (e.g. order cancelled before fulfilment).
 *
 * Decreases reserved_qty. Does not touch on_hand_qty.
 *
 * Publishes InventoryStockReleased AFTER the transaction commits successfully.
 */
final class ReleaseStockAction extends BaseAction
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $inventory,
        private readonly DomainEventBus $eventBus,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof StockOperationDTO) {
            throw new InvalidArgumentException('ReleaseStockAction::execute expects a StockOperationDTO.');
        }

        if ($dto->quantity <= 0) {
            throw new InvalidInventoryMovementException('Quantity must be greater than zero');
        }

        $event = null;

        $result = DB::transaction(function () use ($dto, &$event) {
            $item = $this->inventory->findByWarehouseProductAndCompany(
                $dto->warehouse_id,
                $dto->product_id,
                $dto->company_id,
            );

            if ($item === null) {
                throw new InvalidInventoryMovementException('No inventory record found for the given warehouse and product');
            }

            $locked = $this->inventory->lockForUpdate($item->id);

            if ($locked === null) {
                throw new InvalidInventoryMovementException('InventoryItem disappeared during transaction');
            }

            $onHandBefore = (float) $locked->on_hand_qty;
            $reservedBefore = (float) $locked->reserved_qty;
            $reservedAfter = $reservedBefore - $dto->quantity;

            if ($reservedAfter < 0) {
                throw new NegativeInventoryException('reserved_qty', $reservedAfter);
            }

            $locked->reserved_qty = $reservedAfter;
            $this->inventory->save($locked);

            $this->inventory->recordEntry([
                'inventory_item_id' => $locked->id,
                'warehouse_id' => $dto->warehouse_id,
                'product_id' => $dto->product_id,
                'company_id' => $dto->company_id,
                'movement_type' => LedgerMovementType::ReservationRelease->value,
                'quantity' => $dto->quantity,
                'on_hand_before' => $onHandBefore,
                'on_hand_after' => $onHandBefore,
                'reserved_before' => $reservedBefore,
                'reserved_after' => $reservedAfter,
                'reference_type' => $dto->reference_type,
                'reference_id' => $dto->reference_id,
                'notes' => $dto->notes,
            ]);

            $locked->refresh();

            $event = new InventoryStockReleased(
                inventoryItemId: $locked->id,
                warehouseId: $dto->warehouse_id,
                productId: $dto->product_id,
                companyId: $dto->company_id,
                quantityReleased: $dto->quantity,
                reservedBefore: $reservedBefore,
                reservedAfter: $reservedAfter,
                onHandQty: $onHandBefore,
                referenceType: $dto->reference_type,
                referenceId: $dto->reference_id,
            );

            return $locked;
        });

        // ── Guarantee publish fires only after the outermost transaction commits ─
        DB::connection()->afterCommit(function () use ($event): void {
            $this->eventBus->publish($event);
        });

        return OperationResult::success($result, 'Stock reservation released.');
    }
}
