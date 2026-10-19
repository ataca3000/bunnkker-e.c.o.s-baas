<?php

declare(strict_types=1);

namespace Modules\Commerce\Synchronization\Application\Observers;

use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Synchronization\Application\Jobs\OrderStatusSyncJob;

final class OrderObserver
{
    public function updated(Order $order): void
    {
        if (! $order->wasChanged('status')) {
            return;
        }

        if ($order->external_order_id === null || $order->external_order_id === '') {
            return;
        }

        if ($order->channel_id === null) {
            return;
        }

        $channel = $order->channel;

        if ($channel === null || ! $channel->is_active) {
            return;
        }

        OrderStatusSyncJob::dispatch($channel, $order);
    }
}
