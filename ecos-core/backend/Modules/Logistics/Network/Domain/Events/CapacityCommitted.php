<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Network\Domain\Models\CapacityCommitment;

/**
 * A soft hold was confirmed.
 */
class CapacityCommitted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly CapacityCommitment $commitment,
        public readonly ?string $actor = null,
    ) {}
}
