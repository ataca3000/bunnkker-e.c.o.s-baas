<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Distribution\Domain\Enums\TripStatus;
use Modules\Logistics\Distribution\Domain\Models\Trip;

/** Carries both ends of the transition so listeners need not diff the model. */
class TripStatusChanged
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Trip $trip,
        public readonly TripStatus $from,
        public readonly TripStatus $to,
        public readonly ?string $reason = null,
        public readonly ?string $actor = null,
    ) {}
}
