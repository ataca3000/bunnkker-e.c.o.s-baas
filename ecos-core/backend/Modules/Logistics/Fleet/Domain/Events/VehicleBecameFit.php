<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;

/**
 * Every blocker cleared. Dispatch may propose this vehicle again.
 */
class VehicleBecameFit
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly FleetUnit $unit,
        public readonly ?string $actor = null,
    ) {}
}
