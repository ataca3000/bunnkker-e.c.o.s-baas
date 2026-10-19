<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Routing\Domain\Models\RoutePlan;

/**
 * A plan was produced for a trip.
 */
class RoutePlanned
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly RoutePlan $plan,
        public readonly ?string $actor = null,
    ) {}
}
