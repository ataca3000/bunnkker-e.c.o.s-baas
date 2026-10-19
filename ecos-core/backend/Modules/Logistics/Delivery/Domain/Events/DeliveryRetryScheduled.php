<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Delivery\Domain\Models\Delivery;

/**
 * Another attempt was scheduled.
 *
 * Dispatched after the transaction commits, so subscribers never observe
 * uncommitted state.
 */
class DeliveryRetryScheduled
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Delivery $delivery,
        public readonly ?string $actor = null,
    ) {}
}
