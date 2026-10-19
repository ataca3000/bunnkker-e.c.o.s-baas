<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Commerce\Orders\Application\DTO\OrderDTO;
use Modules\Commerce\Orders\Domain\Contracts\OrderRepositoryInterface;

final class CreateOrderAction extends BaseAction
{
    public function __construct(private readonly OrderRepositoryInterface $orders) {}

    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var OrderDTO $dto */
        $dto = $arguments[0];

        $attributes = $dto->orderAttributes();
        $attributes['order_number'] = $this->orders->nextOrderNumber();

        $subtotal = array_sum(array_column($dto->lineAttributes(), 'line_total'));
        $attributes['subtotal'] = $subtotal;
        $attributes['total'] = $subtotal;

        $order = $this->orders->create($attributes, $dto->lineAttributes());

        return OperationResult::success($order, 'Order created successfully.');
    }
}
