<?php

declare(strict_types=1);

namespace Modules\Purchasing\PurchaseOrders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Purchasing\PurchaseOrders\Domain\Contracts\PurchaseOrderRepositoryInterface;
use Modules\Purchasing\PurchaseOrders\Domain\Exceptions\PurchaseOrderNotFoundException;

final class GetPurchaseOrderAction extends BaseAction
{
    public function __construct(private readonly PurchaseOrderRepositoryInterface $orders) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');

        $order = $this->orders->findById($id);

        if ($order === null) {
            throw new PurchaseOrderNotFoundException($id);
        }

        return OperationResult::success($order);
    }
}
