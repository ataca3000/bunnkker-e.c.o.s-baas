<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Network\Domain\Models\CapacityCommitment;

/**
 * Capacity was given back to the pool.
 */
class CapacityReleased
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly CapacityCommitment $commitment,
        public readonly ?string $actor = null,
    ) {}
}
