<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\Inspection;

/**
 * An inspection was rejected; a correction means a NEW inspection.
 */
class InspectionRejected
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Inspection $inspection,
        public readonly ?string $actor = null,
    ) {}
}
