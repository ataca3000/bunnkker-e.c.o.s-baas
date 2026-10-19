<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Delivery\Domain\Models\CodRecord;
use Modules\Logistics\Delivery\Domain\Models\Delivery;

/**
 * Money changed hands at the door. Distribution remains the cash authority; this event only reports the fact.
 *
 * Dispatched after the transaction commits, so subscribers never observe
 * uncommitted state.
 */
class CodCollected
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Delivery $delivery,
        public readonly CodRecord $cod,
        public readonly ?string $actor = null,
    ) {}
}
