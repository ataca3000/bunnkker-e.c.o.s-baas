<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\MaintenancePlan;

/**
 * A plan reached its due point.
 */
class MaintenanceDue
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly MaintenancePlan $plan,
        public readonly ?string $actor = null,
    ) {}
}
