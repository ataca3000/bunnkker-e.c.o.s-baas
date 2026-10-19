<?php

declare(strict_types=1);

namespace Modules\Logistics\Distribution\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Distribution\Domain\Enums\DeliveryStopStatus;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;

/** A stop reached an outcome — delivered, partial, failed, returned or skipped. */
class DeliveryStopCompleted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly DeliveryStop $stop,
        public readonly DeliveryStopStatus $outcome,
        public readonly ?string $actor = null,
    ) {}
}
