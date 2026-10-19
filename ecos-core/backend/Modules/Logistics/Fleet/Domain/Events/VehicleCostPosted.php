<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\CostEntry;

/**
 * An operational cost fact was recorded (D8: Accounting remains the authority).
 */
class VehicleCostPosted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly CostEntry $entry,
        public readonly ?string $actor = null,
    ) {}
}
