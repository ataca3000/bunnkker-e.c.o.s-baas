<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Purchasing\PurchaseOrders\Domain\Contracts\PurchaseOrderRepositoryInterface;
use Modules\Purchasing\PurchaseOrders\Domain\Enums\PurchaseOrderStatus;
use Modules\Purchasing\PurchaseOrders\Domain\Exceptions\InvalidPurchaseOrderStatusException;
use Modules\Purchasing\PurchaseOrders\Domain\Exceptions\PurchaseOrderNotFoundException;

final class CancelPurchaseOrderAction extends BaseAction
{
    public function __construct(private readonly PurchaseOrderRepositoryInterface $orders) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $order = $this->orders->findById($id);

        if ($order === null) {
            throw new PurchaseOrderNotFoundException($id);
        }

        if ($order->status === PurchaseOrderStatus::Cancelled) {
            return OperationResult::success($order, 'Purchase order is already cancelled.');
        }

        if (! $order->status->canCancel()) {
            throw new InvalidPurchaseOrderStatusException(
                $order->po_number,
                $order->status->value,
                [PurchaseOrderStatus::Draft->value, PurchaseOrderStatus::Submitted->value],
            );
        }

        $order->update(['status' => PurchaseOrderStatus::Cancelled->value]);

        return OperationResult::success($order->refresh(), 'Purchase order cancelled.');
    }
}
