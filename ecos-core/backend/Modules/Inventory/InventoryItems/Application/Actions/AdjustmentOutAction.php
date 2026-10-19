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
use Modules\Inventory\InventoryItems\Domain\Exceptions\InsufficientStockException;
use Modules\Inventory\InventoryItems\Domain\Exceptions\InvalidInventoryMovementException;
use Modules\Inventory\Products\Domain\Enums\InventoryClass;
use Modules\Inventory\Products\Domain\Models\Product;

/**
 * Negative inventory adjustment — used when physical count is less than system quantity.
 *
 * Decreases on_hand_qty. Records AdjustmentOut movement type.
 * Throws InsufficientStockException if on_hand_qty < quantity.
 *
 * Publishes InventoryStockAdjusted (type=out) via afterCommit, guaranteeing the
 * event fires only after the outermost transaction commits.
 */
final class AdjustmentOutAction extends BaseAction
{
    public function __construct(
        private readonly InventoryItemRepositoryInterface $inventory,
        private readonly DomainEventBus $eventBus,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof StockOperationDTO) {
            throw new InvalidArgumentException('AdjustmentOutAction::execute expects a StockOperationDTO.');
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

            if ($onHandBefore < $dto->quantity) {
                throw new InsufficientStockException(
                    $dto->product_id,
                    $dto->warehouse_id,
                    $dto->quantity,
                    $onHandBefore,
                );
            }

            // D2/BUG-21 fix: prevent reducing on_hand_qty below reserved_qty.
            // bypassReserveGuard=true is only permitted for accountability workflows
            // (WarehouseLiability / WasteInvestigation) where a confirmed physical
            // shortage must be written off regardless of active order reservations.
            $onHandAfter = $onHandBefore - $dto->quantity;
            if (! $dto->bypassReserveGuard && $onHandAfter < $reservedBefore) {
                throw new InvalidInventoryMovementException(
                    "Cannot adjust out {$dto->quantity} units: on_hand_qty would fall below reserved_qty ({$reservedBefore}). ".
                    'Release or fulfil reserved orders first.',
                );
            }

            $locked->on_hand_qty = $onHandAfter;
            $this->inventory->save($locked);

            $this->inventory->recordEntry([
                'inventory_item_id' => $locked->id,
                'warehouse_id' => $dto->warehouse_id,
                'product_id' => $dto->product_id,
                'company_id' => $dto->company_id,
                'movement_type' => LedgerMovementType::AdjustmentOut->value,
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

            // Outbound stock is valued at what it cost to acquire — the
            // canonical Inventory cost for this product. Unlike an increase,
            // this value is discoverable: the stock was bought at a price.
            $product = Product::query()->find($dto->product_id);

            $event = new InventoryStockAdjusted(
                inventoryItemId: $locked->id,
                warehouseId: $dto->warehouse_id,
                productId: $dto->product_id,
                companyId: $dto->company_id,
                adjustmentType: InventoryStockAdjusted::TYPE_OUT,
                quantity: $dto->quantity,
                onHandBefore: $onHandBefore,
                onHandAfter: $onHandAfter,
                inventoryClass: InventoryClass::fromProductType($product?->product_type, $dto->product_id),
                unitCost: (float) ($product?->current_fifo_cost ?? $product?->average_cost ?? 0.0),
                referenceType: $dto->reference_type,
                referenceId: $dto->reference_id,
            );

            return $locked;
        });

        // ── Guarantee publish fires only after the outermost transaction commits ─
        DB::connection()->afterCommit(function () use ($event): void {
            $this->eventBus->publish($event);
        });

        return OperationResult::success($result, 'Adjustment out applied successfully.');
    }
}
