<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Purchasing\PurchaseOrders\Domain\Contracts\PurchaseOrderRepositoryInterface;
use Modules\Purchasing\PurchaseOrders\Domain\Exceptions\PurchaseOrderNotEditableException;
use Modules\Purchasing\PurchaseOrders\Domain\Exceptions\PurchaseOrderNotFoundException;

final class DeletePurchaseOrderAction extends BaseAction
{
    public function __construct(private readonly PurchaseOrderRepositoryInterface $orders) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        $order = $this->orders->findById($id);

        if ($order === null) {
            throw new PurchaseOrderNotFoundException($id);
        }

        if (! $order->status->isEditable()) {
            throw new PurchaseOrderNotEditableException($order->po_number);
        }

        $this->orders->delete($order);

        return OperationResult::success(null, 'Purchase order deleted successfully.');
    }
}
