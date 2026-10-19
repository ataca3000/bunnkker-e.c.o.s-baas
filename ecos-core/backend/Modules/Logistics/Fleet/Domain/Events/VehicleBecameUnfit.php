<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;

/**
 * A hard blocker appeared.
 *
 * Directive 3: this states a FACT. It does not instruct anyone to cancel a
 * trip. Dispatch subscribes and decides what an unfit vehicle means to it.
 */
class VehicleBecameUnfit
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly FleetUnit $unit,
        public readonly ?string $actor = null,
    ) {}
}
