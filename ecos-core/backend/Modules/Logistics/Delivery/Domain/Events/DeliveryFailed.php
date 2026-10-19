<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;
use Modules\Logistics\Delivery\Domain\Models\DeliveryFailure;

/**
 * An attempt closed without delivering.
 *
 * Dispatched after the transaction commits, so subscribers never observe
 * uncommitted state.
 */
class DeliveryFailed
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Delivery $delivery,
        public readonly DeliveryAttempt $attempt,
        public readonly DeliveryFailure $failure,
        public readonly ?string $actor = null,
    ) {}
}
