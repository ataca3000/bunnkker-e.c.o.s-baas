<?php

declare(strict_types=1);

namespace Modules\Commerce\Fulfillments\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\DB;
use Modules\Commerce\Fulfillments\Domain\Contracts\FulfillmentRepositoryInterface;
use Modules\Commerce\Fulfillments\Domain\Enums\FulfillmentStatus;
use Modules\Commerce\Fulfillments\Domain\Exceptions\FulfillmentNotFoundException;
use Modules\Commerce\Fulfillments\Domain\Exceptions\FulfillmentNotFulfillableException;
use Modules\Commerce\Fulfillments\Domain\Exceptions\InsufficientStockException;
use Modules\Commerce\Fulfillments\Domain\Models\FulfillmentLine;
use Modules\Inventory\StockLedger\Domain\Contracts\StockMovementRepositoryInterface;
use Modules\Inventory\StockLedger\Domain\Enums\MovementType;
use Modules\Purchasing\GoodsReceipts\Domain\Models\StockBalance;

final class FulfillFulfillmentAction extends BaseAction
{
    public function __construct(
        private readonly FulfillmentRepositoryInterface $fulfillments,
        private readonly StockMovementRepositoryInterface $movements,
    ) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $fulfillment = $this->fulfillments->findById($id);

        if ($fulfillment === null) {
            throw new FulfillmentNotFoundException($id);
        }

        if ($fulfillment->status !== FulfillmentStatus::Pending) {
            throw new FulfillmentNotFulfillableException($fulfillment->status->value);
        }

        DB::transaction(function () use ($fulfillment): void {
            /** @var FulfillmentLine $line */
            foreach ($fulfillment->lines as $line) {
                $qty = (float) $line->quantity;

                if ($qty <= 0) {
                    continue;
                }

                $balance = StockBalance::query()
                    ->where('warehouse_id', $fulfillment->warehouse_id)
                    ->where('product_id', $line->product_id)
                    ->lockForUpdate()
                    ->first();

                $balanceBefore = $balance instanceof StockBalance ? (float) $balance->quantity : 0.0;

                if ($balanceBefore < $qty) {
                    throw new InsufficientStockException((string) $line->product_id, $balanceBefore, $qty);
                }

                $balanceAfter = $balanceBefore - $qty;

                if ($balance instanceof StockBalance) {
                    $balance->update(['quantity' => $balanceAfter]);
                } else {
                    StockBalance::query()->create([
                        'warehouse_id' => $fulfillment->warehouse_id,
                        'product_id' => $line->product_id,
                        'quantity' => $balanceAfter,
                    ]);
                }

                $this->movements->record([
                    'warehouse_id' => $fulfillment->warehouse_id,
                    'product_id' => $line->product_id,
                    'movement_type' => MovementType::SalesIssue->value,
                    'quantity' => $qty,
                    'balance_before' => $balanceBefore,
                    'balance_after' => $balanceAfter,
                    'reference_type' => 'fulfillment',
                    'reference_id' => $fulfillment->id,
                    'movement_date' => $fulfillment->fulfillment_date->toDateString(),
                    'notes' => null,
                ]);
            }

            $fulfillment->update(['status' => FulfillmentStatus::Fulfilled->value]);
        });

        return OperationResult::success($this->fulfillments->findById($id), 'Fulfillment completed. Stock deducted.');
    }
}
