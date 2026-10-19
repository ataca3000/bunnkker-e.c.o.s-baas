<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\Auth;
use Modules\Commerce\Orders\Domain\Contracts\OrderRepositoryInterface;
use Modules\Commerce\Orders\Domain\Exceptions\OrderNotFoundException;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;

final class DeleteOrderAction extends BaseAction
{
    public function __construct(private readonly OrderRepositoryInterface $orders) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        $id = (string) ($arguments[0] ?? '');
        $order = $this->orders->findById($id);

        if ($order === null) {
            throw new OrderNotFoundException($id);
        }

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        OrderEvent::log(
            $order->id,
            'order_deleted',
            "Order #{$order->order_number} deleted.",
            ['order_number' => $order->order_number],
            $actorId,
        );

        $this->orders->delete($order);

        return OperationResult::success(null, 'Order deleted successfully.');
    }
}
