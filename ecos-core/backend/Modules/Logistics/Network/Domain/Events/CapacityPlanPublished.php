<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Network\Domain\Models\CapacityPlan;

/**
 * Capacity for a date became bookable.
 */
class CapacityPlanPublished
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly CapacityPlan $plan,
        public readonly ?string $actor = null,
    ) {}
}
