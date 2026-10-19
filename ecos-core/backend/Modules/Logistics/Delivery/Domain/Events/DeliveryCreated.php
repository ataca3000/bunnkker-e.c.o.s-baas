<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Delivery\Domain\Models\Delivery;

/**
 * A delivery was opened for an order.
 *
 * Dispatched after the transaction commits, so subscribers never observe
 * uncommitted state.
 */
class DeliveryCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Delivery $delivery,
        public readonly ?string $actor = null,
    ) {}
}
