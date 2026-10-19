<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;

/**
 * A slot's binding dimension is full.
 */
class CapacityExhausted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly CapacitySlot $slot,
        public readonly ?string $actor = null,
    ) {}
}
