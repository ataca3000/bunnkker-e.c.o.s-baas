<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\ProofOfDelivery;

/**
 * Proof of delivery passed validation.
 *
 * Dispatched after the transaction commits, so subscribers never observe
 * uncommitted state.
 */
class PodValidated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Delivery $delivery,
        public readonly ProofOfDelivery $pod,
        public readonly ?string $actor = null,
    ) {}
}
