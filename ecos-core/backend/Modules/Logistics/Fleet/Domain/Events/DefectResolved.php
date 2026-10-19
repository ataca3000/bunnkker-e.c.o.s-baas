<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Logistics\Fleet\Domain\Models\Defect;

/**
 * A fault was repaired.
 */
class DefectResolved
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly Defect $defect,
        public readonly ?string $actor = null,
    ) {}
}
