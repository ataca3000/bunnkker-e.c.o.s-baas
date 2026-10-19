<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryReturn;

/**
 * The warehouse received the returned goods.
 *
 * Dispatched after the transaction commits, so subscribers never observe
 * uncommitted state.
 */
class ReturnReceived
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Delivery $delivery,
        public readonly DeliveryReturn $deliveryReturn,
        public readonly ?string $actor = null,
    ) {}
}
