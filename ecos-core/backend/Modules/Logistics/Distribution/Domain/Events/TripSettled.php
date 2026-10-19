<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Distribution\Domain\Models\TripSettlement;

/** Cash reconciliation finalized for a trip. */
class TripSettled
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Trip $trip,
        public readonly TripSettlement $settlement,
        public readonly ?string $actor = null,
    ) {}
}
