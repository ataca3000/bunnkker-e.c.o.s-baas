<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\WorkOrder;

/**
 * Work finished and the V1 record was written.
 */
class MaintenanceCompleted
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly WorkOrder $workOrder,
        public readonly ?string $actor = null,
    ) {}
}
