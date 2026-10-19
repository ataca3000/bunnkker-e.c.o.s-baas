<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Routing\Domain\Models\RoutePlan;

/**
 * A newer plan replaced this one. The old plan stays readable.
 */
class RoutePlanSuperseded
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly RoutePlan $plan,
        public readonly ?string $actor = null,
    ) {}
}
