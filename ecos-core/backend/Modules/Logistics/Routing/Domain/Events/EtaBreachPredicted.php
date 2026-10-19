<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Routing\Domain\Models\RoutePlan;

/**
 * A stop is projected to miss its promise.
 *
 * Converts Delivery's AFTER-THE-FACT SLA breach into a BEFORE-THE-FACT
 * warning, without changing Delivery at all.
 */
class EtaBreachPredicted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly RoutePlan $plan,
        public readonly ?string $actor = null,
    ) {}
}
