<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Distribution\Domain\Models\Trip;

/** The trip has physically departed. */
class TripDispatched
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Trip $trip,
        public readonly ?string $actor = null,
    ) {}
}
