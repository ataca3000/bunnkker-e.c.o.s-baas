<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;

/**
 * The customer took part of the order; the remainder returns.
 *
 * Dispatched after the transaction commits, so subscribers never observe
 * uncommitted state.
 */
class DeliveryPartiallySucceeded
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Delivery $delivery,
        public readonly DeliveryAttempt $attempt,
        public readonly ?string $actor = null,
    ) {}
}
