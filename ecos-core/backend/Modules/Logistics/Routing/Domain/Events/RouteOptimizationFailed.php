<?php

declare(strict_types=1);

namespace Modules\Logistics\Routing\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Routing\Domain\Models\OptimizationRun;

/**
 * A strategy could not produce a plan.
 */
class RouteOptimizationFailed
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly OptimizationRun $run,
        public readonly ?string $actor = null,
    ) {}
}
