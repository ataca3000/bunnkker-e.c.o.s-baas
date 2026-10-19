<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\WorkOrder;

/**
 * Work was booked in.
 */
class MaintenanceScheduled
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly WorkOrder $workOrder,
        public readonly ?string $actor = null,
    ) {}
}
