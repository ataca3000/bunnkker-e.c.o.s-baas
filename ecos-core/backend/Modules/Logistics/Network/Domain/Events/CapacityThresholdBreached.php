<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;

/**
 * A slot crossed its warning threshold. A signal, not a refusal.
 */
class CapacityThresholdBreached
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly CapacitySlot $slot,
        public readonly ?string $actor = null,
    ) {}
}
