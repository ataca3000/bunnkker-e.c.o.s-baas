<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Purchasing\PurchaseOrders\Application\DTO\PurchaseOrderDTO;
use Modules\Purchasing\PurchaseOrders\Application\DTO\PurchaseOrderLineDTO;
use Modules\Purchasing\PurchaseOrders\Domain\Contracts\PurchaseOrderRepositoryInterface;
use Modules\Purchasing\PurchaseOrders\Domain\Enums\PurchaseOrderStatus;

final class CreatePurchaseOrderAction extends BaseAction
{
    public function __construct(private readonly PurchaseOrderRepositoryInterface $orders) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $dto = $arguments[0] ?? null;

        if (! $dto instanceof PurchaseOrderDTO) {
            throw new InvalidArgumentException('CreatePurchaseOrderAction::execute expects a PurchaseOrderDTO.');
        }

        $subtotal = $dto->subtotal();

        $attributes = [
            'po_number' => $this->orders->nextPoNumber(),
            'supplier_id' => $dto->supplier_id,
            'order_date' => $dto->order_date,
            'expected_date' => $dto->expected_date,
            'status' => PurchaseOrderStatus::Draft->value,
            'notes' => $dto->notes,
            'subtotal' => $subtotal,
            'total' => $subtotal,
        ];

        $lines = array_map(fn (PurchaseOrderLineDTO $line): array => [
            'product_id' => $line->product_id,
            'quantity' => $line->quantity,
            'unit_price' => $line->unit_price,
            'line_total' => $line->lineTotal(),
        ], $dto->lines);

        $order = $this->orders->create($attributes, $lines);

        return OperationResult::success($order, 'Purchase order created successfully.');
    }
}
