<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use InvalidArgumentException;
use Modules\Purchasing\PurchaseOrders\Application\DTO\PurchaseOrderDTO;
use Modules\Purchasing\PurchaseOrders\Application\DTO\PurchaseOrderLineDTO;
use Modules\Purchasing\PurchaseOrders\Domain\Contracts\PurchaseOrderRepositoryInterface;
use Modules\Purchasing\PurchaseOrders\Domain\Exceptions\PurchaseOrderNotEditableException;
use Modules\Purchasing\PurchaseOrders\Domain\Exceptions\PurchaseOrderNotFoundException;

final class UpdatePurchaseOrderAction extends BaseAction
{
    public function __construct(private readonly PurchaseOrderRepositoryInterface $orders) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $dto = $arguments[1] ?? null;

        if (! $dto instanceof PurchaseOrderDTO) {
            throw new InvalidArgumentException('UpdatePurchaseOrderAction::execute expects a PurchaseOrderDTO as second argument.');
        }

        $order = $this->orders->findById($id);

        if ($order === null) {
            throw new PurchaseOrderNotFoundException($id);
        }

        if (! $order->status->isEditable()) {
            throw new PurchaseOrderNotEditableException($order->po_number);
        }

        $subtotal = $dto->subtotal();

        $attributes = [
            'supplier_id' => $dto->supplier_id,
            'order_date' => $dto->order_date,
            'expected_date' => $dto->expected_date,
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

        $updated = $this->orders->update($order, $attributes, $lines);

        return OperationResult::success($updated, 'Purchase order updated successfully.');
    }
}
