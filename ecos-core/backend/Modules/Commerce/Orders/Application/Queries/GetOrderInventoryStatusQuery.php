<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Queries;

use Modules\Commerce\Orders\Domain\Exceptions\OrderNotFoundException;
use Modules\Commerce\Orders\Domain\Models\Order;

final class GetOrderInventoryStatusQuery
{
    /**
     * @return array{
     *   reserved: bool,
     *   shipped: bool,
     *   released: bool,
     *   inventory_reserved_at: string|null,
     *   inventory_shipped_at: string|null,
     *   inventory_released_at: string|null,
     * }
     */
    public function execute(string $orderId): array
    {
        $order = Order::query()->find($orderId);

        if ($order === null) {
            throw new OrderNotFoundException($orderId);
        }

        return [
            'reserved' => $order->inventory_reserved_at !== null,
            'shipped' => $order->inventory_shipped_at !== null,
            'released' => $order->inventory_released_at !== null,
            'inventory_reserved_at' => $order->inventory_reserved_at?->toIso8601String(),
            'inventory_shipped_at' => $order->inventory_shipped_at?->toIso8601String(),
            'inventory_released_at' => $order->inventory_released_at?->toIso8601String(),
        ];
    }
}
