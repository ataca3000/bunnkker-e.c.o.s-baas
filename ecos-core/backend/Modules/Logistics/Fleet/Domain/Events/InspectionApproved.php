<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\Inspection;

/**
 * An inspection passed review.
 */
class InspectionApproved
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Inspection $inspection,
        public readonly ?string $actor = null,
    ) {}
}
