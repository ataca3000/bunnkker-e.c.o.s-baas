<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleStatus;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * A vehicle moved between lifecycle states.
 *
 * Carries both ends of the transition so listeners (fleet analytics, the future
 * Distribution engine) need not diff the model to know what happened.
 */
class VehicleStatusChanged
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Vehicle $vehicle,
        public readonly VehicleStatus $from,
        public readonly VehicleStatus $to,
        public readonly ?string $reason = null,
        public readonly ?string $actor = null,
    ) {}
}
