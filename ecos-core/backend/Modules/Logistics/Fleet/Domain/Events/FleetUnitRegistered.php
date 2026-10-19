<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;

/**
 * A vehicle gained its operational shadow.
 */
class FleetUnitRegistered
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly FleetUnit $unit,
        public readonly ?string $actor = null,
    ) {}
}
