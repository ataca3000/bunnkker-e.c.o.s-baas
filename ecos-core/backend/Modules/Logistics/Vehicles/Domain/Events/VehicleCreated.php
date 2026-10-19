<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;

/**
 * A vehicle entered the fleet.
 *
 * Dispatched after the database transaction commits, so listeners always see a
 * persisted row.
 */
class VehicleCreated
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Vehicle $vehicle,
        public readonly ?string $actor = null,
    ) {}
}
